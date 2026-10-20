"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { pickBase } from "@/lib/storage";
import { providerFor, type ProviderKind } from "@/lib/userStorage";
import { githubAccount } from "@/lib/randomizer/github";
import { randomizeHere, randomizeOnGithub, waitForGithub } from "@/lib/randomizer";
import { localRandomizerSupported } from "@/lib/randomizer/local";
import { StatusBadge } from "./StatusBadge";
import type { LibraryRom, Profile, RunPlayer, RunWithRelations } from "@/lib/types";

export default function RandomizerPanel({
  run,
  me,
  library,
  profiles,
  onChange,
}: {
  run: RunWithRelations;
  me: RunPlayer | null;
  library: LibraryRom[];
  profiles: Profile[];
  onChange: () => void;
}) {
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resumed = useRef(false);
  const base = me ? pickBase(library, run, me) : null;
  const remote = base ? !!providerFor(base.provider as ProviderKind)?.remoteRead : false;
  const gh = typeof window !== "undefined" ? githubAccount() : null;

  // nach reload einen laufenden github-job weiter beobachten
  useEffect(() => {
    if (!me || !base || resumed.current) return;
    if (me.status === "randomizing" && me.job?.startsWith("github:")) {
      resumed.current = true;
      const ctrl = new AbortController();
      waitForGithub(run, me, base, me.job.slice(7), setStage, ctrl.signal)
        .then(() => {
          setStage(null);
          onChange();
        })
        .catch((err) => {
          setStage(null);
          setError(err instanceof Error ? err.message : String(err));
          onChange();
        });
      return () => ctrl.abort();
    }
  }, [me, base, run, onChange]);

  async function go(method: "local" | "github") {
    if (!me || !base) return;
    setError(null);
    try {
      if (method === "local") {
        await randomizeHere(run, me, base, setStage);
      } else {
        const id = await randomizeOnGithub(run, me, base, setStage);
        await waitForGithub(run, me, base, id, setStage);
      }
      setStage(null);
      onChange();
    } catch (err) {
      setStage(null);
      setError(err instanceof Error ? err.message : String(err));
      onChange();
    }
  }

  if (run.randomize === "none") return null;

  const ready = run.run_players.filter((p) => p.status === "ready" && p.rom_crc32);
  const mismatch = run.randomize === "shared" && new Set(ready.map((p) => p.rom_crc32)).size > 1;
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? "?";
  const stuck = me?.status === "randomizing" && me.job === "local" && !stage;

  return (
    <div className="card stack">
      <div className="row">
        <h2 style={{ margin: 0, marginRight: "auto" }}>Randomizer</h2>
        <span className="small muted">
          {run.randomize === "shared" ? "Gleiche ROM für alle" : "Jeder seine eigene ROM"} · {run.settings_name ?? "Settings"} · UPR ZX{" "}
          {run.randomizer_version ?? ""}
        </span>
      </div>
      <div className="row">
        {run.run_players.map((p) => (
          <span key={p.user_id} className="row small" style={{ gap: 6 }}>
            {nameOf(p.user_id)} <StatusBadge status={p.status} />
          </span>
        ))}
      </div>
      {mismatch && (
        <p className="small error">
          Achtung: Die randomisierten ROMs unterscheiden sich. Wahrscheinlich habt ihr verschiedene Spielversionen (Sprache oder Revision). Ihr spielt
          dann nicht exakt dasselbe Spiel.
        </p>
      )}
      {me && !base && (
        <p className="small">
          Für dich fehlt das Spiel noch in deiner <Link href="/library">Bibliothek</Link>.
        </p>
      )}
      {me && base && (me.status !== "ready" || stage) && (
        <div className="stack">
          {stage ? (
            <span className="small">⏳ {stage}</span>
          ) : (
            <div className="row">
              {localRandomizerSupported() && (
                <button className="primary" onClick={() => go("local")}>
                  {me.status === "failed" || stuck ? "Erneut im Browser randomisieren" : "Im Browser randomisieren"}
                </button>
              )}
              {gh && remote && <button onClick={() => go("github")}>Über mein GitHub randomisieren</button>}
              {!gh && (
                <span className="small muted">
                  Schwaches Gerät? <Link href="/speicher">GitHub verbinden</Link>, dann läuft es online in deinem Account.
                </span>
              )}
              {gh && !remote && <span className="small muted">Für GitHub muss deine Basis-ROM in Google Drive oder S3 liegen.</span>}
            </div>
          )}
          <span className="small muted">
            Im Browser dauert das je nach Spiel 15–60 Sekunden. Gespeichert wird nur ein Patch von wenigen hundert KB in deinem Speicher.
          </span>
        </div>
      )}
      {me?.status === "failed" && me.error && !stage && <p className="small error">{me.error}</p>}
      {error && <p className="small error">{error}</p>}
    </div>
  );
}
