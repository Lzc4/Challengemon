"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import LegalFooter from "@/components/LegalFooter";
import { supabase } from "@/lib/supabase/client";
import { useMyProfile, useUser } from "@/lib/hooks";
import { REPLAY_EVENT } from "@/components/tutorial/Tutorial";
import InvitesCard from "@/components/InvitesCard";
import { wipeCloud } from "@/lib/userStorage/cloud";

export default function AccountPage() {
  const user = useUser();
  const me = useMyProfile();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me) setName(me.name);
  }, [me]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const { error } = await supabase().from("profiles").update({ name: name.trim() }).eq("id", user.id);
    if (error) setError(error.code === "23505" ? "Der Name ist schon vergeben." : error.message);
    else setMsg("Name gespeichert.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase().auth.updateUser({ password });
    if (error) setError(error.message);
    else {
      setPassword("");
      setMsg("Passwort geändert.");
    }
  }

  async function deleteAccount() {
    if (
      !confirm(
        "Konto wirklich löschen? Runs, die nur dir gehören, und alles in deiner Challengemon-Cloud werden mitgelöscht. Dateien in deinem eigenen Speicher (Gerät, Nextcloud usw.) bleiben dort liegen.",
      )
    )
      return;
    await wipeCloud().catch(() => null);
    const { error } = await supabase().rpc("delete_my_account");
    if (error) {
      setError(error.message);
      return;
    }
    await supabase().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      <Nav />
      <main className="container stack">
        <h1 style={{ margin: 0 }}>Konto</h1>
        {msg && <p className="small">{msg}</p>}
        {error && <p className="small error">{error}</p>}
        <form className="card stack" onSubmit={saveName}>
          <strong>Anzeigename</strong>
          <div className="row">
            <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={24} required />
            <button className="primary">Speichern</button>
          </div>
          <span className="small muted">{user?.email}</span>
        </form>
        <form className="card stack" onSubmit={savePassword}>
          <strong>Neues Passwort</strong>
          <div className="row">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
            <button className="primary">Ändern</button>
          </div>
        </form>
        <InvitesCard />
        <div className="card stack">
          <strong>Tutorial</strong>
          <span className="small muted">Professorin Kiesel erklärt dir die Seite gern nochmal.</span>
          <div>
            <button onClick={() => window.dispatchEvent(new Event(REPLAY_EVENT))}>Tutorial nochmal ansehen</button>
          </div>
        </div>
        <div className="card stack">
          <strong>Konto löschen</strong>
          <span className="small muted">
            Löscht dein Konto, deine Bibliothekseinträge, alles in deiner Challengemon-Cloud und deine Daten in allen Runs. Deine Dateien in Nextcloud usw. liegen in deinem
            eigenen Speicher und bleiben dort, bis du sie selbst löschst.
          </span>
          <div>
            <button className="danger" onClick={deleteAccount}>
              Konto löschen
            </button>
          </div>
        </div>
      </main>
      <LegalFooter />
    </>
  );
}
