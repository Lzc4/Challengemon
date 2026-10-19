"use client";

import Link from "next/link";
import GameCover from "@/components/GameCover";
import Nav from "@/components/Nav";
import { CATALOG, catalogFor, SUPPORT_LABEL } from "@/lib/catalog";
import { SYSTEMS } from "@/lib/games";
import { useRunsData } from "@/lib/useRunsData";
import { useEffect, useState } from "react";
import { myLibrary } from "@/lib/storage";
import type { LibraryRom } from "@/lib/types";

export default function GamesPage() {
  const { runs, loaded } = useRunsData();
  const [games, setGames] = useState<LibraryRom[]>([]);
  useEffect(() => {
    myLibrary().then(setGames);
  }, []);

  const rows = CATALOG.map((entry) => {
    const uploaded = games.filter((g) => catalogFor(g.game_code)?.id === entry.id);
    const own = runs.filter((r) => catalogFor(r.game_code)?.id === entry.id);
    return {
      entry,
      uploaded,
      tries: own.length,
      won: own.filter((r) => r.result === "won").length,
      lost: own.filter((r) => r.result === "lost").length,
      active: own.find((r) => !r.ended_at) ?? null,
    };
  });

  const done = rows.filter((r) => r.won > 0).length;

  return (
    <>
      <Nav />
      <main className="container stack">
        <div className="row">
          <h1 style={{ margin: 0, marginRight: "auto" }}>Spiele</h1>
          <span className="badge good">
            {done} / {CATALOG.length} geschafft
          </span>
        </div>
        <div className="progress">
          <div style={{ width: `${(done / CATALOG.length) * 100}%` }} />
        </div>

        {[1, 2, 3, 4, 5].map((gen) => (
          <section key={gen} className="stack">
            <h2 className="section-title">Generation {gen}</h2>
            <div className="grid">
              {rows
                .filter((r) => r.entry.gen === gen)
                .map(({ entry, uploaded, tries, won, lost, active }) => (
                  <div key={entry.id} className={`card stack game-card${won ? " won" : ""}`}>
                    <GameCover id={entry.id} />
                    <div className="row">
                      <strong style={{ marginRight: "auto" }}>{entry.title}</strong>
                      {won > 0 && <span className="game-check" title="Geschafft">✓</span>}
                    </div>
                    <span className="small muted">
                      {SYSTEMS[entry.system].label} · {entry.region} · {entry.year}
                    </span>
                    <div className="row" style={{ gap: 6 }}>
                      <span className={`badge ${entry.support === "full" ? "good" : ""}`}>{SUPPORT_LABEL[entry.support]}</span>
                      {uploaded.length ? <span className="badge info">In deiner Bibliothek</span> : <span className="badge warn">Nicht in der Bibliothek</span>}
                    </div>
                    <div className="game-stats">
                      <span>
                        <b>{tries}</b> Versuche
                      </span>
                      <span>
                        <b>{won}</b> geschafft
                      </span>
                      <span>
                        <b>{lost}</b> verloren
                      </span>
                    </div>
                    {active ? (
                      <Link href={`/runs/${active.id}`} className="small">
                        Aktueller Run: {active.name} →
                      </Link>
                    ) : uploaded.length ? (
                      <Link href={`/runs/new?code=${uploaded[0].game_code}`} className="small">
                        Neuen Run starten →
                      </Link>
                    ) : (
                      <Link href="/library" className="small">
                        Zur Bibliothek hinzufügen →
                      </Link>
                    )}
                  </div>
                ))}
            </div>
          </section>
        ))}
        {!loaded && <p className="muted">Lädt…</p>}
      </main>
    </>
  );
}
