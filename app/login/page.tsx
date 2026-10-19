"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import LegalFooter from "@/components/LegalFooter";

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = () => {
    const target = new URLSearchParams(window.location.search).get("next");
    return target && target.startsWith("/") ? target : "/";
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const client = supabase();
    if (mode === "login") {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError("Login fehlgeschlagen. E-Mail oder Passwort falsch, oder die E-Mail ist noch nicht bestätigt.");
      else window.location.href = next();
    } else if (mode === "signup") {
      if (!accept) {
        setError("Bitte bestätige die Nutzungsbedingungen und die Datenschutzerklärung.");
        setBusy(false);
        return;
      }
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}${next()}` },
      });
      if (error) setError(error.message);
      else if (data.session) window.location.href = next();
      else setInfo("Fast geschafft! Bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.");
    } else {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/konto` });
      if (error) setError(error.message);
      else setInfo("Wenn es ein Konto mit dieser Adresse gibt, ist ein Link zum Zurücksetzen unterwegs.");
    }
    setBusy(false);
  }

  return (
    <main className="container stack">
      <form className="card login stack" onSubmit={submit}>
        <h1>Challengemon</h1>
        <p className="muted small" style={{ margin: 0 }}>
          Nuzlocke- und Soullocke-Runs im Browser, mit deinen eigenen Spielen und deinem eigenen Speicher.
        </p>
        <div className="row">
          <button type="button" className={mode === "login" ? "primary" : ""} onClick={() => setMode("login")}>
            Einloggen
          </button>
          <button type="button" className={mode === "signup" ? "primary" : ""} onClick={() => setMode("signup")}>
            Registrieren
          </button>
        </div>
        <label>
          E-Mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        {mode === "signup" && (
          <label>
            Anzeigename
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={20} autoComplete="nickname" />
          </label>
        )}
        {mode !== "reset" && (
          <label>
            Passwort
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>
        )}
        {mode === "signup" && (
          <label className="inline">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span className="small">
              Ich akzeptiere die <Link href="/rechtliches/nutzungsbedingungen">Nutzungsbedingungen</Link> und habe die{" "}
              <Link href="/rechtliches/datenschutz">Datenschutzerklärung</Link> gelesen.
            </span>
          </label>
        )}
        {error && <p className="error small">{error}</p>}
        {info && <p className="small">{info}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Moment…" : mode === "login" ? "Einloggen" : mode === "signup" ? "Konto erstellen" : "Link schicken"}
        </button>
        {mode === "login" && (
          <button type="button" className="link small" onClick={() => setMode("reset")}>
            Passwort vergessen?
          </button>
        )}
      </form>
      <LegalFooter />
    </main>
  );
}
