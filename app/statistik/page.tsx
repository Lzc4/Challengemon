"use client";

import Nav from "@/components/Nav";
import { catalogFor } from "@/lib/catalog";
import { useProfiles } from "@/lib/hooks";
import { useRunsData } from "@/lib/useRunsData";

export default function StatsPage() {
  const profiles = useProfiles();
  const { runs, encounters, loaded } = useRunsData();
  const finished = runs.filter((r) => r.result);
  const won = runs.filter((r) => r.result === "won").length;
  const lost = runs.filter((r) => r.result === "lost").length;

  const players = profiles
    .map((p) => {
      const mine = encounters.filter((e) => e.user_id === p.id);
      const played = runs.filter((r) => r.run_players.some((rp) => rp.user_id === p.id));
      return {
        p,
        losses: runs.filter((r) => r.result === "lost" && r.ended_by === p.id).length,
        deaths: mine.filter((e) => e.status === "dead").length,
        caught: mine.filter((e) => e.status !== "missed").length,
        runs: played.length,
      };
    })
    .sort((a, b) => b.losses - a.losses || b.deaths - a.deaths);
  const blame = players[0]?.losses ? players[0] : null;

  const perGame = new Map<string, { title: string; tries: number; won: number }>();
  for (const r of runs) {
    const title = catalogFor(r.game_code)?.title ?? r.game_code;
    const cur = perGame.get(title) ?? { title, tries: 0, won: 0 };
    cur.tries++;
    if (r.result === "won") cur.won++;
    perGame.set(title, cur);
  }

  return (
    <>
      <Nav />
      <main className="container stack">
        <h1>Statistik</h1>

        <div className="grid">
          <div className="card stat">
            <span className="stat-num">{runs.length}</span>
            <span>Runs gesamt</span>
          </div>
          <div className="card stat">
            <span className="stat-num good">{won}</span>
            <span>geschafft</span>
          </div>
          <div className="card stat">
            <span className="stat-num bad">{lost}</span>
            <span>verloren</span>
          </div>
          <div className="card stat">
            <span className="stat-num">{finished.length ? Math.round((won / finished.length) * 100) : 0}%</span>
            <span>Siegquote</span>
          </div>
        </div>

        {blame && (
          <div className="card blame">
            <span className="blame-crown">💀</span>
            <div>
              <strong>Pechvogel: {blame.p.name}</strong>
              <div className="small muted">
                {blame.losses} Run{blame.losses === 1 ? "" : "s"} verbockt · {blame.deaths} Pokémon begraben
              </div>
            </div>
          </div>
        )}

        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Spieler</th>
                <th>Runs</th>
                <th>Verbockt</th>
                <th>Tode</th>
                <th>Fänge</th>
                <th>Tode pro Run</th>
              </tr>
            </thead>
            <tbody>
              {players.map(({ p, losses, deaths, caught, runs: n }) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{n}</td>
                  <td>{losses}</td>
                  <td>{deaths}</td>
                  <td>{caught}</td>
                  <td>{n ? (deaths / n).toFixed(1) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Spiel</th>
                <th>Versuche</th>
                <th>Geschafft</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(perGame.values())
                .sort((a, b) => b.tries - a.tries)
                .map((g) => (
                  <tr key={g.title}>
                    <td>{g.title}</td>
                    <td>{g.tries}</td>
                    <td>{g.won ? "✓" : "–"}</td>
                  </tr>
                ))}
              {!perGame.size && (
                <tr>
                  <td colSpan={3} className="muted">
                    {loaded ? "Noch keine Runs." : "Lädt…"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
