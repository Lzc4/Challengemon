import { readBody, xhrUpload } from "./http";
import { ROOT, type StorageProvider } from "./types";

// drive.file: wir sehen nur dateien die wir selbst angelegt haben
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";
const TOKEN_KEY = "cm.gdrive.token";
const IDS_KEY = "cm.gdrive.ids";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken(opts?: { prompt?: string }): void;
  callback: (r: TokenResponse) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: unknown) => void }): TokenClient;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;
let client: TokenClient | null = null;
let pendingToken: Promise<string> | null = null;

function loadScript() {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Google-Anmeldung konnte nicht geladen werden"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function googleClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
}

function cachedToken(minValidity: number) {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as { token: string; exp: number };
    return t.exp - minValidity > Date.now() ? t.token : null;
  } catch {
    return null;
  }
}

export function forgetGoogle() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(IDS_KEY);
  } catch {}
}

export async function googleToken(interactive = false, minValidity = 60_000): Promise<string> {
  const cached = cachedToken(minValidity);
  if (cached) return cached;
  if (pendingToken) return pendingToken;
  const id = googleClientId();
  if (!id) throw new Error("Google Drive ist auf dieser Seite nicht eingerichtet (NEXT_PUBLIC_GOOGLE_CLIENT_ID fehlt)");
  await loadScript();
  pendingToken = new Promise<string>((resolve, reject) => {
    const done = (r: TokenResponse) => {
      pendingToken = null;
      if (!r.access_token) return reject(new Error(r.error ?? "Google-Anmeldung abgebrochen"));
      try {
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 }));
      } catch {}
      resolve(r.access_token);
    };
    if (!client) {
      client = window.google!.accounts.oauth2.initTokenClient({
        client_id: id,
        scope: SCOPE,
        callback: done,
        error_callback: () => {
          pendingToken = null;
          reject(new Error("Google-Anmeldung abgebrochen"));
        },
      });
    } else client.callback = done;
    client.requestAccessToken({ prompt: interactive ? "consent" : "" });
  });
  return pendingToken;
}

// drive kennt keine pfade, deshalb cachen wir pfad -> file-id
function readIds(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(IDS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function clearIds() {
  try {
    localStorage.removeItem(IDS_KEY);
  } catch {}
}

function writeId(path: string, id: string | null) {
  const ids = readIds();
  if (id) ids[path] = id;
  else delete ids[path];
  try {
    localStorage.setItem(IDS_KEY, JSON.stringify(ids));
  } catch {}
}

async function api(path: string, init: RequestInit = {}) {
  const token = await googleToken();
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (res.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    throw new Error("Google-Sitzung abgelaufen, bitte erneut verbinden");
  }
  return res;
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function findChild(parent: string, name: string, folder: boolean): Promise<{ id: string; size: number } | null> {
  const query = `name='${q(name)}' and '${parent}' in parents and trashed=false${folder ? ` and mimeType='${FOLDER}'` : ""}`;
  const res = await api(`/files?q=${encodeURIComponent(query)}&fields=files(id,size)&spaces=drive`);
  const data = (await res.json()) as { files?: { id: string; size?: string }[] };
  const f = data.files?.[0];
  return f ? { id: f.id, size: Number(f.size ?? 0) } : null;
}

async function createFolder(parent: string | null, name: string) {
  const res = await api("/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}) }),
  });
  return ((await res.json()) as { id: string }).id;
}

async function rootId() {
  const known = readIds()[""];
  if (known) return known;
  const res = await api(`/files?q=${encodeURIComponent(`name='${ROOT}' and 'root' in parents and mimeType='${FOLDER}' and trashed=false`)}&fields=files(id)`);
  const data = (await res.json()) as { files?: { id: string }[] };
  const id = data.files?.[0]?.id ?? (await createFolder(null, ROOT));
  writeId("", id);
  return id;
}

async function folderId(dir: string, create: boolean): Promise<string | null> {
  if (!dir) return rootId();
  const known = readIds()[`${dir}/`];
  if (known) return known;
  const parts = dir.split("/");
  let parent = await rootId();
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    const cached = readIds()[`${acc}/`];
    if (cached) {
      parent = cached;
      continue;
    }
    const found = await findChild(parent, part, true);
    if (!found && !create) return null;
    parent = found?.id ?? (await createFolder(parent, part));
    writeId(`${acc}/`, parent);
  }
  return parent;
}

function split(path: string) {
  const i = path.lastIndexOf("/");
  return { dir: i < 0 ? "" : path.slice(0, i), name: i < 0 ? path : path.slice(i + 1) };
}

async function fileId(path: string, create = false): Promise<string | null> {
  const known = readIds()[path];
  if (known) return known;
  const { dir, name } = split(path);
  const parent = await folderId(dir, create);
  if (!parent) return null;
  const found = await findChild(parent, name, false);
  if (found) {
    writeId(path, found.id);
    return found.id;
  }
  if (!create) return null;
  const res = await api("/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parents: [parent] }),
  });
  const id = ((await res.json()) as { id: string }).id;
  writeId(path, id);
  return id;
}

