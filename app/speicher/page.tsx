"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import LegalFooter from "@/components/LegalFooter";
import {
  PROVIDER_LABEL,
  configureStorage,
  configuredKinds,
  forgetStorage,
  providerFor,
  storageConfig,
  useStorageKind,
  type ProviderKind,
  type S3Config,
  type WebdavConfig,
} from "@/lib/userStorage";
import { googleClientId, googleToken } from "@/lib/userStorage/gdrive";
import { disconnectDropbox, dropboxAppKey, startDropboxLogin } from "@/lib/userStorage/dropbox";
import {
  connectWithToken,
  disconnectGithub,
  githubAccount,
  githubClientId,
  pollDeviceLogin,
  startDeviceLogin,
  type DeviceCode,
} from "@/lib/randomizer/github";

const KINDS: ProviderKind[] = ["local", "gdrive", "dropbox", "s3", "webdav"];

const HINT: Record<ProviderKind, string> = {
  local: "Alles bleibt im Browser auf diesem Gerät. Kein Konto nötig, aber auf anderen Geräten nicht verfügbar und weg, wenn du die Browserdaten löschst.",
  gdrive: "Ein Ordner „Challengemon“ in deinem Google Drive. Die Seite sieht nur Dateien, die sie selbst angelegt hat.",
  dropbox: "Ein App-Ordner in deiner Dropbox. Die Seite hat nur Zugriff auf diesen Ordner.",
  s3: "Eigener Bucket bei Cloudflare R2, Backblaze B2, MinIO, Supabase Storage o. Ä. Der Bucket braucht eine CORS-Regel für diese Seite.",
  webdav: "Nextcloud, ownCloud oder jeder WebDAV-Server. Der Server muss CORS für diese Seite erlauben.",
};

const EMPTY_S3: S3Config = { endpoint: "", bucket: "", region: "auto", accessKeyId: "", secretAccessKey: "", prefix: "challengemon" };
const EMPTY_DAV: WebdavConfig = { url: "", username: "", password: "" };

