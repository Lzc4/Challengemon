"use client";

import MonSprite from "@/components/MonSprite";
import { type Gen4Game, type Mon } from "@/lib/save/gen4";
import { timeAgo, useLevelCaps } from "@/lib/hooks";
import { nextLevelCap } from "@/lib/levelCaps";
import { mergeLive, type ParsedEntry } from "@/lib/useParsedSaves";
import type { LiveStatus, Profile, SaveRow } from "@/lib/types";

interface Props {
  players: Profile[];
  saves: SaveRow[];
  parsed: Record<string, ParsedEntry>;
  live: LiveStatus[];
  game: Gen4Game;
  runId: string;
}

function playtime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")} Std.`;
}

function MonCard({ mon, cap, game }: { mon: Mon; cap: number | null; game: Gen4Game }) {
  const pct = mon.maxHp ? Math.max(0, Math.min(100, (mon.hp / mon.maxHp) * 100)) : 0;
  const hpColor = pct > 50 ? "var(--good)" : pct > 20 ? "var(--accent)" : "var(--bad)";
  const name = mon.isEgg ? "Ei" : mon.isNicknamed ? mon.nickname : mon.speciesName;
  const overCap = cap !== null && !mon.isEgg && mon.level > cap;
  return (
    <div className="mon">
      <MonSprite species={mon.species} isEgg={mon.isEgg} size={64} game={game} title={mon.speciesName} />
      <div className="mon-body">
        <div className="row" style={{ gap: 6 }}>
          <strong>{name}</strong>
          {mon.gender && <span className="muted">{mon.gender === "m" ? "♂" : "♀"}</span>}
          {mon.shiny && <span title="Shiny">✦</span>}
          {!mon.isEgg && <span className={`small ${overCap ? "error" : "muted"}`}>Lv. {mon.level}</span>}
        </div>
        {!mon.isEgg && mon.isNicknamed && <div className="small muted">{mon.speciesName}</div>}
        {!mon.isEgg && (
          <>
            <div className="hp">
              <div style={{ width: `${pct}%`, background: hpColor }} />
            </div>
            <div className="small muted">
              {mon.hp}/{mon.maxHp} KP{mon.status ? ` · ${mon.status}` : ""}
              {mon.item ? ` · ${mon.item}` : ""}
            </div>
            <div className="small">{mon.moves.join(" · ")}</div>
            {mon.metLocationName && (
              <div className="small muted">
                gefangen: {mon.metLocationName} (Lv. {mon.metLevel})
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function TeamView({ players, saves, parsed, live, game, runId }: Props) {
  const [caps, setCaps] = useLevelCaps(runId);
  return (
    <div className="stack">
      <div className="row">
        <h2 className="section-title">Teams</h2>
        <label className="row small" style={{ marginLeft: "auto", gap: 6 }}>
          <input type="checkbox" checked={caps} onChange={(e) => setCaps(e.target.checked)} />
          Level-Caps
        </label>
      </div>
      <div className="teams">
        {players.map((p) => {
          const row = saves.find((s) => s.user_id === p.id && s.kind === "sram");
          const entry = parsed[p.id];
          const liveRow = live.find((l) => l.user_id === p.id);
          const save = mergeLive(entry?.save ?? null, liveRow, row?.created_at, game);
          const isLive = !!save && !!liveRow && save.party === liveRow.party;
          const cap = save && caps ? nextLevelCap(save) : null;
          const over = save && cap ? save.party.filter((m) => !m.isEgg && m.level > cap.level).length : 0;
          return (
            <div key={p.id} className="card stack">
              <div className="row">
                <strong>{p.name}</strong>
                {isLive && <span className="badge good">live</span>}
                {save && save.trainer && (
                  <span className="small muted">
                    {save.trainer} · Orden {save.badges + save.kantoBadges}/{save.game === "hgss" ? 16 : 8} · {playtime(save.playSeconds)} ·{" "}
                    {save.money.toLocaleString("de-DE")} ₽
                  </span>
                )}
              </div>
              {cap && (
                <span className={`small ${over ? "error" : "muted"}`}>
                  Level-Cap: {cap.level} ({cap.name}){over ? ` · ${over}× drüber` : ""}
                </span>
              )}
              {!row && !isLive && <span className="muted small">Noch kein Team gesehen. Es erscheint, sobald gespielt wird.</span>}
              {row && !entry && !isLive && <span className="muted small">Lädt…</span>}
              {entry?.error && !isLive && <span className="error small">{entry.error}</span>}
              {save && !save.party.length && <span className="muted small">Kein Team im Spielstand.</span>}
              {save && save.party.length > 0 && (
                <div className="mons">
                  {save.party.map((m, i) => (
                    <MonCard game={game} key={`${m.pid}-${i}`} mon={m} cap={cap?.level ?? null} />
                  ))}
                </div>
              )}
              {save && entry?.save && <span className="small muted">{save.boxes.length} Pokémon in den Boxen</span>}
              {isLive && liveRow && <span className="small muted">Team live aus dem Spiel, {timeAgo(liveRow.updated_at)}</span>}
              {row && <span className="small muted">Letztes Ingame-Speichern {timeAgo(row.created_at)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