// alles liegt im ordner "Challengemon" im drive des users
export function gdriveProvider(): StorageProvider {
  return {
    kind: "gdrive",
    label: "Google Drive",
    remote: true,
    async put(path, data, onProgress) {
      const start = async () => {
        const id = await fileId(path, true);
        const token = await googleToken();
        return fetch(`${UPLOAD}/files/${id}?uploadType=resumable`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Upload-Content-Length": String(data.size) },
          body: "{}",
        });
      };
      let init = await start();
      if (init.status === 404) {
        clearIds();
        init = await start();
      }
      const session = init.headers.get("location");
      if (!init.ok || !session) throw new Error(`Google Drive Upload abgelehnt (${init.status})`);
      const res = await xhrUpload("PUT", session, {}, data, onProgress);
      if (res.status >= 300) throw new Error(`Google Drive Upload fehlgeschlagen (${res.status})`);
    },
    async get(path, onProgress) {
      const id = await fileId(path);
      if (!id) return null;
      const res = await api(`/files/${id}?alt=media`);
      if (res.status === 404) {
        writeId(path, null);
        return null;
      }
      if (!res.ok) throw new Error(`Google Drive Download fehlgeschlagen (${res.status})`);
      return readBody(res, onProgress);
    },
    async remove(path) {
      const id = await fileId(path);
      if (!id) return;
      await api(`/files/${id}`, { method: "DELETE" });
      writeId(path, null);
    },
    async list(prefix) {
      const dir = prefix.replace(/\/$/, "");
      const parent = await folderId(dir, false);
      if (!parent) return [];
      const res = await api(`/files?q=${encodeURIComponent(`'${parent}' in parents and trashed=false`)}&fields=files(id,name,size,mimeType)&pageSize=1000`);
      const data = (await res.json()) as { files?: { id: string; name: string; size?: string; mimeType: string }[] };
      return (data.files ?? [])
        .filter((f) => f.mimeType !== FOLDER)
        .map((f) => {
          const path = dir ? `${dir}/${f.name}` : f.name;
          writeId(path, f.id);
          return { path, size: Number(f.size ?? 0) };
        });
    },
    async remoteRead(path) {
      let id = await fileId(path);
      if (id) {
        const check = await api(`/files/${id}?fields=id`);
        if (check.status === 404) {
          clearIds();
          id = await fileId(path);
        }
      }
      if (!id) throw new Error(`Datei fehlt in Google Drive: ${path}`);
      return { method: "GET", url: `${API}/files/${id}?alt=media`, headers: { Authorization: `Bearer ${await googleToken(false, 45 * 60_000)}` } };
    },
    async remoteWrite(path) {
      let id = await fileId(path, true);
      const check = await api(`/files/${id}?fields=id`);
      if (check.status === 404) {
        clearIds();
        id = await fileId(path, true);
      }
      return {
        method: "PATCH",
        url: `${UPLOAD}/files/${id}?uploadType=media`,
        headers: { Authorization: `Bearer ${await googleToken(false, 45 * 60_000)}`, "Content-Type": "application/octet-stream" },
      };
    },
  };
}
