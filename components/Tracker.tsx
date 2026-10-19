"use client";

import MonSprite from "@/components/MonSprite";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { locationsFor } from "@/lib/games";
import { SPECIES_NAMES, gen4Game, type Gen4Save, type Mon } from "@/lib/save/gen4";
import { autoTrack, computeSuggestions, ignoredKey, readIgnored } from "@/lib/autoTrack";
import type { Encounter, EncounterStatus, Profile, Run } from "@/lib/types";

const STATUS_LABEL: Record<EncounterStatus, string> = {
  caught: "gefangen",
  dead: "tot",
  missed: "verpasst",
};

interface Props {
  run: Run;
  gameCode: string | null;
  players: Profile[];
  encounters: Encounter[];
  userId: string | null;
  mySave: Gen4Save | null;
  onChange: () => void;
}

export default function Tracker({ run, gameCode, players, encounters, userId, mySave, onChange }: Props) {
  const known = useMemo(() => locationsFor(gameCode), [gameCode]);
  const game = gen4Game(gameCode);
  const [location, setLocation] = useState("");
  const [species, setSpecies] = useState("");
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<EncounterStatus>("caught");
  const [error, setError] = useState<string | null>(null);
  const isPlayer = !!userId && players.some((p) => p.id === userId);
  const [ignored, setIgnored] = useState<number[]>([]);

  useEffect(() => {
    setIgnored(readIgnored(run.id, userId));
  }, [run.id, userId]);

  const suggestions = useMemo(
    () => computeSuggestions(mySave, encounters, userId, ignored),
    [mySave, userId, encounters, ignored],
  );

  useEffect(() => {
    if (!mySave || !userId) return;
    autoTrack(run.id, userId, mySave, encounters).then((added) => {
      if (added.length) onChange();
    });
  }, [mySave, userId, encounters, run.id, onChange]);

  useEffect(() => {
    if (!mySave || !userId || !mySave.party.length) return;
    const all = new Map([...mySave.boxes, ...mySave.party].map((m) => [m.pid, m]));
    const partyPids = new Set(mySave.party.map((m) => m.pid));
    const updates = encounters
      .filter((e) => e.user_id === userId && e.pid !== null && e.status === "caught")
      .map((e) => {
        const mon = all.get(Number(e.pid));
        const patch: Partial<Encounter> = {};
        const inParty = partyPids.has(Number(e.pid));
        if (e.in_party !== inParty) patch.in_party = inParty;
        if (mon && !mon.isEgg && mon.speciesName !== e.species) patch.species = mon.speciesName;
        if (mon && mon.isNicknamed && mon.nickname !== e.nickname) patch.nickname = mon.nickname;
        return { id: e.id, patch };
      })
      .filter((u) => Object.keys(u.patch).length);
    if (!updates.length) return;
    Promise.all(updates.map((u) => supabase().from("encounters").update(u.patch).eq("id", u.id))).then(onChange);
  }, [mySave, userId, encounters, onChange]);

  async function accept(loc: string, mon: Mon) {
    if (!userId) return;
    const { error } = await supabase().from("encounters").upsert(
      {
        run_id: run.id,
        user_id: userId,
        location: loc,
        species: mon.speciesName,
        nickname: mon.isNicknamed ? mon.nickname : null,
        status: "caught",
        pid: mon.pid,
        in_party: mySave?.party.some((m) => m.pid === mon.pid) ?? false,
      },
      { onConflict: "run_id,user_id,location" },
    );
    if (error) setError(error.message);
    onChange();
  }

  function ignore(pids: number[]) {
    if (!userId) return;
    const next = Array.from(new Set([...ignored, ...pids]));
    setIgnored(next);
    try {
      localStorage.setItem(ignoredKey(run.id, userId), JSON.stringify(next));
    } catch {}
  }

  const byKey = useMemo(() => {
    const m = new Map<string, Encounter>();
    for (const e of encounters) m.set(`${e.location}|${e.user_id}`, e);
    return m;
  }, [encounters]);

  const locations = useMemo(() => {
    const used = new Set(encounters.map((e) => e.location));
    const ordered = known.filter((l) => used.has(l));
    const extra = encounters
      .filter((e) => !known.includes(e.location))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => e.location);
    return [...ordered, ...Array.from(new Set(extra))];
  }, [encounters, known]);

  const openLocations = useMemo(() => {
    if (!userId) return known;
    return known.filter((l) => !byKey.has(`${l}|${userId}`));
  }, [known, byKey, userId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    const { error } = await supabase()
      .from("encounters")
      .upsert(
        {
          run_id: run.id,
          user_id: userId,
          location: location.trim(),
          species: species.trim() || null,
          nickname: nickname.trim() || null,
          status,
        },
        { onConflict: "run_id,user_id,location" },
      );
    if (error) {
      setError(error.message);
      return;
    }
    setLocation("");
    setSpecies("");
    setNickname("");
    setStatus("caught");
    onChange();
  }

  async function update(enc: Encounter, patch: Partial<Encounter>) {
    await supabase().from("encounters").update(patch).eq("id", enc.id);
    onChange();
  }

  async function remove(enc: Encounter) {
    if (!confirm(`Eintrag „${enc.location}“ löschen?`)) return;
    await supabase().from("encounters").delete().eq("id", enc.id);
    onChange();
  }

  function linkState(loc: string) {
    const list = players.map((p) => byKey.get(`${loc}|${p.id}`));
    if (list.some((e) => e?.status === "dead")) return <span className="badge bad">tot</span>;
    if (list.some((e) => e?.status === "missed")) return <span className="badge">Paar verloren</span>;
    if (list.every((e) => e?.status === "caught")) return <span className="badge good">verbunden</span>;
    return <span className="badge warn">wartet</span>;
  }

  function partyWarning(enc: Encounter) {
    if (run.mode !== "soullocke" || !enc.in_party) return null;
    const partners = players.filter((p) => p.id !== enc.user_id).map((p) => byKey.get(`${enc.location}|${p.id}`));
    if (partners.some((p) => !p?.in_party)) return <span className="small error"> Partner nicht im Team</span>;
    return null;
  }

  const stats = players.map((p) => {
    const mine = encounters.filter((e) => e.user_id === p.id);
    return {
      player: p,
      alive: mine.filter((e) => e.status === "caught").length,
      dead: mine.filter((e) => e.status === "dead").length,
      party: mine.filter((e) => e.in_party && e.status === "caught").length,
    };
  });

  return (
    <div className="stack">
      <div className="grid">
        {stats.map((s) => (
          <div key={s.player.id} className="card">
            <strong>{s.player.name}</strong>
            <div className="small muted">
              {s.alive} lebend · {s.dead} tot · Team {s.party}/6
            </div>
          </div>
        ))}
      </div>

      {isPlayer && suggestions.length > 0 && (
        <div className="card stack">
          <h2 style={{ margin: 0 }}>Welches war die erste Begegnung?</h2>
          <span className="small muted">
            Eindeutige Fänge werden automatisch eingetragen. Hier gibt es mehrere Pokémon vom selben Ort, wähle das richtige.
          </span>
          {suggestions.map(([loc, mons]) => (
            <div key={loc} className="row" style={{ gap: 8 }}>
              <strong style={{ minWidth: 140 }}>{loc}</strong>
              {mons.map((m) => (
                <button key={m.pid} type="button" onClick={() => accept(loc, m)} title="Übernehmen">
                  <MonSprite species={m.species} isEgg={m.isEgg} size={32} game={game} />
                  {m.isNicknamed ? `${m.nickname} (${m.speciesName})` : m.speciesName} · Lv. {m.metLevel}
                </button>
              ))}
              <button type="button" className="small" onClick={() => ignore(mons.map((m) => m.pid))}>
                ignorieren
              </button>
            </div>
          ))}
        </div>
      )}

      {isPlayer && (
        <form className="card stack" onSubmit={add}>
          <h2>Begegnung eintragen</h2>
          <div className="row">
            <label style={{ flex: "2 1 180px" }}>
              Ort
              <input type="text" list="locations" value={location} onChange={(e) => setLocation(e.target.value)} required />
              <datalist id="locations">
                {openLocations.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </label>
            <label style={{ flex: "2 1 140px" }}>
              Pokémon
              <input type="text" list="species" value={species} onChange={(e) => setSpecies(e.target.value)} />
              <datalist id="species">
                {SPECIES_NAMES.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
            <label style={{ flex: "2 1 140px" }}>
              Spitzname
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </label>
            <label style={{ flex: "1 1 120px" }}>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as EncounterStatus)}>
                <option value="caught">gefangen</option>
                <option value="missed">verpasst</option>
                <option value="dead">tot</option>
              </select>
            </label>
          </div>
          {error && <p className="error small">{error}</p>}
          <div>
            <button className="primary">Eintragen</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ort</th>
              {players.map((p) => (
                <th key={p.id}>{p.name}</th>
              ))}
              {run.mode === "soullocke" && <th>Soul Link</th>}
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => {
              const anyDead = players.some((p) => byKey.get(`${loc}|${p.id}`)?.status === "dead");
              return (
                <tr key={loc} className={anyDead ? "dead" : ""}>
                  <td>{loc}</td>
                  {players.map((p) => {
                    const enc = byKey.get(`${loc}|${p.id}`);
                    if (!enc) {
                      return (
                        <td key={p.id} className="muted small">
                          {p.id === userId ? (
                            <button type="button" onClick={() => setLocation(loc)}>
                              + eintragen
                            </button>
                          ) : (
                            "–"
                          )}
                        </td>
                      );
                    }
                    const mine = enc.user_id === userId;
                    return (
                      <td key={p.id}>
                        <div className={enc.status === "dead" ? "cell-dead" : enc.status === "missed" ? "cell-missed" : ""}>
                          {enc.nickname ? `${enc.nickname} ` : ""}
                          {enc.species ? <span className="muted">({enc.species})</span> : enc.status === "missed" ? "verpasst" : ""}
                        </div>
                        {mine ? (
                          <div className="row small" style={{ gap: 8, marginTop: 4 }}>
                            <select
                              value={enc.status}
                              onChange={(e) => update(enc, { status: e.target.value as EncounterStatus, in_party: e.target.value === "caught" ? enc.in_party : false })}
                            >
                              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                            {enc.status === "caught" && (
                              <label className="inline small">
                                <input type="checkbox" checked={enc.in_party} onChange={(e) => update(enc, { in_party: e.target.checked })} />
                                Team
                              </label>
                            )}
                            <button type="button" className="danger" onClick={() => remove(enc)}>
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="small muted">
                            {STATUS_LABEL[enc.status]}
                            {enc.in_party && enc.status === "caught" ? " · im Team" : ""}
                          </div>
                        )}
                        {partyWarning(enc)}
                      </td>
                    );
                  })}
                  {run.mode === "soullocke" && <td>{linkState(loc)}</td>}
                </tr>
              );
            })}
            {!locations.length && (
              <tr>
                <td colSpan={players.length + 2} className="muted">
                  Noch keine Begegnungen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
