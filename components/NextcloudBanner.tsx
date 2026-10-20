"use client";

import { useEffect, useState } from "react";
import { configureStorage, storageConfig, useStorageKind } from "@/lib/userStorage";
import { connectNextcloud, nextcloudExpired } from "@/lib/userStorage/nextcloud";

export default function NextcloudBanner() {
  const kind = useStorageKind();
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const c = storageConfig("nextcloud");
      setExpired(kind === "nextcloud" && c?.kind === "nextcloud" && nextcloudExpired(c));
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [kind]);

  if (!expired) return null;

  async function reconnect() {
    const c = storageConfig("nextcloud");
    if (c?.kind !== "nextcloud") return;
    setError(null);
    try {
      configureStorage(await connectNextcloud(c.server));
      setExpired(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="banner">
      <span>Dein Nextcloud-Zugang ist abgelaufen (gilt immer 24 Stunden).</span>
      <button className="primary" onClick={reconnect}>
        Neu verbinden
      </button>
      {error && <span className="error small">{error}</span>}
    </div>
  );
}
