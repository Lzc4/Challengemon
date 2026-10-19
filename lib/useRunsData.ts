"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";
import type { Encounter, Run } from "./types";

export interface RunsData {
  runs: (Run & { run_players: { user_id: string }[] })[];
  encounters: Pick<Encounter, "run_id" | "user_id" | "status">[];
  loaded: boolean;
}

export function useRunsData(): RunsData {
  const [data, setData] = useState<RunsData>({ runs: [], encounters: [], loaded: false });
  useEffect(() => {
    const client = supabase();
    Promise.all([
      client.from("runs").select("*, run_players(user_id)").order("created_at", { ascending: false }),
      client.from("encounters").select("run_id, user_id, status"),
    ]).then(([r, e]) =>
      setData({
        runs: (r.data as RunsData["runs"]) ?? [],
        encounters: (e.data as RunsData["encounters"]) ?? [],
        loaded: true,
      }),
    );
  }, []);
  return data;
}
