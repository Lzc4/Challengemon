"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import GameCover, { shortTitle } from "@/components/GameCover";
import { MODE_LABEL } from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase/client";
import { catalogFor } from "@/lib/catalog";
import { myLibrary, sameGame } from "@/lib/storage";
import type { RunMode } from "@/lib/types";

interface Preview {
  id: string;
  name: string;
  game_code: string;
  mode: RunMode;
  randomize: string;
  players: number;
  max_players: number;
  host: string | null;
}

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [hasGame, setHasGame] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase()
      .rpc("run_preview", { code })
      .then(({ data }: { data: Preview[] | null }) => {
        const p = data?.[0] ?? null;
        setPreview(p);
        if (p) myLibrary().then((lib) => setHasGame(lib.some((l) => sameGame(l.game_code, p.game_code))));
      });
  }, [code]);

  async function join() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase().rpc("join_run", { code });
    if (error || !data) {
      setError(error?.message === "run is full" ? "Der Run ist schon voll." : error?.message ?? "Beitritt fehlgeschlagen");
      setBusy(false);
      return;
    }
    window.location.href = `/runs/${data}`;
  }

  const title = preview ? shortTitle(catalogFor(preview.game_code)?.title ?? preview.game_code) : "";

  return (
    <>
      <Nav />
      <main className="container stack">
        {preview === undefined && <p className="muted">Lädt…</p>}
        {preview === null && <div className="card">Diese Einladung ist ungültig oder der Run ist schon vorbei.</div>}
        {preview && (
          <div className="card stack">
            <div className="row new-run-game">
              <GameCover code={preview.game_code} size="lg" />
              <div className="stack" style={{ flex: 1 }}>
                <h1 style={{ margin: 0 }}>{preview.name}</h1>
                <span className="muted">
                  {preview.host ?? "Jemand"} lädt dich ein: {title} · {MODE_LABEL[preview.mode]}
                  {preview.randomize === "shared" ? " · gleiche Zufalls-ROM" : preview.randomize === "individual" ? " · eigene Zufalls-ROM" : ""}
                </span>
                <span className="small">
                  {preview.players} von {preview.max_players} Spielern dabei
                </span>
              </div>
            </div>
            {hasGame === false && (
              <p className="small error">
                Du brauchst {title} in deiner <Link href="/library">Bibliothek</Link>. Du kannst trotzdem schon beitreten und die ROM später hinzufügen.
              </p>
            )}
            {error && <p className="error small">{error}</p>}
            <div className="row">
              <button className="primary" onClick={join} disabled={busy || preview.players >= preview.max_players}>
                {busy ? "Trete bei…" : "Beitreten"}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
