"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { myLibrary } from "@/lib/storage";
import { catalogFor } from "@/lib/catalog";
import { RANDOMIZER_VERSION, encodeSettings } from "@/lib/randomizer";
import type { LibraryRom, RandomizeMode, RunMode } from "@/lib/types";
import GameCover from "./GameCover";

const SETTINGS_KEY = (code: string) => `cm.settings:${code.slice(0, 3)}`;

export default function NewRunForm({ onCancel, initialCode }: { onCancel: () => void; initialCode?: string | null }) {
  const [library, setLibrary] = useState<LibraryRom[] | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RunMode>("soullocke");
  const [honor, setHonor] = useState(true);
  const [candies, setCandies] = useState(true);
  const [randomize, setRandomize] = useState<RandomizeMode>("shared");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [settings, setSettings] = useState<{ name: string; data: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    myLibrary().then((list) => {
      setLibrary(list);
      const preset = list.find((l) => l.game_code === initialCode) ?? list.find((l) => catalogFor(l.game_code));
      if (preset?.game_code) setCode(preset.game_code);
    });
  }, [initialCode]);

  const games = useMemo(() => {
    const seen = new Map<string, LibraryRom>();
    for (const l of library ?? []) if (l.game_code && !seen.has(l.game_code)) seen.set(l.game_code, l);
    return Array.from(seen.values());
  }, [library]);

  const game = games.find((g) => g.game_code === code) ?? null;

  useEffect(() => {
    if (!code) return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY(code));
      setSettings(raw ? JSON.parse(raw) : null);
    } catch {
      setSettings(null);
    }
  }, [code]);

  useEffect(() => {
    if (mode === "soullocke" && maxPlayers < 2) setMaxPlayers(2);
  }, [mode, maxPlayers]);

  async function pickSettings(file: File | null) {
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 4096) {
      setError("Das sieht nicht nach einer .rnqs-Datei aus.");
      return;
    }
    const next = { name: file.name, data: encodeSettings(bytes) };
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY(code), JSON.stringify(next));
    } catch {}
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!game) return;
    if (randomize !== "none" && !settings) {
      setError("Für den Randomizer brauchst du eine Settings-Datei (.rnqs) aus dem Universal Pokemon Randomizer ZX.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase().rpc("create_run", {
      payload: {
        name,
        system: game.system,
        game_code: game.game_code,
        mode,
        honor_mode: honor,
        rare_candies: candies,
        randomize,
        settings: randomize === "none" ? null : settings?.data,
        settings_name: randomize === "none" ? null : settings?.name,
        randomizer_version: randomize === "none" ? null : RANDOMIZER_VERSION,
        max_players: mode === "nuzlocke" || mode === "casual" ? maxPlayers : Math.max(2, maxPlayers),
      },
    });
    if (rpcError || !data) {
      setError(rpcError?.message ?? "Run konnte nicht angelegt werden");
      setBusy(false);
      return;
    }
    window.location.href = `/runs/${data}`;
  }

  if (library === null) return <p className="muted">Lädt…</p>;

  if (!games.length) {
    return (
      <div className="card">
        <p>
          Füge zuerst ein Spiel in deiner <Link href="/library">Bibliothek</Link> hinzu.
        </p>
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="row new-run-game">
        <GameCover code={code} size="lg" />
        <div className="stack" style={{ flex: 1 }}>
          <label>
            Spiel
            <select value={code} onChange={(e) => setCode(e.target.value)}>
              {games.map((g) => (
                <option key={g.game_code!} value={g.game_code!}>
                  {g.title} ({g.game_code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. HG Soullocke #1" required maxLength={60} />
          </label>
        </div>
      </div>
      <label>
        Modus
        <select value={mode} onChange={(e) => setMode(e.target.value as RunMode)}>
          <option value="soullocke">Soullocke (Soul Link, Tode werden gekoppelt)</option>
          <option value="nuzlocke">Nuzlocke</option>
          <option value="casual">Normal</option>
        </select>
      </label>
      <label>
        Spieler insgesamt
        <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
          {[1, 2, 3, 4, 6, 8]
            .filter((n) => mode !== "soullocke" || n >= 2)
            .map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Nur ich" : `${n} Spieler`}
              </option>
            ))}
        </select>
      </label>
      <label className="inline">
        <input type="checkbox" checked={honor} onChange={(e) => setHonor(e.target.checked)} />
        Ehrenmodus (nur letzten Stand fortsetzen, keine alten Stände laden)
      </label>
      <label className="inline">
        <input type="checkbox" checked={candies} onChange={(e) => setCandies(e.target.checked)} />
        999 Sonderbonbons automatisch in der Tasche
      </label>
      <label>
        Randomizer
        <select value={randomize} onChange={(e) => setRandomize(e.target.value as RandomizeMode)}>
          <option value="shared">Gleiche ROM für alle (gleicher Seed)</option>
          <option value="individual">Jeder bekommt seine eigene Zufalls-ROM</option>
          <option value="none">Ohne Randomizer</option>
        </select>
      </label>
      {randomize !== "none" && (
        <div className="stack">
          <span className="small muted">
            Jeder Spieler randomisiert später seine eigene ROM, im Browser oder über sein GitHub. Bei „gleiche ROM“ kommt bei allen exakt dasselbe
            Spiel heraus, wenn alle dieselbe Spielversion haben. Settings aus Universal Pokemon Randomizer ZX {RANDOMIZER_VERSION}.
          </span>
          <label>
            {settings ? `Settings: ${settings.name}. Andere Datei wählen:` : "Settings-Datei (.rnqs)"}
            <input type="file" accept=".rnqs" onChange={(e) => pickSettings(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      )}
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button className="primary" disabled={busy || !game}>
          {busy ? "Wird angelegt…" : "Run anlegen"}
        </button>
        <button type="button" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
