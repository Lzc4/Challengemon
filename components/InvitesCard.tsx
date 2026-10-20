"use client";

import { useCallback, useEffect, useState } from "react";
import { createInvite, deleteInvite, inviteInfo, inviteLink, myInvites, type InviteInfo, type MyInvite } from "@/lib/invites";

export default function InvitesCard() {
  const [list, setList] = useState<MyInvite[]>([]);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [rows, i] = await Promise.all([myInvites(), inviteInfo()]);
      setList(rows);
      setInfo(i);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setError(null);
    try {
      await createInvite();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Kopieren ging nicht, markier den Link einfach von Hand.");
    }
  }

  async function remove(code: string) {
    await deleteInvite(code).catch(() => null);
    await load();
  }

  const left = info && !info.admin ? Math.max(0, info.quota - info.created) : null;

  return (
    <div className="card stack">
      <div className="row">
        <strong style={{ marginRight: "auto" }}>Einladungen</strong>
        {info?.admin ? <span className="badge">Admin</span> : left !== null && <span className="small muted">noch {left} frei</span>}
      </div>
      <span className="small muted">Challengemon ist gerade nur auf Einladung offen. Jeder Code klappt genau einmal.</span>
      {list.length > 0 && (
        <ul className="invites">
          {list.map((i) => (
            <li key={i.code}>
              <code>{i.code}</code>
              {i.used_at ? (
                <span className="small muted">
                  eingelöst von <strong>{i.used_name ?? "gelöschtem Konto"}</strong>
                </span>
              ) : (
                <>
                  <button className="small" onClick={() => copy(i.code)}>
                    {copied === i.code ? "Kopiert!" : "Link kopieren"}
                  </button>
                  <button className="small danger" onClick={() => remove(i.code)}>
                    Löschen
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <span className="small error">{error}</span>}
      {(left === null || left > 0) && (
        <div>
          <button className="primary" onClick={add}>
            Neue Einladung
          </button>
        </div>
      )}
    </div>
  );
}