export default function StoragePage() {
  const active = useStorageKind();
  const [kinds, setKinds] = useState<ProviderKind[]>([]);
  const [s3, setS3] = useState<S3Config>(EMPTY_S3);
  const [dav, setDav] = useState<WebdavConfig>(EMPTY_DAV);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gh, setGh] = useState<string | null>(null);
  const [pat, setPat] = useState("");
  const [device, setDevice] = useState<DeviceCode | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setKinds(configuredKinds());
    const c3 = storageConfig("s3");
    if (c3?.kind === "s3") setS3(c3);
    const cd = storageConfig("webdav");
    if (cd?.kind === "webdav") setDav(cd);
    setGh(githubAccount()?.login ?? null);
    setOrigin(window.location.origin);
  }, [active]);

  async function test(kind: ProviderKind) {
    setError(null);
    setStatus("Teste Verbindung…");
    try {
      const p = providerFor(kind);
      if (!p) throw new Error("Nicht eingerichtet");
      const probe = new Blob([`challengemon ${new Date().toISOString()}`]);
      await p.put("test/verbindung.txt", probe);
      const back = await p.get("test/verbindung.txt");
      if (!back || back.size !== probe.size) throw new Error("Datei konnte nicht zurückgelesen werden");
      await p.remove("test/verbindung.txt");
      setStatus(`${PROVIDER_LABEL[kind]} funktioniert.`);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function connect(kind: ProviderKind) {
    setError(null);
    try {
      if (kind === "local") configureStorage({ kind: "local" });
      if (kind === "gdrive") {
        await googleToken(true);
        configureStorage({ kind: "gdrive" });
        await test("gdrive");
      }
      if (kind === "dropbox") {
        configureStorage({ kind: "dropbox" }, false);
        await startDropboxLogin("/speicher");
        return;
      }
      if (kind === "s3") {
        configureStorage({ kind: "s3", ...s3 });
        await test("s3");
      }
      if (kind === "webdav") {
        configureStorage({ kind: "webdav", ...dav });
        await test("webdav");
      }
      setKinds(configuredKinds());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function forget(kind: ProviderKind) {
    if (!confirm(`${PROVIDER_LABEL[kind]} auf diesem Gerät trennen? Deine Dateien dort bleiben erhalten.`)) return;
    if (kind === "dropbox") disconnectDropbox();
    forgetStorage(kind);
    setKinds(configuredKinds());
  }

  async function githubDevice() {
    setError(null);
    try {
      const code = await startDeviceLogin();
      setDevice(code);
      window.open(code.verification_uri, "_blank", "noopener");
      const login = await pollDeviceLogin(code);
      setGh(login);
      setDevice(null);
    } catch (err) {
      setDevice(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function githubToken() {
    setError(null);
    try {
      setGh(await connectWithToken(pat.trim()));
      setPat("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const available = (k: ProviderKind) => (k === "gdrive" ? !!googleClientId() : k === "dropbox" ? !!dropboxAppKey() : true);

  return (
    <>
      <Nav />
      <main className="container stack">
        <h1 style={{ margin: 0 }}>Speicher</h1>
        <p className="muted" style={{ margin: 0 }}>
          Deine ROMs, Randomizer-Patches und Spielstände liegen in <strong>deinem</strong> Speicher. Unser Server sieht davon nichts. Er kennt nur
          Dateinamen und Prüfsummen, damit deine Runs auf jedem Gerät funktionieren. Zugangsdaten bleiben in diesem Browser.
        </p>
        {status && <p className="small">{status}</p>}
        {error && <p className="error small">{error}</p>}

        <div className="grid">
          {KINDS.map((k) => {
            const connected = kinds.includes(k);
            return (
              <div key={k} className={`card stack${active === k ? " selected" : ""}`}>
                <div className="row">
                  <strong style={{ marginRight: "auto" }}>{PROVIDER_LABEL[k]}</strong>
                  {active === k && <span className="badge">Aktiv</span>}
                </div>
                <span className="small muted">{HINT[k]}</span>
                {!available(k) && <span className="small error">Auf dieser Installation noch nicht freigeschaltet.</span>}
                {k === "s3" && (
                  <div className="stack">
                    <input placeholder="Endpoint, z. B. https://<id>.r2.cloudflarestorage.com" value={s3.endpoint} onChange={(e) => setS3({ ...s3, endpoint: e.target.value })} />
                    <div className="row">
                      <input placeholder="Bucket" value={s3.bucket} onChange={(e) => setS3({ ...s3, bucket: e.target.value })} />
                      <input placeholder="Region (auto)" value={s3.region} onChange={(e) => setS3({ ...s3, region: e.target.value })} />
                    </div>
                    <input placeholder="Access Key ID" value={s3.accessKeyId} onChange={(e) => setS3({ ...s3, accessKeyId: e.target.value })} />
                    <input type="password" placeholder="Secret Access Key" value={s3.secretAccessKey} onChange={(e) => setS3({ ...s3, secretAccessKey: e.target.value })} />
                    <input placeholder="Ordner im Bucket" value={s3.prefix} onChange={(e) => setS3({ ...s3, prefix: e.target.value })} />
                    <details className="small">
                      <summary>CORS-Regel für den Bucket</summary>
                      <pre className="code">{JSON.stringify([{ AllowedOrigins: [origin], AllowedMethods: ["GET", "PUT", "DELETE", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag", "Content-Length"], MaxAgeSeconds: 3600 }], null, 2)}</pre>
                    </details>
                  </div>
                )}
                {k === "webdav" && (
                  <div className="stack">
                    <input placeholder="WebDAV-URL, z. B. https://cloud.example.de/remote.php/dav/files/name" value={dav.url} onChange={(e) => setDav({ ...dav, url: e.target.value })} />
                    <input placeholder="Benutzername" value={dav.username} onChange={(e) => setDav({ ...dav, username: e.target.value })} />
                    <input type="password" placeholder="App-Passwort" value={dav.password} onChange={(e) => setDav({ ...dav, password: e.target.value })} />
                  </div>
                )}
                <div className="row">
                  {(!connected || k === "s3" || k === "webdav") && available(k) && (
                    <button className="primary" onClick={() => connect(k)}>
                      {k === "local" ? "Verwenden" : connected ? "Speichern & verwenden" : "Verbinden"}
                    </button>
                  )}
                  {connected && active !== k && k !== "s3" && k !== "webdav" && (
                    <button className="primary" onClick={() => configureStorage(storageConfig(k) ?? ({ kind: k } as never))}>
                      Verwenden
                    </button>
                  )}
                  {connected && k !== "local" && <button onClick={() => test(k)}>Testen</button>}
                  {connected && k !== "local" && (
                    <button className="danger" onClick={() => forget(k)}>
                      Trennen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>GitHub (optional, für den Online-Randomizer)</h2>
          <span className="small muted">
            Statt im Browser kann deine ROM auch in einem privaten Repo in <strong>deinem</strong> GitHub-Account randomisiert werden. Praktisch für
            schwächere Geräte. Die Basis-ROM muss dafür in Google Drive, Dropbox oder S3 liegen. Das Repo wird beim ersten Mal automatisch
            angelegt. Der Zugang bleibt in diesem Browser.
          </span>
          {gh ? (
            <div className="row">
              <span>
                Verbunden als <strong>{gh}</strong>
              </span>
              <button
                className="danger"
                onClick={() => {
                  disconnectGithub();
                  setGh(null);
                }}
              >
                Trennen
              </button>
            </div>
          ) : (
            <div className="stack">
              {githubClientId() && (
                <div className="row">
                  <button className="primary" onClick={githubDevice} disabled={!!device}>
                    Mit GitHub verbinden
                  </button>
                  {device && (
                    <span className="small">
                      Gib auf <a href={device.verification_uri} target="_blank" rel="noreferrer">{device.verification_uri}</a> den Code{" "}
                      <strong className="code-inline">{device.user_code}</strong> ein.
                    </span>
                  )}
                </div>
              )}
              <details className="small">
                <summary>Oder mit Personal Access Token</summary>
                <div className="stack">
                  <span className="muted">
                    Auf github.com/settings/tokens einen klassischen Token mit den Rechten <code>repo</code> und <code>workflow</code> erstellen.
                  </span>
                  <div className="row">
                    <input type="password" placeholder="ghp_…" value={pat} onChange={(e) => setPat(e.target.value)} />
                    <button onClick={githubToken} disabled={!pat.trim()}>
                      Speichern
                    </button>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </main>
      <LegalFooter />
    </>
  );
}
