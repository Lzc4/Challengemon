import { supabase } from "./supabase/client";
import { encounterLocation, type Gen4Save, type Mon } from "./save/gen4";
import type { Encounter } from "./types";

export function ignoredKey(runId: string, userId: string) {
  return `ignored:${runId}:${userId}`;
}

export function readIgnored(runId: string, userId: string | null): number[] {
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(ignoredKey(runId, userId)) ?? "[]");
  } catch {
    return [];
  }
}

export function computeSuggestions(save: Gen4Save | null, encounters: Encounter[], userId: string | null, ignored: number[]) {
  if (!save || !userId) return [] as [string, Mon[]][];
  const knownPids = new Set(encounters.filter((e) => e.user_id === userId && e.pid !== null).map((e) => Number(e.pid)));
  const usedLocations = new Set(encounters.filter((e) => e.user_id === userId).map((e) => e.location));
  const out = new Map<string, Mon[]>();
  for (const mon of [...save.party, ...save.boxes]) {
    if (mon.isEgg || mon.tid !== save.tid || knownPids.has(mon.pid) || ignored.includes(mon.pid)) continue;
    const loc = encounterLocation(mon);
    if (!loc || usedLocations.has(loc)) continue;
    if (out.get(loc)?.some((m) => m.pid === mon.pid)) continue;
    out.set(loc, [...(out.get(loc) ?? []), mon]);
  }
  return Array.from(out.entries());
}

const pending = new Set<string>();

export async function autoTrack(runId: string, userId: string, save: Gen4Save | null, encounters: Encounter[]) {
  const ignored = readIgnored(runId, userId);
  const added: { location: string; mon: Mon }[] = [];
  for (const [location, mons] of computeSuggestions(save, encounters, userId, ignored)) {
    if (mons.length !== 1) continue;
    const key = `${runId}:${userId}:${location}`;
    if (pending.has(key)) continue;
    pending.add(key);
    const mon = mons[0];
    const { error } = await supabase()
      .from("encounters")
      .upsert(
        {
          run_id: runId,
          user_id: userId,
          location,
          species: mon.speciesName,
          nickname: mon.isNicknamed ? mon.nickname : null,
          status: "caught",
          pid: mon.pid,
          in_party: save?.party.some((m) => m.pid === mon.pid) ?? false,
        },
        { onConflict: "run_id,user_id,location", ignoreDuplicates: true },
      );
    if (!error) added.push({ location, mon });
    else pending.delete(key);
  }
  return added;
}
