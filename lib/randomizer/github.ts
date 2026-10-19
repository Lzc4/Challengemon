import type { RemoteRequest } from "../userStorage";

const KEY = "cm.github";
const REPO = "challengemon-randomizer";
// hochzaehlen wenn sich workflow oder skripte aendern
const FILES_VERSION = "1";
const API = "https://api.github.com";

interface GithubAuth {
  token: string;
  login: string;
  ready?: string;
  branch?: string;
}

function read(): GithubAuth | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GithubAuth) : null;
  } catch {
    return null;
  }
}

function write(a: GithubAuth | null) {
  if (a) localStorage.setItem(KEY, JSON.stringify(a));
  else localStorage.removeItem(KEY);
}

export function githubAccount() {
  return read();
}

export function disconnectGithub() {
  write(null);
}

export function githubClientId() {
  return process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? "";
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  return { status: res.status, data: (text ? JSON.parse(text) : null) as T };
}

export async function connectWithToken(token: string) {
  const me = await gh<{ login?: string; message?: string }>(token, "/user");
  if (me.status !== 200 || !me.data.login) throw new Error(me.data.message ?? "Token ungültig");
  write({ token, login: me.data.login });
  return me.data.login;
}

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}

// device flow, geht ueber unsere api weil github kein cors hat
export async function startDeviceLogin(): Promise<DeviceCode> {
  const res = await fetch("/api/github/device", { method: "POST" });
  const data = await res.json();
  if (!res.ok || !data.device_code) throw new Error(data.error ?? "GitHub-Anmeldung konnte nicht gestartet werden");
  return data as DeviceCode;
}

export async function pollDeviceLogin(code: DeviceCode, signal?: AbortSignal): Promise<string> {
  let wait = Math.max(5, code.interval) * 1000;
  const until = Date.now() + code.expires_in * 1000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, wait));
    if (signal?.aborted) throw new Error("abgebrochen");
    const res = await fetch("/api/github/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: code.device_code }),
    });
    const data = (await res.json()) as { access_token?: string; error?: string };
    if (data.access_token) return connectWithToken(data.access_token);
    if (data.error === "slow_down") wait += 5000;
    else if (data.error && data.error !== "authorization_pending") throw new Error(data.error);
  }
  throw new Error("Anmeldung abgelaufen");
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

async function putFile(auth: GithubAuth, path: string, content: string, message: string) {
  const existing = await gh<{ sha?: string; content?: string }>(auth.token, `/repos/${auth.login}/${REPO}/contents/${path}`);
  const encoded = b64(content);
  if (existing.status === 200 && existing.data.content?.replace(/\n/g, "") === encoded) return;
  const res = await gh<{ message?: string }>(auth.token, `/repos/${auth.login}/${REPO}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: encoded, ...(existing.data?.sha ? { sha: existing.data.sha } : {}) }),
  });
  if (res.status >= 300) throw new Error(`${path}: ${res.data.message ?? res.status}`);
}

export async function ensureRandomizerRepo(onStage?: (s: string) => void) {
  const auth = read();
  if (!auth) throw new Error("GitHub ist nicht verbunden");
  if (auth.ready === FILES_VERSION) return auth;
  onStage?.("Privates Randomizer-Repo wird eingerichtet…");
  let repo = await gh<{ message?: string; default_branch?: string }>(auth.token, `/repos/${auth.login}/${REPO}`);
  if (repo.status === 404) {
    const created = await gh<{ message?: string }>(auth.token, "/user/repos", {
      method: "POST",
      body: JSON.stringify({ name: REPO, private: true, auto_init: true, description: "Challengemon: randomisiert deine eigenen ROMs in deinem Account" }),
    });
    if (created.status >= 300) throw new Error(created.data.message ?? "Repo konnte nicht angelegt werden");
    await new Promise((r) => setTimeout(r, 2000));
    repo = await gh<{ message?: string; default_branch?: string }>(auth.token, `/repos/${auth.login}/${REPO}`);
  } else if (repo.status !== 200) throw new Error(repo.data.message ?? "Kein Zugriff auf GitHub");
  const files: [string, string][] = [
    ["randomizer/SeededRandomizer.java", "/randomizer/SeededRandomizer.java"],
    ["randomizer/run.mjs", "/randomizer/run.mjs"],
    ["randomizer/bps.mjs", "/randomizer/bps.mjs"],
    [".github/workflows/randomize.yml", "/randomizer/randomize.yml"],
  ];
  for (const [target, source] of files) {
    onStage?.(`Kopiere ${target}…`);
    const content = await (await fetch(source)).text();
    await putFile(auth, target, content, "Challengemon Randomizer aktualisieren");
  }
  const next = { ...auth, ready: FILES_VERSION, branch: repo.data.default_branch ?? "main" };
  write(next);
  return next;
}

export interface GithubJob {
  settings: string;
  seed: string;
  baseCrc: number;
  base: RemoteRequest;
  upload: RemoteRequest;
}

// direkt nach dem anlegen kennt github den workflow manchmal noch nicht
export async function dispatchRandomizer(id: string, job: GithubJob) {
  const auth = read();
  if (!auth) throw new Error("GitHub ist nicht verbunden");
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(job))));
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await gh<{ message?: string }>(auth.token, `/repos/${auth.login}/${REPO}/actions/workflows/randomize.yml/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: auth.branch ?? "main", inputs: { id, job: payload } }),
    });
    if (res.status === 204) return;
    if (res.status !== 404 && res.status !== 422) throw new Error(res.data.message ?? `GitHub ${res.status}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Der Workflow wurde von GitHub noch nicht erkannt. Versuch es in einer Minute nochmal.");
}

export interface WorkflowState {
  status: "queued" | "in_progress" | "completed" | "missing";
  conclusion: string | null;
  url: string | null;
}

// run-name im workflow ist "Randomize <id>", daran finden wir den lauf
export async function workflowState(id: string): Promise<WorkflowState> {
  const auth = read();
  if (!auth) throw new Error("GitHub ist nicht verbunden");
  const res = await gh<{ workflow_runs?: { name: string; display_title?: string; status: string; conclusion: string | null; html_url: string }[] }>(
    auth.token,
    `/repos/${auth.login}/${REPO}/actions/runs?event=workflow_dispatch&per_page=20`,
  );
  const run = res.data.workflow_runs?.find((r) => (r.display_title ?? r.name) === `Randomize ${id}`);
  if (!run) return { status: "missing", conclusion: null, url: null };
  const status = run.status === "completed" ? "completed" : run.status === "in_progress" ? "in_progress" : "queued";
  return { status, conclusion: run.conclusion, url: run.html_url };
}
