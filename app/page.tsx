"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import GameCover from "@/components/GameCover";
import MonSprite from "@/components/MonSprite";
import { StatusBadge, MODE_LABEL } from "@/components/StatusBadge";
import { shortTitle } from "@/components/GameCover";
import { PLAYER_COLORS } from "@/components/TownMap";
import { supabase } from "@/lib/supabase/client";
import { timeAgo, useMyProfile, useProfiles, useUser } from "@/lib/hooks";
import LegalFooter from "@/components/LegalFooter";
import { CATALOG, catalogFor } from "@/lib/catalog";
import { gen4Game, speciesId } from "@/lib/save/gen4";
import { mapInfo } from "@/lib/save/maps";
import type { Encounter, LiveStatus, RunWithRelations } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Noch wach";
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Hey";
  return "Guten Abend";
}

export default function Dashboard() {
  const user = useUser();
  const myProfile = useMyProfile();
  const profiles = useProfiles();
  const [runs, setRuns] = useState<RunWithRelations[]>([]);
  const [live, setLive] = useState<LiveStatus[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const client = supabase();
    Promise.all([
      client.from("runs").select("*, run_players(*)").order("created_at", { ascending: false }),
      client.from("live_status").select("*"),
      client.from("encounters").select("*").order("created_at", { ascending: false }),
    ]).then(([r, l, e]) => {
      setRuns((r.data as RunWithRelations[]) ?? []);
      setLive((l.data as LiveStatus[]) ?? []);
      setEncounters((e.data as Encounter[]) ?? []);
      setLoaded(true);
    });
  }, []);

  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? "?";
  const colorOf = (id: string) => PLAYER_COLORS[Math.max(0, profiles.findIndex((p) => p.id === id)) % PLAYER_COLORS.length];
  const me = user?.id ?? null;
  const myName = myProfile?.name ?? "";

  const active = runs.filter((r) => !r.ended_at && !r.archived_at);
  const finished = runs.filter((r) => r.ended_at || r.archived_at);
  const playable = (r: RunWithRelations) => r.run_players.some((p) => p.user_id === me && (r.randomize === "none" || p.status === "ready"));
  const continueRun = active.find(playable);

  const stats = useMemo(() => {
    const wonGames = new Set(runs.filter((r) => r.result === "won").map((r) => catalogFor(r.game_code)?.id).filter(Boolean));
    return {
      active: active.length,
      won: wonGames.size,
      caught: encounters.filter((e) => e.status !== "missed").length,
      dead: encounters.filter((e) => e.status === "dead").length,
      tries: runs.length,
    };
  }, [runs, encounters, active.length]);

  const runName = (id: string) => runs.find((r) => r.id === id)?.name ?? "";
  const feed = encounters.filter((e) => e.status !== "missed").slice(0, 10);

  return (
    <>
      <Nav />
      <main className="container stack">
        <section className="hero">
          <div className="hero-text stack">
            <span className="hero-kicker">Challengemon</span>
            <h1 className="hero-title">
              {greeting()}
              {myName ? `, ${myName}` : ""}!
            </h1>
            <p className="hero-sub">
              {active.length
                ? `${active.length} ${active.length === 1 ? "Run läuft" : "Runs laufen"} gerade. Zeit, weiterzumachen.`
                : "Gerade läuft kein Run. Such dir ein Spiel aus und leg los."}
            </p>
            <div className="row">
              {continueRun && (
                <Link href={`/play/${continueRun.id}`} className="button primary">
                  ▶ Weiterspielen
                </Link>
              )}
              <Link href="/runs/new" className={`button${continueRun ? "" : " primary"}`}>
                + Neuer Run
              </Link>
              <Link href="/library" className="button">
                Bibliothek
              </Link>
            </div>
          </div>
          <div className="hero-mon">{continueRun && <GameCover code={continueRun.game_code} size="lg" />}</div>
        </section>

        <div className="stat-tiles">
          <div className="stat-tile">
            <b>{stats.active}</b>
            <span>aktive Runs</span>
          </div>
          <div className="stat-tile">
            <b>
              {stats.won}/{CATALOG.length}
            </b>
            <span>Spiele geschafft</span>
          </div>
          <div className="stat-tile">
            <b>{stats.caught}</b>
            <span>Pokémon gefangen</span>
          </div>
          <div className="stat-tile bad">
            <b>{stats.dead}</b>
            <span>gefallen</span>
          </div>
          <div className="stat-tile">
            <b>{stats.tries}</b>
            <span>Versuche</span>
          </div>
        </div>

        <h2 className="section-title">Aktive Runs</h2>
        {loaded && !active.length && (
          <div className="card empty-state">
            <div className="stack">
              <strong>Hier schläft gerade alles.</strong>
              <span className="muted">Starte einen neuen Run und die Teams tauchen hier live auf.</span>
              <Link href="/runs/new" className="button primary" style={{ alignSelf: "flex-start" }}>
                + Neuer Run
              </Link>
            </div>
          </div>
        )}
        <div className="active-runs">
          {active.map((r) => {
            const game = gen4Game(r.game_code);
            const mine = r.run_players.find((p) => p.user_id === me);
            return (
              <div key={r.id} className="card active-run">
                <GameCover code={r.game_code} size="lg" />
                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <div className="row">
                    <Link href={`/runs/${r.id}`} className="active-run-name">
                      {r.name}
                    </Link>
                    {mine && r.randomize !== "none" && <StatusBadge status={mine.status} />}
                  </div>
                  <span className="muted small">
                    {shortTitle(catalogFor(r.game_code)?.title ?? r.game_code)} · {MODE_LABEL[r.mode]}
                    {r.randomize !== "none" ? " · Randomized" : ""} · gestartet {timeAgo(r.created_at)}
                  </span>
                  <div className="run-players">
                    {r.run_players.map((p) => {
                      const row = live.find((l) => l.run_id === r.id && l.user_id === p.user_id);
                      const info = game && row ? mapInfo(game, row.map_id, row.pos_x, row.pos_y) : null;
                      const deaths = encounters.filter((e) => e.run_id === r.id && e.user_id === p.user_id && e.status === "dead").length;
                      const party = row?.party ?? [];
                      return (
                        <div key={p.user_id} className="run-player">
                          <div className="row" style={{ gap: 8 }}>
                            <span className="tm-dot" style={{ background: colorOf(p.user_id) }} />
                            <strong>{nameOf(p.user_id)}</strong>
                            {deaths > 0 && <span className="small" style={{ color: "var(--bad)" }}>✝ {deaths}</span>}
                            <span className="muted small" style={{ marginLeft: "auto" }}>
                              {row ? timeAgo(row.updated_at) : "noch nicht gespielt"}
                            </span>
                          </div>
                          <div className="run-party">
                            {party.length
                              ? party.map((m, i) => (
                                  <span key={`${m.pid}-${i}`} className="party-slot" title={`${m.nickname} · Lv. ${m.level}`}>
                                    <MonSprite species={m.species} isEgg={m.isEgg} fainted={m.hp === 0 && !m.isEgg} game={game} />
                                    <span className="party-lv">{m.isEgg ? "Ei" : m.level}</span>
                                  </span>
                                ))
                              : Array.from({ length: 6 }, (_, i) => <span key={i} className="party-empty" />)}
                          </div>
                          {info && <span className="small muted">📍 {info.name}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="row">
                    {playable(r) && (
                      <Link href={`/play/${r.id}`} className="button primary">
                        ▶ Spielen
                      </Link>
                    )}
                    <Link href={`/runs/${r.id}`} className="button">
                      Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {feed.length > 0 && (
          <>
            <h2 className="section-title">Letzte Ereignisse</h2>
            <div className="card feed">
              {feed.map((e) => {
                const id = e.species ? speciesId(e.species) : null;
                return (
                  <div key={e.id} className={`feed-row${e.status === "dead" ? " dead" : ""}`}>
                    {id ? <MonSprite species={id} size={44} fainted={e.status === "dead"} game={gen4Game(runs.find((r) => r.id === e.run_id)?.game_code ?? null)} /> : <span className="party-empty" />}
                    <span className="feed-text">
                      <b style={{ color: colorOf(e.user_id) }}>{nameOf(e.user_id)}</b>{" "}
                      hat{" "}
                      <b>{e.nickname || e.species || "ein Pokémon"}</b>
                      {e.status === "dead" ? " verloren" : " gefangen"}
                      <span className="muted"> · {e.location}</span>
                    </span>
                    <span className="muted small feed-meta">
                      {runName(e.run_id)} · {timeAgo(e.updated_at ?? e.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {finished.length > 0 && (
          <>
            <h2 className="section-title">Beendete Runs</h2>
            <div className="finished-runs">
              {finished.map((r) => (
                <Link key={r.id} href={`/runs/${r.id}`} className={`card finished-run${r.result === "won" ? " won" : ""}`} style={{ color: "inherit" }}>
                  <GameCover code={r.game_code} size="xs" />
                  <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <div className="row">
                    <strong>{r.name}</strong>
                    {r.result === "won" ? <span className="badge good">🏆 geschafft</span> : <span className="badge bad">verloren</span>}
                  </div>
                  <span className="muted small">
                    {shortTitle(catalogFor(r.game_code)?.title ?? r.game_code)} · {MODE_LABEL[r.mode]}
                  </span>
                  <span className="small">{r.run_players.map((p) => nameOf(p.user_id)).join(" & ")}</span>
                  {r.end_reason && <span className="muted small">{r.end_reason}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <LegalFooter />
    </>
  );
}
