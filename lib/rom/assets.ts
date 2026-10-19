"use client";

import { useEffect, useState } from "react";
import { idbGet, idbSet } from "@/lib/idb";
import { gen4Game, type Gen4Game } from "@/lib/save/gen4";
import { bitmapToPng, extractIconSheet, extractPokegearMap, extractSinnohMap } from "./hgssAssets";

export interface HgssAssets {
  mapUrl: string | null;
  iconsUrl: string | null;
}

interface Stored {
  version: number;
  map: Blob | null;
  icons: Blob | null;
}

// karte + icons werden aus der rom des users gebaut und nur lokal gespeichert
const VERSION = 2;
const cache = new Map<string, Promise<HgssAssets>>();
const listeners = new Map<string, Set<(a: HgssAssets) => void>>();

const keyFor = (game: Gen4Game) => `assets:${game}`;

function load(game: Gen4Game) {
  const key = keyFor(game);
  if (!cache.has(key)) {
    cache.set(
      key,
      idbGet<Stored>("assets", key).then((s) =>
        s && s.version === VERSION
          ? { mapUrl: s.map ? URL.createObjectURL(s.map) : null, iconsUrl: s.icons ? URL.createObjectURL(s.icons) : null }
          : { mapUrl: null, iconsUrl: null },
      ),
    );
  }
  return cache.get(key)!;
}

export async function ensureHgssAssets(rom: Uint8Array, game: Gen4Game) {
  const existing = await load(game);
  if (existing.iconsUrl && (existing.mapUrl || game === "bw" || game === "b2w2")) return existing;
  const gen5 = game === "bw" || game === "b2w2";
  const [map, icons] = await Promise.all([
    gen5 ? Promise.resolve(null) : bitmapToPng(game !== "hgss" ? extractSinnohMap(rom) : extractPokegearMap(rom)),
    bitmapToPng(extractIconSheet(rom, game)).catch(() => null),
  ]);
  await idbSet("assets", keyFor(game), { version: VERSION, map, icons } satisfies Stored);
  const assets = { mapUrl: map ? URL.createObjectURL(map) : null, iconsUrl: icons ? URL.createObjectURL(icons) : null };
  cache.set(keyFor(game), Promise.resolve(assets));
  listeners.get(keyFor(game))?.forEach((fn) => fn(assets));
  return assets;
}

export function useHgssAssets(gameCode: string | null | undefined): HgssAssets {
  return useGameAssets(gen4Game(gameCode ?? null));
}

export function useGameAssets(game: Gen4Game | null | undefined): HgssAssets {
  const [assets, setAssets] = useState<HgssAssets>({ mapUrl: null, iconsUrl: null });
  useEffect(() => {
    if (!game) return;
    let alive = true;
    const key = keyFor(game);
    load(game).then((a) => alive && setAssets(a));
    const set = listeners.get(key) ?? new Set();
    const fn = (a: HgssAssets) => alive && setAssets(a);
    set.add(fn);
    listeners.set(key, set);
    return () => {
      alive = false;
      set.delete(fn);
    };
  }, [game]);
  return assets;
}
