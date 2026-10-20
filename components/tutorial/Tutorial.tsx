"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";
import { configureStorage } from "@/lib/userStorage";
import { connectNextcloud } from "@/lib/userStorage/nextcloud";
import Dialog, { SoundToggle } from "./Dialog";
import { sfx } from "./sfx";
import PixelSprite from "./PixelSprite";
import { CHIPPY, KISTLING, PROFESSOR, RIVAL, RIVAL_NAME, WOLKINO, type Sprite } from "./sprites";

const DONE_KEY = "cm.tutorial.done";
export const MET_KEY = "cm.tutorial.met";
export const REPLAY_EVENT = "cm-tutorial-replay";

type Line = { text: string; spot?: string; rival?: boolean };

type StarterId = "local" | "cloud" | "nextcloud";

interface Starter {
  id: StarterId;
  name: string;
  type: string;
  sprite: Sprite;
  blurb: string;
  after: string;
  available: () => boolean;
}

const STARTERS: Starter[] = [
  {
    id: "local",
    name: "CHIPPY",
    type: "Gerät",
    sprite: CHIPPY,
    blurb: "Wohnt direkt in deinem Browser. Nichts verlässt dein Gerät, superschnell, aber eben nur auf diesem einen Gerät.",
    after: "Chippy bleibt bei dir auf diesem Gerät. Schnell und unkompliziert! Wenn du später auch am anderen PC spielen willst, kannst du unter Speicher jederzeit wechseln.",
    available: () => true,
  },
  {
    id: "cloud",
    name: "WOLKINO",
    type: "Wolke",
    sprite: WOLKINO,
    blurb: "Schwebt auf unserem Server und gehört zu deinem Konto. Sofort startklar, auf jedem Gerät. Platz für ein Spiel und alle deine Spielstände.",
    after: "Wolkino passt ab jetzt auf ein Spiel und deine Spielstände auf. Egal an welchem Gerät du dich einloggst, dein Fortschritt ist schon da!",
    available: () => true,
  },
  {
    id: "nextcloud",
    name: "KISTLING",
    type: "Server",
    sprite: KISTLING,
    blurb: "Zieht bei deiner eigenen Nextcloud ein. Open Source, auf allen Geräten verfügbar, und die Daten bleiben bei dir zuhause.",
    after: "Kistling hat sich in deiner Nextcloud ein gemütliches Plätzchen gesucht. Der Zugang gilt immer 24 Stunden, danach reicht ein Klick zum Verlängern.",
    available: () => true,
  },
];

function intro(name: string, met: boolean): Line[] {
  // wer sich gerade beim login schon vorgestellt hat, kriegt die begruessung nicht doppelt
  const hello: Line[] = met
    ? [{ text: `Da bist du ja, ${name}! Dann zeig ich dir mal, wie hier alles funktioniert.` }]
    : [
        { text: "Hallo! Willkommen in der Welt von CHALLENGEMON!" },
        { text: "Mein Name ist KIESEL. Alle nennen mich nur die Challenge-Professorin." },
        { text: `Und du bist also ${name}! Schön, dass du da bist.` },
      ];
  return [
    ...hello,
    { text: "Hier spielst du Nuzlocke- und Soullocke-Runs. Allein oder mit Freunden, direkt im Browser." },
    { text: "Die Regeln kennst du sicher: Pro Route darfst du nur die erste Begegnung fangen. Und wer besiegt wird, ist für immer weg." },
    { text: "Beim Soullocke seid ihr gekoppelt. Fällt dein Pokémon, fällt auch das deines Partners von derselben Route. Hart, aber fair!" },
    { text: "Eins noch vorweg: Spiele gibt es hier keine. Du bringst deine eigenen Sicherungskopien mit, von Spielen, die du selbst besitzt." },
    { spot: "bibliothek", text: "Hier ist deine BIBLIOTHEK. Da legst du deine Spiele ab, jedes nur ein einziges Mal." },
    { spot: "speicher", text: "Unter SPEICHER entscheidest du, wo deine Dateien wohnen. Unser Server bekommt sie nie zu sehen, versprochen!" },
    { spot: "runs", text: "Bei RUNS startest du neue Abenteuer und lädst Freunde einfach per Link ein." },
    { text: "Lust auf Chaos? Der RANDOMIZER würfelt Pokémon, Trainer und Items durcheinander. Und das direkt in deinem Browser!" },
    { text: "Beim Spielen siehst du dein Team live, eine Karte, die Level-Caps und den Chat mit deinen Mitspielern." },
    { spot: "spiele", text: "Unter SPIELE siehst du, welche Editionen du schon gemeistert hast." },
    { spot: "statistik", text: "Und die STATISTIK verrät, wer im Team die meisten Pokémon auf dem Gewissen hat…" },
    { spot: "statistik", rival: true, text: "Spoiler: Ich bin's nicht. Ich spiele nämlich fehlerfrei!" },
    { text: `Das sagt ${RIVAL_NAME} jedes Mal. Und dann kommt ein kritischer Treffer…` },
    { text: "So! Bevor es losgeht, brauchst du aber noch einen Partner." },
    { text: "Jedes dieser drei passt auf deine Spiele und Spielstände auf. Wenn du unsicher bist: Wolkino ist perfekt für den Anfang. Na los, such dir einen aus!" },
  ];
}

