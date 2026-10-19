"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Nav from "@/components/Nav";
import LegalFooter from "@/components/LegalFooter";
import GameCover from "@/components/GameCover";
import { formatBytes } from "@/lib/hooks";
import { catalogFor, SUPPORT_LABEL } from "@/lib/catalog";
import { SYSTEMS } from "@/lib/games";
import { addToLibrary, hex, inspectRom, isCached, loadLibraryRom, myLibrary, removeFromLibrary, type RomInfo } from "@/lib/storage";
import { PROVIDER_LABEL, configuredKinds, useStorageKind, type ProviderKind } from "@/lib/userStorage";
import type { LibraryRom } from "@/lib/types";

export default function LibraryPage() {
  const active = useStorageKind();
  const [roms, setRoms] = useState<LibraryRom[]>([]);
  const [cached, setCached] = useState<Record<string, boolean>>({});
  const [kinds, setKinds] = useState<ProviderKind[]>(["local"]);
  const [target, setTarget] = useState<ProviderKind>("local");
  const [pending, setPending] = useState<{ info: RomInfo; data: Uint8Array } | null>(null);
  const [own, setOwn] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await myLibrary();
    setRoms(list);
    const flags: Record<string, boolean> = {};
    for (const r of list) flags[r.id] = await isCached(r.crc32);
    setCached(flags);
  }, []);

  useEffect(() => {
    void load();
    setKinds(configuredKinds());
    setTarget(active);
  }, [load, active]);

  async function pick(file: File | null) {
    setError(null);
    setPending(null);
    if (!file) return;
    try {
      setProgress(0);
      setPending(await inspectRom(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  }

  async function upload() {
    if (!pending) return;
    if (!own) {
      setError("Bitte bestätige, dass du das Original besitzt und die Datei selbst erstellt hast.");
      return;
    }
    setError(null);
    setProgress(0);
    try {
      await addToLibrary(pending.info, pending.data, target, (d, t) => setProgress(t ? d / t : 0));
      setPending(null);
      setOwn(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  }

  async function warm(r: LibraryRom) {
    setBusyId(r.id);
    setError(null);
    try {
      await loadLibraryRom(r, (d, t) => setProgress(t ? d / t : 0));
      setCached((c) => ({ ...c, [r.id]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
      setProgress(null);
    }
  }

  async function remove(r: LibraryRom) {
    if (!confirm(`„${r.title}“ aus deiner Bibliothek und aus ${PROVIDER_LABEL[r.provider as ProviderKind] ?? r.provider} löschen?`)) return;
    await removeFromLibrary(r);
    await load();
  }

  const entry = pending ? catalogFor(pending.info.code) : null;

  return (
    <>
      <Nav />
      <main className="container stack">
        <h1 style={{ margin: 0 }}>Bibliothek</h1>
        <p className="muted" style={{ margin: 0 }}>
          Hier liegen deine eigenen Spiele. Jede ROM wird nur einmal hochgeladen, in deinen Speicher ({PROVIDER_LABEL[active]}). Randomisierte Runs
          speichern nur einen kleinen Patch dazu. <Link href="/speicher">Speicher ändern</Link>
        </p>

        <div className="card stack">
          <strong>Spiel hinzufügen</strong>
          <input type="file" accept=".nds,.gba,.gbc,.gb" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          {pending && (
            <div className="stack">
              <div className="row new-run-game">
                <GameCover code={pending.info.code} size="sm" />
                <div className="stack" style={{ flex: 1 }}>
                  <strong>{pending.info.title}</strong>
                  <span className="small muted">
                    {SYSTEMS[pending.info.system].label} · {pending.info.code ?? "unbekannter Code"} · {formatBytes(pending.info.size)} · CRC32 {hex(pending.info.crc)}
                  </span>
                  <span className="small">{entry ? SUPPORT_LABEL[entry.support] : "Nicht im Katalog. Spielbar, aber ohne Tracker-Extras."}</span>
                </div>
              </div>
              <label>
                Ablegen in
                <select value={target} onChange={(e) => setTarget(e.target.value as ProviderKind)}>
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {PROVIDER_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline">
                <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} />
                <span className="small">
                  Ich besitze das Originalspiel, habe diese Sicherungskopie selbst erstellt und bin für die Datei allein verantwortlich. Ich teile sie
                  nicht mit anderen.
                </span>
              </label>
              <div className="row">
                <button className="primary" onClick={upload} disabled={progress !== null}>
                  {progress !== null ? `Lädt hoch… ${Math.round(progress * 100)} %` : "Zur Bibliothek hinzufügen"}
                </button>
                <button onClick={() => setPending(null)}>Abbrechen</button>
              </div>
            </div>
          )}
          {error && <p className="error small">{error}</p>}
        </div>

        <div className="grid">
          {roms.map((r) => (
            <div key={r.id} className="card stack">
              <GameCover code={r.game_code} />
              <strong>{r.title}</strong>
              <span className="small muted">
                {r.game_code ?? "?"} · {formatBytes(r.size)} · {PROVIDER_LABEL[r.provider as ProviderKind] ?? r.provider}
              </span>
              <span className="small">{cached[r.id] ? "✓ Auf diesem Gerät bereit" : "Wird beim ersten Spielen geladen"}</span>
              <div className="row">
                {catalogFor(r.game_code) && (
                  <Link href={`/runs/new?code=${r.game_code}`} className="button primary">
                    Neuer Run
                  </Link>
                )}
                {!cached[r.id] && (
                  <button onClick={() => warm(r)} disabled={busyId === r.id}>
                    {busyId === r.id ? `Lädt… ${Math.round((progress ?? 0) * 100)} %` : "Jetzt laden"}
                  </button>
                )}
                <button className="danger" onClick={() => remove(r)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}
          {!roms.length && <p className="muted">Noch keine Spiele. Füge oben deine erste ROM hinzu.</p>}
        </div>
      </main>
      <LegalFooter />
    </>
  );
}
