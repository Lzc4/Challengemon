import { supabase } from "./supabase/client";
import { idbDelete, idbGet, idbKeys, idbSet } from "./idb";
import { gzip, gunzip } from "./compress";
import { applyBps, crc32 } from "./rom/bps";
import { detectSystem, knownTitle, readHeader } from "./games";
import { activeKind, providerFor, type ProviderKind, type Progress } from "./userStorage";
import type { LibraryRom, Run, RunPlayer, SaveRow, System } from "./types";

// aeltere saves werden im speicher des users weggeraeumt
const KEEP_SAVES = 30;

export const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");

export function libraryPath(code: string | null, crc: number, system: System) {
  return `roms/${code ?? "rom"}-${hex(crc)}.${system}`;
}

export const patchPath = (runId: string, userId: string) => `runs/${runId}/${userId}.bps`;

function provider(kind: string) {
  const p = providerFor(kind as ProviderKind);
  if (!p) throw new Error(`Speicher „${kind}“ ist auf diesem Gerät nicht verbunden. Verbinde ihn unter Speicher.`);
  return p;
}

export interface RomInfo {
  system: System;
  code: string | null;
  title: string;
  crc: number;
  size: number;
}

export async function inspectRom(file: File): Promise<{ info: RomInfo; data: Uint8Array }> {
  const system = detectSystem(file.name);
  if (!system) throw new Error("Unbekanntes Dateiformat. Erlaubt sind .nds, .gba, .gbc und .gb.");
  const data = new Uint8Array(await file.arrayBuffer());
  const header = readHeader(system, data.subarray(0, 0x200));
  const code = header.code || null;
  return {
    data,
    info: { system, code, title: knownTitle(code) ?? (header.title || file.name.replace(/\.[^.]+$/, "")), crc: crc32(data), size: data.length },
  };
}

const romKey = (crc: number) => `base:${hex(crc)}`;

export async function cacheRom(key: string, data: Uint8Array) {
  await idbSet("roms", key, { size: data.length, data: new Blob([data as BlobPart]) });
}

async function cachedRom(key: string, size?: number) {
  const hit = await idbGet<{ size: number; data: Blob }>("roms", key);
  if (!hit || (size !== undefined && hit.size !== size)) return null;
  return new Uint8Array(await hit.data.arrayBuffer());
}

export async function addToLibrary(info: RomInfo, data: Uint8Array, kind: ProviderKind = activeKind(), onProgress?: Progress) {
  const path = libraryPath(info.code, info.crc, info.system);
  await provider(kind).put(path, new Blob([data as BlobPart]), onProgress);
  await cacheRom(romKey(info.crc), data);
  const { data: row, error } = await supabase()
    .from("library")
    .upsert(
      { system: info.system, game_code: info.code, title: info.title, crc32: info.crc, size: info.size, provider: kind, path },
      { onConflict: "user_id,crc32,provider" },
    )
    .select()
    .single();
  if (error) throw error;
  return row as LibraryRom;
}

export async function myLibrary(): Promise<LibraryRom[]> {
  const { data } = await supabase().from("library").select("*").order("title");
  return (data as LibraryRom[]) ?? [];
}

export async function removeFromLibrary(entry: LibraryRom) {
  await providerFor(entry.provider as ProviderKind)?.remove(entry.path).catch(() => null);
  await idbDelete("roms", romKey(entry.crc32));
  await supabase().from("library").delete().eq("id", entry.id);
}

export async function isCached(crc: number) {
  return !!(await idbGet("roms", romKey(crc)));
}

export async function loadLibraryRom(entry: LibraryRom, onProgress?: Progress): Promise<Uint8Array> {
  const hit = await cachedRom(romKey(entry.crc32), entry.size);
  if (hit) {
    onProgress?.(1, 1);
    return hit;
  }
  const blob = await provider(entry.provider).get(entry.path, onProgress);
  if (!blob) throw new Error(`Die ROM fehlt in deinem Speicher (${entry.path}). Lade sie in der Bibliothek neu hoch.`);
  const data = new Uint8Array(await blob.arrayBuffer());
  if (crc32(data) !== entry.crc32) throw new Error("Die ROM in deinem Speicher ist beschädigt oder wurde verändert.");
  await cacheRom(romKey(entry.crc32), data);
  return data;
}

// erste 3 zeichen vom gamecode, region egal
export function sameGame(a: string | null, b: string | null) {
  return !!a && !!b && a.slice(0, 3) === b.slice(0, 3);
}

