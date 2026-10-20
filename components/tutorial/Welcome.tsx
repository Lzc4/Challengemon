"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Dialog from "./Dialog";
import PixelSprite from "./PixelSprite";
import { PROFESSOR, RIVAL, RIVAL_NAME } from "./sprites";
import { MET_KEY } from "./Tutorial";

type Step =
  | { id: "hello" }
  | { id: "ask" }
  | { id: "login"; error?: string }
  | { id: "reset"; error?: string; sent?: boolean }
  | { id: "name" }
  | { id: "creds"; error?: string }
  | { id: "terms"; declined?: boolean }
  | { id: "busy" }
  | { id: "rival"; n: number }
  | { id: "mail" };

function nextUrl() {
  const target = new URLSearchParams(window.location.search).get("next");
  return target && target.startsWith("/") ? target : "/";
}

export default function Welcome() {
  const [step, setStep] = useState<Step>({ id: "hello" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmMail, setConfirmMail] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setStep({ id: "login", error: "Hm, das passt nicht. Entweder stimmen E-Mail oder Passwort nicht, oder die E-Mail ist noch nicht bestätigt." });
    else window.location.href = nextUrl();
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/konto` });
    setBusy(false);
    setStep(error ? { id: "reset", error: error.message } : { id: "reset", sent: true });
  }

  async function signup() {
    setStep({ id: "busy" });
    const { data, error } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}${nextUrl()}` },
    });
    if (error) return setStep({ id: "creds", error: error.message });
    setConfirmMail(!data.session);
    try {
      sessionStorage.setItem(MET_KEY, "1");
    } catch {}
    setStep({ id: "rival", n: 0 });
  }

  const trainer = name.trim() || "Trainer";
  const rivalLines = [
    { rival: false, text: `Oh, und bevor ich's vergesse: Das hier ist ${RIVAL_NAME}. ${RIVAL_NAME} hat diese ganze Seite gebaut.` },
    { rival: true, text: `Pff, noch ein neuer Trainer? Na dann, ${trainer}. Wetten, mein Team überlebt länger als deins?` },
    { rival: true, text: "Wir sehen uns in der Statistik. Ganz oben steh dann ich!" },
    { rival: false, text: `Lass dich bloß nicht ärgern, ${trainer}. Ab heute seid ihr zwei Rivalen!` },
  ];

  let dialog: React.ReactNode = null;
  let rivalOnStage = false;

  switch (step.id) {
    case "hello":
      dialog = <Dialog key="hello" text="Hallo! Willkommen in der Welt von CHALLENGEMON! Ich bin KIESEL, die Challenge-Professorin." onNext={() => setStep({ id: "ask" })} />;
      break;
    case "ask":
      dialog = (
        <Dialog key="ask" text="Sag mal… kennen wir uns schon?">
          <div className="tut-choice">
            <button onClick={() => setStep({ id: "name" })}>ICH BIN NEU</button>
            <button onClick={() => setStep({ id: "login" })}>WIR KENNEN UNS</button>
          </div>
        </Dialog>
      );
      break;
    case "login":
      dialog = (
        <Dialog key={`login-${step.error ?? ""}`} text={step.error ?? "Schön, dich wiederzusehen! Zeig mir kurz deinen Trainerpass."}>
          <form className="tut-form" onSubmit={login}>
            <input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
            <input type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            <div className="tut-form-row">
              <button type="button" className="link small" onClick={() => setStep({ id: "reset" })}>
                Passwort vergessen?
              </button>
              <button type="button" className="link small" onClick={() => setStep({ id: "ask" })}>
                Zurück
              </button>
              <button className="tut-go" disabled={busy}>
                {busy ? "…" : "LOS ▶"}
              </button>
            </div>
          </form>
        </Dialog>
      );
      break;
    case "reset":
      dialog = step.sent ? (
        <Dialog
          key="reset-sent"
          text="Erledigt! Wenn es ein Konto mit dieser Adresse gibt, ist ein Link zum Zurücksetzen unterwegs."
          onNext={() => setStep({ id: "login" })}
        />
      ) : (
        <Dialog key={`reset-${step.error ?? ""}`} text={step.error ? `Oh, das hat nicht geklappt: ${step.error}` : "Passwort vergessen? Passiert den Besten. An welche E-Mail soll ich den Link schicken?"}>
          <form className="tut-form" onSubmit={reset}>
            <input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
            <div className="tut-form-row">
              <button type="button" className="link small" onClick={() => setStep({ id: "login" })}>
                Zurück
              </button>
              <button className="tut-go" disabled={busy}>
                {busy ? "…" : "SENDEN ▶"}
              </button>
            </div>
          </form>
        </Dialog>
      );
      break;
    case "name":
      dialog = (
        <Dialog key="name" text="Wunderbar, ein neues Gesicht! Dann fangen wir ganz vorne an. Wie heißt du denn?">
          <form
            className="tut-form"
            onSubmit={(e) => {
              e.preventDefault();
              setStep({ id: "creds" });
            }}
          >
            <input placeholder="Dein Name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={20} autoComplete="nickname" autoFocus />
            <div className="tut-form-row">
              <button type="button" className="link small" onClick={() => setStep({ id: "ask" })}>
                Zurück
              </button>
              <button className="tut-go">WEITER ▶</button>
            </div>
          </form>
        </Dialog>
      );
      break;
    case "creds":
      dialog = (
        <Dialog
          key={`creds-${step.error ?? ""}`}
          text={step.error ? `Oh, das hat nicht geklappt: ${step.error}` : `${trainer} also! Ein starker Name. Damit ich dich wiedererkenne, brauche ich noch deine E-Mail und ein geheimes Passwort.`}
        >
          <form
            className="tut-form"
            onSubmit={(e) => {
              e.preventDefault();
              setStep({ id: "terms" });
            }}
          >
            <input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
            <input
              type="password"
              placeholder="Passwort (mind. 8 Zeichen)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <div className="tut-form-row">
              <button type="button" className="link small" onClick={() => setStep({ id: "name" })}>
                Zurück
              </button>
              <button className="tut-go">WEITER ▶</button>
            </div>
          </form>
        </Dialog>
      );
      break;
    case "terms":
      dialog = step.declined ? (
        <Dialog key="declined" text="Schade! Ohne geht es leider nicht. Lies es dir in Ruhe durch, ich warte hier." onNext={() => setStep({ id: "terms" })} />
      ) : (
        <Dialog key="terms" text="Eine Sache noch: Spiele gibt es hier keine, nur deine eigenen Sicherungskopien. Bist du mit den Nutzungsbedingungen und der Datenschutzerklärung einverstanden?">
          <p className="tut-links small">
            <Link href="/rechtliches/nutzungsbedingungen" target="_blank">
              Nutzungsbedingungen
            </Link>{" "}
            ·{" "}
            <Link href="/rechtliches/datenschutz" target="_blank">
              Datenschutz
            </Link>
          </p>
          <div className="tut-choice">
            <button onClick={signup}>JA</button>
            <button onClick={() => setStep({ id: "terms", declined: true })}>NEIN</button>
          </div>
        </Dialog>
      );
      break;
    case "busy":
      dialog = <Dialog key="busy" text="Einen Moment, ich trage dich ins Register ein…" />;
      break;
    case "rival": {
      const line = rivalLines[step.n];
      rivalOnStage = true;
      dialog = (
        <Dialog
          key={`rival-${step.n}`}
          who={line.rival ? RIVAL_NAME : undefined}
          text={line.text}
          onNext={() => {
            if (step.n + 1 < rivalLines.length) setStep({ id: "rival", n: step.n + 1 });
            else if (confirmMail) setStep({ id: "mail" });
            else window.location.href = nextUrl();
          }}
        />
      );
      break;
    }
    case "mail":
      dialog = (
        <Dialog
          key="mail"
          text={`Fast geschafft, ${trainer}! Ich hab dir eine E-Mail geschickt. Klick auf den Link darin, dann geht dein Abenteuer los.`}
          onNext={() => setStep({ id: "login" })}
        />
      );
      break;
  }

  return (
    <div className="welcome">
      <div className="welcome-title">
        <span className="welcome-logo">CHALLENGEMON</span>
        <span className="muted small">Nuzlocke- und Soullocke-Runs im Browser, mit deinen eigenen Spielen und deinem eigenen Speicher.</span>
      </div>
      <div className="tut-stage welcome-stage">
        <div className="tut-cast">
          <PixelSprite sprite={PROFESSOR} scale={7} className="tut-prof" />
          {rivalOnStage && <PixelSprite sprite={RIVAL} scale={7} className="tut-rival" />}
        </div>
        {dialog}
      </div>
    </div>
  );
}