function Spotlight({ target }: { target?: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    const measure = () => setRect(document.querySelector(`[data-tour="${target}"]`)?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [target]);
  if (!rect) return <div className="tut-dim" />;
  const pad = 6;
  return (
    <div
      className="tut-spot"
      style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
    />
  );
}

export default function Tutorial() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Trainer");
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"talk" | "pick" | "confirm" | "server" | "after" | "end">("talk");
  const [server, setServer] = useState("");
  const [pick, setPick] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [met, setMet] = useState(false);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase()
      .auth.getUser()
      .then(async ({ data }: { data: { user: { id: string; user_metadata?: Record<string, unknown> } | null } }) => {
        const user = data.user;
        if (!alive || !user) return;
        userId.current = user.id;
        let local = false;
        try {
          local = localStorage.getItem(DONE_KEY) === user.id;
        } catch {}
        const { data: profile } = await supabase().from("profiles").select("name").eq("id", user.id).maybeSingle();
        if (!alive) return;
        if (profile?.name) setName(profile.name);
        try {
          setMet(sessionStorage.getItem(MET_KEY) === "1");
        } catch {}
        if (!user.user_metadata?.tutorial_done && !local) setOpen(true);
      });
    const replay = () => {
      setMet(false);
      setStep(0);
      setPhase("talk");
      setPick(1);
      setError(null);
      setOpen(true);
    };
    window.addEventListener(REPLAY_EVENT, replay);
    return () => {
      alive = false;
      window.removeEventListener(REPLAY_EVENT, replay);
    };
  }, []);

  const finish = useCallback(async (go?: string) => {
    try {
      if (userId.current) localStorage.setItem(DONE_KEY, userId.current);
      sessionStorage.removeItem(MET_KEY);
    } catch {}
    await supabase()
      .auth.updateUser({ data: { tutorial_done: true } })
      .catch(() => null);
    setOpen(false);
    if (go) window.location.href = go;
  }, []);

  useEffect(() => {
    if (phase !== "pick") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        sfx.move();
        setPick((p) => (p + 1) % STARTERS.length);
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        sfx.move();
        setPick((p) => (p + STARTERS.length - 1) % STARTERS.length);
      }
      if ((e.key === "Enter" || e.key === " ") && STARTERS[pick].available()) {
        e.preventDefault();
        sfx.next();
        setPhase("confirm");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, pick]);

  if (!open) return null;

  const lines = intro(name, met);
  const line = lines[step];
  const starter = STARTERS[pick];

  async function choose() {
    setError(null);
    try {
      if (starter.id === "local") configureStorage({ kind: "local" });
      if (starter.id === "cloud") configureStorage({ kind: "cloud" });
      if (starter.id === "nextcloud") return setPhase("server");
      setPhase("after");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("pick");
    }
  }

  async function connectServer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      configureStorage(await connectNextcloud(server));
      setPhase("after");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return createPortal(
    <div className="tut">
      <Spotlight target={phase === "talk" ? line?.spot : undefined} />
      <div className="tut-top">
        <SoundToggle />
        <button onClick={() => finish()}>Überspringen</button>
      </div>

      {(phase === "pick" || phase === "confirm") && (
        <div className="tut-starters">
          <div className="tut-table">
            {STARTERS.map((s, i) => (
              <button
                key={s.id}
                className={`tut-ball${i === pick ? " on" : ""}${s.available() ? "" : " off"}`}
                onClick={() => {
                  setPick(i);
                  if (s.available()) {
                    sfx.next();
                    setPhase("confirm");
                  } else sfx.back();
                }}
                onMouseEnter={() => {
                  if (phase !== "pick" || i === pick) return;
                  sfx.move();
                  setPick(i);
                }}
              >
                <PixelSprite sprite={s.sprite} scale={5} className={i === pick ? "tut-bounce" : ""} />
                <span className="tut-ball-name">{s.name}</span>
                <span className="tut-ball-type">Typ: {s.type}</span>
                {!s.available() && <span className="tut-ball-type">hier noch nicht verfügbar</span>}
              </button>
            ))}
          </div>
          <button className="link small tut-other" onClick={() => finish("/speicher")}>
            Lieber S3 oder WebDAV? Dann direkt zu den Speicher-Einstellungen
          </button>
        </div>
      )}

      <div className="tut-stage">
        <div className="tut-cast">
          <PixelSprite sprite={PROFESSOR} scale={7} className="tut-prof" />
          {phase === "talk" && line?.rival && <PixelSprite sprite={RIVAL} scale={7} className="tut-rival" />}
        </div>
        {phase === "talk" && line && (
          <Dialog
            key={step}
            who={line.rival ? RIVAL_NAME : undefined}
            text={line.text}
            onNext={() => {
              if (step + 1 < lines.length) setStep(step + 1);
              else setPhase("pick");
            }}
          />
        )}
        {phase === "pick" && (
          <Dialog key={`pick-${pick}-${error ?? ""}`} text={error ? `Oh, das hat nicht geklappt: ${error}` : `${starter.name}. ${starter.blurb}`} />
        )}
        {phase === "confirm" && (
          <Dialog key={`confirm-${pick}`} text={`Du willst also ${starter.name}, den Typ ${starter.type}?`}>
            <div className="tut-choice" onClick={(e) => e.stopPropagation()}>
              <button data-sfx="confirm" onClick={choose}>
                JA
              </button>
              <button data-sfx="back" onClick={() => setPhase("pick")}>
                NEIN
              </button>
            </div>
          </Dialog>
        )}
        {phase === "server" && (
          <Dialog
            key={`server-${error ?? ""}`}
            text={error ? `Hm, das hat nicht geklappt. ${error}` : "Wie lautet die Adresse deiner Nextcloud? Gleich geht ein Fenster auf, da meldest du dich ganz normal an."}
          >
            <form className="tut-form" onSubmit={connectServer}>
              <input placeholder="z. B. cloud.example.de" value={server} onChange={(e) => setServer(e.target.value)} required autoFocus />
              <div className="tut-form-row">
                <button
                  type="button"
                  data-sfx="back"
                  className="link small"
                  onClick={() => {
                    setError(null);
                    setPhase("pick");
                  }}
                >
                  Zurück
                </button>
                <button type="button" className="link small" onClick={() => finish("/speicher")}>
                  Noch nicht eingerichtet? Zur Anleitung
                </button>
                <button className="tut-go">VERBINDEN ▶</button>
              </div>
            </form>
          </Dialog>
        )}
        {phase === "after" && <Dialog key="after" text={starter.after} onNext={() => setPhase("end")} />}
        {phase === "end" && (
          <Dialog key="end" text={`Super! Als Nächstes legst du dein erstes Spiel in die Bibliothek. Dein Abenteuer beginnt jetzt, ${name}!`}>
            <div className="tut-choice" onClick={(e) => e.stopPropagation()}>
              <button data-sfx="confirm" onClick={() => finish("/library")}>
                ZUR BIBLIOTHEK
              </button>
              <button data-sfx="back" onClick={() => finish()}>
                SPÄTER
              </button>
            </div>
          </Dialog>
        )}
      </div>
    </div>,
    document.body,
  );
}