// lieber exakte version (gleiche region), sonst irgendeine passende
export function pickBase(library: LibraryRom[], run: Pick<Run, "game_code">, player?: RunPlayer | null) {
  const exact = library.filter((l) => l.game_code === run.game_code);
  const pool = exact.length ? exact : library.filter((l) => sameGame(l.game_code, run.game_code));
  if (player?.base_crc32) return pool.find((l) => l.crc32 === player.base_crc32) ?? null;
  return pool[0] ?? null;
}

const runKey = (runId: string, crc: number) => `run:${runId}:${hex(crc)}`;

export async function cacheRunRom(runId: string, data: Uint8Array) {
  await cacheRom(runKey(runId, crc32(data)), data);
}

// randomisierte rom = basis-rom + patch, landet danach im idb-cache
export async function loadRunRom(run: Run, player: RunPlayer, library: LibraryRom[], onProgress?: Progress): Promise<Uint8Array> {
  const base = pickBase(library, run, player);
  if (!base) throw new Error("Für dieses Spiel liegt keine ROM in deiner Bibliothek.");
  if (run.randomize === "none") return loadLibraryRom(base, onProgress);
  if (player.status !== "ready" || !player.rom_crc32 || !player.patch_path || !player.patch_provider) {
    throw new Error("Deine ROM für diesen Run ist noch nicht randomisiert.");
  }
  const hit = await cachedRom(runKey(run.id, player.rom_crc32));
  if (hit) {
    onProgress?.(1, 1);
    return hit;
  }
  const source = await loadLibraryRom(base, (d, t) => onProgress?.(d * 0.9, t));
  const patch = await provider(player.patch_provider).get(player.patch_path);
  if (!patch) throw new Error("Der Randomizer-Patch fehlt in deinem Speicher. Randomisiere die ROM neu.");
  const rom = applyBps(source, new Uint8Array(await patch.arrayBuffer()));
  await cacheRom(runKey(run.id, player.rom_crc32), rom);
  onProgress?.(1, 1);
  return rom;
}

export async function forgetRunRoms(runId: string) {
  for (const k of await idbKeys("roms")) if (k.startsWith(`run:${runId}:`)) await idbDelete("roms", k);
}

export async function latestSave(runId: string, userId: string, kind: "sram" | "state") {
  const { data } = await supabase()
    .from("saves")
    .select("*")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SaveRow | null) ?? null;
}

export async function downloadSave(row: SaveRow): Promise<Uint8Array> {
  const blob = await provider(row.provider).get(row.path);
  if (!blob) throw new Error("Spielstand nicht gefunden");
  return gunzip(new Uint8Array(await blob.arrayBuffer()));
}

export async function uploadSave(runId: string, userId: string, kind: "sram" | "state", raw: Uint8Array) {
  const kindName = activeKind();
  const packed = await gzip(raw);
  const path = `runs/${runId}/saves/${kind}-${Date.now()}.gz`;
  await provider(kindName).put(path, new Blob([packed as BlobPart]));
  const { error } = await supabase().from("saves").insert({ run_id: runId, user_id: userId, kind, provider: kindName, path, size: raw.length });
  if (error) throw error;
  void prune(runId, userId, kind);
  return path;
}

async function prune(runId: string, userId: string, kind: "sram" | "state") {
  const client = supabase();
  const { data } = await client
    .from("saves")
    .select("id, provider, path")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .range(KEEP_SAVES, KEEP_SAVES + 50);
  if (!data?.length) return;
  for (const r of data as { provider: string; path: string }[]) await providerFor(r.provider as ProviderKind)?.remove(r.path).catch(() => null);
  await client.from("saves").delete().in("id", data.map((r: { id: number }) => r.id));
}

// loescht nur eigene dateien, die der anderen liegen ja bei denen
export async function removeMyRunFiles(runId: string, userId: string) {
  const client = supabase();
  const { data } = await client.from("saves").select("provider, path").eq("run_id", runId).eq("user_id", userId);
  for (const r of (data as { provider: string; path: string }[]) ?? []) await providerFor(r.provider as ProviderKind)?.remove(r.path).catch(() => null);
  const { data: me } = await client.from("run_players").select("patch_provider, patch_path").eq("run_id", runId).eq("user_id", userId).maybeSingle();
  const p = me as { patch_provider: string | null; patch_path: string | null } | null;
  if (p?.patch_provider && p.patch_path) await providerFor(p.patch_provider as ProviderKind)?.remove(p.patch_path).catch(() => null);
  await forgetRunRoms(runId);
}
