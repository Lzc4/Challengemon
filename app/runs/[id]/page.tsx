"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Nav from "@/components/Nav";
import Tracker from "@/components/Tracker";
import TeamView from "@/components/TeamView";
import TownMap, { PLAYER_COLORS } from "@/components/TownMap";
import { useHgssAssets } from "@/lib/rom/assets";
import BattleCamView from "@/components/BattleCamView";
import { gen4Game } from "@/lib/save/gen4";
import { mergeLive, useSaveSummaries } from "@/lib/useParsedSaves";
import { MODE_LABEL, StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase/client";
import { timeAgo, useProfiles, useUser } from "@/lib/hooks";
import { downloadSave, myLibrary, removeMyRunFiles } from "@/lib/storage";
import { catalogFor } from "@/lib/catalog";
import RandomizerPanel from "@/components/RandomizerPanel";
import ChatDock from "@/components/ChatDock";
import LegalFooter from "@/components/LegalFooter";
import type { Encounter, LibraryRom, LiveStatus, RunWithRelations, SaveRow } from "@/lib/types";

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const user = useUser();
  const profiles = useProfiles();
  const [run, setRun] = useState<RunWithRelations | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [saves, setSaves] = useState<SaveRow[]>([]);
  const [live, setLive] = useState<LiveStatus[]>([]);
  const [watching, setWatching] = useState<string | null>(null);
  const [camScreens, setCamScreens] = useState<"both" | "top">("both");
  const [ending, setEnding] = useState(false);
  const [library, setLibrary] = useState<LibraryRom[]>([]);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string; bad: boolean }[]>([]);
  const known = useRef<Map<string, Encounter> | null>(null);

  const loadRun = useCallback(async () => {
    const { data } = await supabase().from("runs").select("*, run_players(*)").eq("id", id).maybeSingle();
    setRun(data as RunWithRelations | null);
  }, [id]);

  const loadEncounters = useCallback(async () => {
    const { data } = await supabase().from("encounters").select("*").eq("run_id", id).order("created_at");
    setEncounters((data as Encounter[]) ?? []);
  }, [id]);

  const loadLive = useCallback(async () => {
    const { data } = await supabase().from("live_status").select("*").eq("run_id", id);
    setLive((data as LiveStatus[]) ?? []);
  }, [id]);

  const pushToast = useCallback((text: string, bad: boolean) => {
    const tid = Date.now() + Math.random();
    setToasts((cur) => [...cur, { id: tid, text, bad }]);
    setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== tid)), 8000);
  }, []);

  const loadSaves = useCallback(async () => {
    const { data } = await supabase().from("saves").select("*").eq("run_id", id).order("created_at", { ascending: false }).limit(100);
    setSaves((data as SaveRow[]) ?? []);
  }, [id]);

  useEffect(() => {
    loadRun();
    loadEncounters();
    loadSaves();
    loadLive();
    myLibrary().then(setLibrary);
    const channel = supabase()
      .channel(`run-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "encounters", filter: `run_id=eq.${id}` }, loadEncounters)
      .on("postgres_changes", { event: "*", schema: "public", table: "saves", filter: `run_id=eq.${id}` }, loadSaves)
      .on("postgres_changes", { event: "*", schema: "public", table: "runs", filter: `id=eq.${id}` }, loadRun)
      .on("postgres_changes", { event: "*", schema: "public", table: "run_players", filter: `run_id=eq.${id}` }, loadRun)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_status", filter: `run_id=eq.${id}` }, loadLive)
      .subscribe();
    return () => {
      supabase().removeChannel(channel);
    };
  }, [id, loadRun, loadEncounters, loadSaves, loadLive]);

  const players = useMemo(
    () => profiles.filter((p) => run?.run_players.some((rp) => rp.user_id === p.id)),
    [profiles, run],
  );

  const game = gen4Game(run?.game_code ?? null);
  const saveView = game !== null;
  const assets = useHgssAssets(saveView ? run?.game_code : null);
  const parsed = useSaveSummaries(id);

  useEffect(() => {
    const prev = known.current;
    known.current = new Map(encounters.map((e) => [e.id, e]));
    if (!prev || !user) return;
    for (const e of encounters) {
      if (e.user_id === user.id) continue;
      const who = profiles.find((p) => p.id === e.user_id)?.name ?? "?";
      const name = e.nickname || e.species || "Pokémon";
      const before = prev.get(e.id);
      if (!before && e.status === "caught") pushToast(`${who}: ${name} auf ${e.location} gefangen`, false);
      if (!before && e.status === "missed") pushToast(`${who}: Begegnung auf ${e.location} verpasst`, false);
      if (e.status === "dead" && before?.status !== "dead") pushToast(`${who}: ${name} (${e.location}) ist gestorben ☠`, true);
    }
  }, [encounters, user, profiles, pushToast]);

  const latest = (userId: string, kind: "sram" | "state") => saves.find((s) => s.user_id === userId && s.kind === kind) ?? null;

  async function finish(result: "won" | "lost" | null, by: string | null = null) {
    if (!run) return;
    const name = profiles.find((p) => p.id === by)?.name;
    const patch =
      result === null
        ? { ended_at: null, end_reason: null, result: null, ended_by: null }
        : {
            ended_at: new Date().toISOString(),
            result,
            ended_by: by,
            end_reason: result === "won" ? "Geschafft! 🏆" : name ? `Verloren durch ${name}.` : "Verloren.",
          };
    await supabase().from("runs").update(patch).eq("id", run.id);
    setEnding(false);
    loadRun();
  }

  async function downloadSav(userId: string) {
    const row = latest(userId, "sram");
    if (!row) return;
    const data = await downloadSave(row);
    const name = profiles.find((p) => p.id === userId)?.name ?? "save";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data as BlobPart]));
    a.download = `${run?.name ?? "run"}-${name}.sav`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function deleteRun() {
    if (!run || !user) return;
    const owner = run.created_by === user.id;
    const question = owner
      ? `Run „${run.name}“ für alle löschen? Deine Spielstände und Patches werden aus deinem Speicher entfernt.`
      : `Run „${run.name}“ verlassen? Deine Spielstände und Patches werden aus deinem Speicher entfernt.`;
    if (!confirm(question)) return;
    await removeMyRunFiles(run.id, user.id);
    if (owner) await supabase().from("runs").delete().eq("id", run.id);
    else await supabase().rpc("leave_run", { run: run.id });
    window.location.href = "/";
  }

  async function copyInvite() {
    if (!run) return;
    await navigator.clipboard.writeText(`${window.location.origin}/join/${run.invite_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!run) {
    return (
      <>
        <Nav />
        <main className="container muted">Lädt…</main>
      </>
    );
  }

  const mine = user ? run.run_players.find((p) => p.user_id === user.id) ?? null : null;
  const isPlayer = !!mine;
  const canPlay = !!mine && (run.randomize === "none" || mine.status === "ready");
  const title = catalogFor(run.game_code)?.title ?? run.game_code;

  return (
    <>
      <Nav />
      <main className="container stack">
        <div className="row">
          <h1 style={{ margin: 0 }}>{run.name}</h1>
          {mine && run.randomize !== "none" && <StatusBadge status={mine.status} />}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {title} · {MODE_LABEL[run.mode]}
          {run.randomize === "shared" ? " · Randomized (gleiche ROM)" : run.randomize === "individual" ? " · Randomized (eigene ROMs)" : ""}
          {run.honor_mode ? " · Ehrenmodus" : ""}
        </p>

        {run.ended_at && (
          <div className={`card ended${run.result === "won" ? " won" : ""}`}>
            <strong>{run.result === "won" ? "🏆 Run geschafft!" : "🏁 Run beendet"}</strong>
            <span>
              {run.end_reason ?? "Der Run ist vorbei."} · {timeAgo(run.ended_at)}
            </span>
            {run.archived_at ? (
              <span className="small muted">Archiviert: ROMs und Zwischenstände sind gelöscht, Tracker und Statistik bleiben.</span>
            ) : (
              <div className="row">
                <button onClick={() => finish(null)}>Run fortsetzen</button>
                <span className="small muted">Wird einen Tag nach dem Ende automatisch archiviert.</span>
              </div>
            )}
          </div>
        )}

        {!run.ended_at && run.run_players.length < run.max_players && (
          <div className="card stack">
            <strong>Mitspieler einladen</strong>
            <span className="small muted">
              {run.run_players.length} von {run.max_players} Spielern. Schick diesen Link an deine Mitspieler, sie brauchen das Spiel in ihrer eigenen
              Bibliothek.
            </span>
            <div className="row">
              <input readOnly value={typeof window !== "undefined" ? `${window.location.origin}/join/${run.invite_code}` : ""} onFocus={(e) => e.target.select()} />
              <button onClick={copyInvite}>{copied ? "Kopiert ✓" : "Link kopieren"}</button>
            </div>
          </div>
        )}

        <RandomizerPanel run={run} me={mine} library={library} profiles={profiles} onChange={loadRun} />

        <div className="row">
          {canPlay && !run.archived_at && (
            <Link href={`/play/${run.id}`} className="button primary">
              Spielen
            </Link>
          )}
          {!run.ended_at && (
            <button onClick={() => setEnding(!ending)} style={{ marginLeft: "auto" }}>
              Run beenden
            </button>
          )}
          <button className="danger" onClick={deleteRun} style={run.ended_at ? { marginLeft: "auto" } : undefined}>
            {user && run.created_by === user.id ? "Run löschen" : "Run verlassen"}
          </button>
        </div>

        {isPlayer && user && !run.archived_at && saves.some((sv) => sv.user_id === user.id) && (
          <details className="card stack" id="wiederherstellen">
            <summary>
              <strong>Spielstand wiederherstellen</strong>
            </summary>
            <span className="muted small">
              Kommst du nicht mehr ins Spiel, starte mit einem älteren Fortsetzungs-Stand oder nur mit deinem Ingame-Spielstand (letzter Speicherpunkt im Spiel).
            </span>
            <div className="restore-list">
              <Link href={`/play/${run.id}?state=none`} className="button">
                Nur Ingame-Spielstand
              </Link>
              {saves
                .filter((sv) => sv.user_id === user.id && sv.kind === "state")
                .map((sv, i) => (
                  <Link key={sv.id} href={`/play/${run.id}?state=${sv.id}`} className="button">
                    {i === 0 ? "Neuester · " : ""}
                    {new Date(sv.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {sv.size ? ` · ${(sv.size / 1024 / 1024).toFixed(1)} MB` : ""}
                  </Link>
                ))}
            </div>
          </details>
        )}

        {ending && !run.ended_at && (
          <div className="card stack">
            <strong>Wie ist der Run ausgegangen?</strong>
            <div className="row">
              <button className="primary" onClick={() => finish("won")}>
                🏆 Geschafft!
              </button>
              {players.map((p) => (
                <button key={p.id} onClick={() => finish("lost", p.id)}>
                  💀 Verloren durch {p.name}
                </button>
              ))}
              <button onClick={() => finish("lost", null)}>Verloren (keiner schuld)</button>
              <button onClick={() => setEnding(false)}>Abbrechen</button>
            </div>
          </div>
        )}

        <div className="grid">
          {players.map((p) => {
            const sram = latest(p.id, "sram");
            const state = latest(p.id, "state");
            return (
              <div key={p.id} className="card stack">
                <strong>{p.name}</strong>
                <span className="small muted">Ingame-Save: {timeAgo(sram?.created_at)}</span>
                <span className="small muted">Fortsetzungs-Stand: {timeAgo(state?.created_at)}</span>
                {sram && user?.id === p.id && (
                  <div>
                    <button onClick={() => downloadSav(p.id)}>.sav herunterladen</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {saveView && live.some((l) => l.map_id !== null) && (
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Live-Karte</h2>
            <TownMap
              game={game ?? "hgss"}
              mapUrl={assets.mapUrl}
              players={players.map((p, i) => ({
                id: p.id,
                name: p.name,
                color: PLAYER_COLORS[i % PLAYER_COLORS.length],
                mapId: live.find((l) => l.user_id === p.id)?.map_id ?? null,
                posX: live.find((l) => l.user_id === p.id)?.pos_x ?? null,
                posY: live.find((l) => l.user_id === p.id)?.pos_y ?? null,
              }))}
            />
          </div>
        )}

        {user && players.length > 1 && (
          <div className="card stack">
            <div className="row">
              <h2 style={{ margin: 0, marginRight: "auto" }}>Battlecam</h2>
              {players
                .filter((p) => p.id !== user.id)
                .map((p) => (
                  <button key={p.id} type="button" className={watching === p.id ? "primary" : ""} onClick={() => setWatching(watching === p.id ? null : p.id)}>
                    {watching === p.id ? "Schließen" : `${p.name} zuschauen`}
                  </button>
                ))}
            </div>
            {watching && (
              <>
                <div className="row">
                  <button type="button" className={camScreens === "both" ? "primary" : ""} onClick={() => setCamScreens("both")}>
                    Beide Bildschirme
                  </button>
                  <button type="button" className={camScreens === "top" ? "primary" : ""} onClick={() => setCamScreens("top")}>
                    Nur oben
                  </button>
                </div>
                <div style={{ maxWidth: camScreens === "top" ? 640 : 420 }}>
                  <BattleCamView
                    runId={run.id}
                    me={user.id}
                    target={watching}
                    name={players.find((p) => p.id === watching)?.name ?? "?"}
                    screens={camScreens}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {saveView && <TeamView players={players} saves={saves} parsed={parsed} live={live} game={game ?? "hgss"} runId={id} />}

        <Tracker
          run={run}
          gameCode={run.game_code}
          players={players}
          encounters={encounters}
          userId={user?.id ?? null}
          mySave={
            user
              ? mergeLive(
                  parsed[user.id]?.save ?? null,
                  live.find((l) => l.user_id === user.id),
                  saves.find((s) => s.user_id === user.id && s.kind === "sram")?.created_at,
                  game ?? "hgss",
                )
              : null
          }
          onChange={loadEncounters}
        />
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast${t.bad ? " bad" : ""}`}>
              {t.text}
            </div>
          ))}
        </div>
      </main>
      {isPlayer && <ChatDock runId={run.id} />}
      <LegalFooter />
    </>
  );
}
