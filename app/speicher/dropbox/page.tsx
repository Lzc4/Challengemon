"use client";

import { useEffect, useState } from "react";
import { finishDropboxLogin } from "@/lib/userStorage/dropbox";
import { configureStorage } from "@/lib/userStorage";

export default function DropboxCallback() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setError(params.get("error_description") ?? "Dropbox-Anmeldung abgebrochen");
      return;
    }
    finishDropboxLogin(code)
      .then((back) => {
        configureStorage({ kind: "dropbox" });
        window.location.replace(back);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);
  return (
    <main className="container">
      <div className="card">{error ? <p className="error">{error}</p> : <p className="muted">Dropbox wird verbunden…</p>}</div>
    </main>
  );
}
