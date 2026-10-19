import { readBody, xhrUpload } from "./http";
import type { StorageProvider } from "./types";

const AUTH_KEY = "cm.dropbox.auth";
const VERIFIER_KEY = "cm.dropbox.verifier";
// upload ueber 150mb geht nur mit sessions, daher in 32mb haeppchen
const CHUNK = 32 * 1024 * 1024;

interface DropboxAuth {
  access: string;
  refresh: string;
  exp: number;
}

export function dropboxAppKey() {
  return process.env.NEXT_PUBLIC_DROPBOX_APP_KEY ?? "";
}

function redirectUri() {
  return `${window.location.origin}/speicher/dropbox`;
}

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function startDropboxLogin(returnTo: string) {
  const key = dropboxAppKey();
  if (!key) throw new Error("Dropbox ist auf dieser Seite nicht eingerichtet (NEXT_PUBLIC_DROPBOX_APP_KEY fehlt)");
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem(VERIFIER_KEY, JSON.stringify({ verifier, returnTo }));
  const params = new URLSearchParams({
    client_id: key,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    token_access_type: "offline",
    redirect_uri: redirectUri(),
  });
  window.location.href = `https://www.dropbox.com/oauth2/authorize?${params}`;
}

export async function finishDropboxLogin(code: string): Promise<string> {
  const raw = sessionStorage.getItem(VERIFIER_KEY);
  if (!raw) throw new Error("Dropbox-Anmeldung abgelaufen, bitte neu starten");
  const { verifier, returnTo } = JSON.parse(raw) as { verifier: string; returnTo: string };
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ code, grant_type: "authorization_code", code_verifier: verifier, client_id: dropboxAppKey(), redirect_uri: redirectUri() }),
  });
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!data.access_token || !data.refresh_token) throw new Error(data.error_description ?? "Dropbox-Anmeldung fehlgeschlagen");
  saveAuth({ access: data.access_token, refresh: data.refresh_token, exp: Date.now() + (data.expires_in ?? 14400) * 1000 });
  sessionStorage.removeItem(VERIFIER_KEY);
  return returnTo;
}

function saveAuth(a: DropboxAuth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(a));
}

export function dropboxConnected() {
  try {
    return !!localStorage.getItem(AUTH_KEY);
  } catch {
    return false;
  }
}

export function disconnectDropbox() {
  localStorage.removeItem(AUTH_KEY);
}

async function token(minValidity = 60_000): Promise<string> {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) throw new Error("Dropbox ist nicht verbunden");
  const a = JSON.parse(raw) as DropboxAuth;
  if (a.exp - minValidity > Date.now()) return a.access;
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: a.refresh, client_id: dropboxAppKey() }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Dropbox-Sitzung abgelaufen, bitte erneut verbinden");
  saveAuth({ ...a, access: data.access_token, exp: Date.now() + (data.expires_in ?? 14400) * 1000 });
  return data.access_token;
}

const full = (path: string) => `/${path.replace(/^\/+/, "")}`;

// Dropbox-API-Arg header muss ascii sein
const arg = (v: unknown) => JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

async function rpc<T>(endpoint: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: (text ? JSON.parse(text) : null) as T };
}

export function dropboxProvider(): StorageProvider {
  return {
    kind: "dropbox",
    label: "Dropbox",
    remote: true,
    async put(path, data, onProgress) {
      const auth = { Authorization: `Bearer ${await token()}`, "Content-Type": "application/octet-stream" };
      if (data.size <= CHUNK) {
        const res = await xhrUpload(
          "POST",
          "https://content.dropboxapi.com/2/files/upload",
          { ...auth, "Dropbox-API-Arg": arg({ path: full(path), mode: "overwrite", mute: true }) },
          data,
          onProgress,
        );
        if (res.status >= 300) throw new Error(`Dropbox Upload fehlgeschlagen (${res.status})`);
        return;
      }
      const start = await xhrUpload("POST", "https://content.dropboxapi.com/2/files/upload_session/start", { ...auth, "Dropbox-API-Arg": arg({ close: false }) }, data.slice(0, CHUNK), (d) => onProgress?.(d, data.size));
      if (start.status >= 300) throw new Error(`Dropbox Upload fehlgeschlagen (${start.status})`);
      const session = (JSON.parse(start.text) as { session_id: string }).session_id;
      let offset = CHUNK;
      while (offset < data.size) {
        const end = Math.min(data.size, offset + CHUNK);
        const last = end >= data.size;
        const base = offset;
        const res = await xhrUpload(
          "POST",
          `https://content.dropboxapi.com/2/files/upload_session/${last ? "finish" : "append_v2"}`,
          {
            ...auth,
            "Dropbox-API-Arg": arg(
              last
                ? { cursor: { session_id: session, offset }, commit: { path: full(path), mode: "overwrite", mute: true } }
                : { cursor: { session_id: session, offset }, close: false },
            ),
          },
          data.slice(offset, end),
          (d) => onProgress?.(base + d, data.size),
        );
        if (res.status >= 300) throw new Error(`Dropbox Upload fehlgeschlagen (${res.status})`);
        offset = end;
      }
    },
    async get(path, onProgress) {
      const res = await fetch("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}`, "Dropbox-API-Arg": arg({ path: full(path) }) },
      });
      if (res.status === 409) return null;
      if (!res.ok) throw new Error(`Dropbox Download fehlgeschlagen (${res.status})`);
      return readBody(res, onProgress);
    },
    async remove(path) {
      await rpc("files/delete_v2", { path: full(path) });
    },
    async list(prefix) {
      const dir = full(prefix.replace(/\/$/, ""));
      const res = await rpc<{ entries: { ".tag": string; path_display: string; size?: number }[] }>("files/list_folder", { path: dir === "/" ? "" : dir });
      if (!res.ok) return [];
      return res.data.entries.filter((e) => e[".tag"] === "file").map((e) => ({ path: e.path_display.replace(/^\//, ""), size: e.size ?? 0 }));
    },
    async remoteRead(path) {
      return {
        method: "POST",
        url: "https://content.dropboxapi.com/2/files/download",
        headers: { Authorization: `Bearer ${await token(3 * 3600_000)}`, "Dropbox-API-Arg": arg({ path: full(path) }) },
      };
    },
    async remoteWrite(path) {
      return {
        method: "POST",
        url: "https://content.dropboxapi.com/2/files/upload",
        headers: {
          Authorization: `Bearer ${await token(3 * 3600_000)}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": arg({ path: full(path), mode: "overwrite", mute: true }),
        },
      };
    },
  };
}
