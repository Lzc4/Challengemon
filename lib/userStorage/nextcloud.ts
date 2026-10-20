import { webdavProvider } from "./webdav";
import type { NextcloudConfig, StorageProvider } from "./types";

// login laeuft ueber die nextcloud-app "WebAppPassword": popup auf der nextcloud,
// die schickt ein 24h-token per postMessage zurueck und setzt cors fuer webdav
const LIFETIME = 24 * 3600_000;

export const NEXTCLOUD_APP = "https://apps.nextcloud.com/apps/webapppassword";

export function normalizeServer(input: string) {
  let s = input.trim();
  if (!s) throw new Error("Bitte gib die Adresse deiner Nextcloud an");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  const u = new URL(s);
  if (u.protocol !== "https:" && u.hostname !== "localhost") throw new Error("Die Nextcloud muss über https erreichbar sein");
  const path = u.pathname.replace(/\/(index\.php.*|apps\/.*|login.*)?$/, "").replace(/\/+$/, "");
  return `${u.origin}${path}`;
}

export function nextcloudExpired(c: NextcloudConfig) {
  return Date.now() > c.expires - 60_000;
}

export function connectNextcloud(input: string): Promise<NextcloudConfig> {
  const server = normalizeServer(input);
  const serverOrigin = new URL(server).origin;
  const url = `${server}/index.php/apps/webapppassword/?target-origin=${encodeURIComponent(window.location.origin)}`;
  const popup = window.open(url, "challengemon-nextcloud", "width=480,height=640");
  if (!popup) return Promise.reject(new Error("Das Anmeldefenster wurde blockiert. Bitte Popups für diese Seite erlauben."));

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const done = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(watch);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== serverOrigin || e.data?.type !== "webapppassword") return;
      done();
      popup.close();
      const { loginName, token, webdavUrl } = e.data as { loginName: string; token: string; webdavUrl: string };
      const dav = new URL(webdavUrl, server);
      if (dav.origin !== serverOrigin) return reject(new Error("Die Nextcloud hat eine unerwartete WebDAV-Adresse geschickt"));
      check({ kind: "nextcloud", server, loginName, token, webdavUrl: dav.href.replace(/\/+$/, ""), expires: started + LIFETIME }).then(resolve, reject);
    };
    // fenster zu ohne nachricht: abgebrochen oder unsere seite ist dort nicht freigegeben
    const watch = setInterval(() => {
      if (!popup.closed) return;
      done();
      reject(
        new Error(
          `Keine Antwort von der Nextcloud. Ist dort die App „WebAppPassword“ installiert und ${window.location.origin} als erlaubte Origin eingetragen?`,
        ),
      );
    }, 500);
    window.addEventListener("message", onMessage);
  });
}

async function check(c: NextcloudConfig) {
  let res: Response;
  try {
    res = await fetch(`${c.webdavUrl}/`, {
      method: "PROPFIND",
      headers: { Authorization: basic(c), Depth: "0" },
    });
  } catch {
    throw new Error(`Login hat geklappt, aber die Nextcloud blockt den Dateizugriff (CORS). Trag ${window.location.origin} in WebAppPassword bei den WebDAV-Origins ein.`);
  }
  if (res.status === 401) throw new Error("Die Nextcloud hat den Zugang abgelehnt");
  if (!res.ok) throw new Error(`Nextcloud antwortet mit Fehler ${res.status}`);
  return c;
}

const basic = (c: NextcloudConfig) => `Basic ${btoa(unescape(encodeURIComponent(`${c.loginName}:${c.token}`)))}`;

export function nextcloudProvider(c: NextcloudConfig): StorageProvider {
  const dav = webdavProvider({ url: c.webdavUrl, username: c.loginName, password: c.token });
  const fresh = <T extends unknown[], R>(fn: (...a: T) => Promise<R>) =>
    (...a: T) => {
      if (nextcloudExpired(c)) return Promise.reject(new Error("Nextcloud-Zugang abgelaufen, bitte oben neu verbinden"));
      return fn(...a);
    };
  return {
    ...dav,
    kind: "nextcloud",
    label: "Nextcloud",
    put: fresh(dav.put),
    get: fresh(dav.get),
    remove: fresh(dav.remove),
    list: fresh(dav.list),
  };
}
