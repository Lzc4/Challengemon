import { supabase } from "../supabase/client";
import { applyBps, createBps, crc32 } from "../rom/bps";
import { activeKind, providerFor, type ProviderKind } from "../userStorage";
import { cacheRunRom, loadLibraryRom, patchPath } from "../storage";
import { randomizeLocally } from "./local";
import { dispatchRandomizer, ensureRandomizerRepo, workflowState } from "./github";
import type { LibraryRom, Run, RunPlayer } from "../types";

export const RANDOMIZER_VERSION = "4.6.1";

export type RandomizeMethod = "local" | "github";

const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function encodeSettings(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

// shared = ein seed fuer alle, individual = jeder hat seinen eigenen
export function seedFor(run: Run, player: RunPlayer) {
  const seed = run.randomize === "shared" ? run.seed : player.seed;
  if (seed === null || seed === undefined) throw new Error("Für diesen Run fehlt der Seed");
  return String(seed);
}

async function update(run: Run, userId: string, patch: Partial<RunPlayer>) {
  await supabase().from("run_players").update(patch).eq("run_id", run.id).eq("user_id", userId);
}

async function finish(run: Run, userId: string, base: LibraryRom, rom: Uint8Array, provider: string, path: string) {
  await cacheRunRom(run.id, rom);
  await update(run, userId, {
    status: "ready",
    error: null,
    job: null,
    base_crc32: base.crc32,
    rom_crc32: crc32(rom),
    patch_provider: provider,
    patch_path: path,
  });
}

export async function randomizeHere(run: Run, player: RunPlayer, base: LibraryRom, onStage: (s: string) => void) {
  if (!run.settings) throw new Error("Der Run hat keine Randomizer-Settings");
  await update(run, player.user_id, { status: "randomizing", error: null, job: "local" });
  try {
    onStage("Basis-ROM wird geladen…");
    const source = await loadLibraryRom(base);
    const out = await randomizeLocally(source, decode(run.settings), seedFor(run, player), onStage);
    onStage("Patch wird erstellt…");
    await new Promise((r) => setTimeout(r, 30));
    const patch = createBps(source, out);
    const kind = activeKind();
    const path = patchPath(run.id, player.user_id);
    onStage("Patch wird in deinem Speicher abgelegt…");
    await providerFor(kind)!.put(path, new Blob([patch as BlobPart]));
    await finish(run, player.user_id, base, out, kind, path);
  } catch (err) {
    await update(run, player.user_id, { status: "failed", error: err instanceof Error ? err.message : String(err), job: null });
    throw err;
  }
}

// laeuft im github des users, rom geht direkt drive -> action -> drive
export async function randomizeOnGithub(run: Run, player: RunPlayer, base: LibraryRom, onStage: (s: string) => void) {
  if (!run.settings) throw new Error("Der Run hat keine Randomizer-Settings");
  const provider = providerFor(base.provider as ProviderKind);
  if (!provider?.remoteRead || !provider.remoteWrite) {
    throw new Error("Für GitHub muss die Basis-ROM in einem Online-Speicher liegen (Google Drive oder S3). Nextcloud- und WebDAV-Zugänge geben wir aus Sicherheitsgründen nicht an GitHub weiter.");
  }
  await ensureRandomizerRepo(onStage);
  const path = patchPath(run.id, player.user_id);
  const id = `${run.id.slice(0, 8)}-${player.user_id.slice(0, 8)}-${Date.now().toString(36)}`;
  onStage("Auftrag wird an GitHub geschickt…");
  await dispatchRandomizer(id, {
    settings: run.settings,
    seed: seedFor(run, player),
    baseCrc: base.crc32,
    base: await provider.remoteRead(base.path),
    upload: await provider.remoteWrite(path),
  });
  await update(run, player.user_id, { status: "randomizing", error: null, job: `github:${id}` });
  return id;
}

// pollt den workflow-status, kein webhook noetig
export async function waitForGithub(run: Run, player: RunPlayer, base: LibraryRom, jobId: string, onStage: (s: string) => void, signal?: AbortSignal) {
  const started = Date.now();
  for (;;) {
    if (signal?.aborted) return;
    const state = await workflowState(jobId);
    if (state.status === "completed") {
      if (state.conclusion !== "success") {
        const msg = `GitHub-Lauf fehlgeschlagen${state.url ? ` (Details: ${state.url})` : ""}`;
        await update(run, player.user_id, { status: "failed", error: msg, job: null });
        throw new Error(msg);
      }
      break;
    }
    if (state.status === "missing" && Date.now() - started > 3 * 60_000) {
      await update(run, player.user_id, { status: "failed", error: "GitHub hat den Auftrag nicht gestartet", job: null });
      throw new Error("GitHub hat den Auftrag nicht gestartet");
    }
    onStage(state.status === "in_progress" ? "GitHub randomisiert deine ROM…" : "Warte auf GitHub…");
    await new Promise((r) => setTimeout(r, 5000));
  }
  onStage("Patch wird geladen…");
  const path = patchPath(run.id, player.user_id);
  const blob = await providerFor(base.provider as ProviderKind)!.get(path);
  if (!blob) throw new Error("Patch nicht gefunden");
  const source = await loadLibraryRom(base);
  const rom = applyBps(source, new Uint8Array(await blob.arrayBuffer()));
  await finish(run, player.user_id, base, rom, base.provider, path);
}
