"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";
import type { Gen4Game, Gen4Save } from "./save/gen4";
import type { LiveStatus } from "./types";

export interface ParsedEntry {
  rowId: number;
  save: Gen4Save | null;
  error?: string;
}

interface SummaryRow {
  user_id: string;
  summary: Gen4Save;
  saved_at: string;
}

export function useSaveSummaries(runId: string | null | undefined) {
  const [entries, setEntries] = useState<Record<string, ParsedEntry>>({});
  useEffect(() => {
    if (!runId) return;
    const client = supabase();
    const load = () =>
      client
        .from("save_summaries")
        .select("user_id, summary, saved_at")
        .eq("run_id", runId)
        .then(({ data }: { data: SummaryRow[] | null }) => {
          const next: Record<string, ParsedEntry> = {};
          for (const r of data ?? []) next[r.user_id] = { rowId: new Date(r.saved_at).getTime(), save: r.summary };
          setEntries(next);
        });
    void load();
    const channel = client
      .channel(`summaries-${runId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "save_summaries", filter: `run_id=eq.${runId}` }, load)
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [runId]);
  return entries;
}

// mitspieler koennen unsere saves nicht lesen, also team/boxen als json in die db
export async function publishSummary(runId: string, userId: string, save: Gen4Save) {
  await supabase()
    .from("save_summaries")
    .upsert({ run_id: runId, user_id: userId, summary: save, saved_at: new Date().toISOString() }, { onConflict: "run_id,user_id" });
}

export function mergeLive(
  save: Gen4Save | null,
  live: LiveStatus | undefined,
  savedAt: string | undefined,
  game: Gen4Game,
): Gen4Save | null {
  if (!live?.party?.length) return save;
  if (save && savedAt && new Date(savedAt).getTime() > new Date(live.updated_at).getTime()) return save;
  if (save) return { ...save, party: live.party };
  const tids = live.party.map((m) => m.tid);
  const tid = tids.sort((a, b) => tids.filter((t) => t === b).length - tids.filter((t) => t === a).length)[0];
  return { game, trainer: "", tid, money: 0, badges: 0, kantoBadges: 0, playSeconds: 0, party: live.party, boxes: [] };
}
