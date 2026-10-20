import { readBody, xhrUpload, joinPath } from "./http";
import { ROOT, type StorageProvider, type WebdavConfig } from "./types";

// kein remoteRead/remoteWrite: basic-auth passwort geben wir nicht an github
export function webdavProvider(c: WebdavConfig): StorageProvider {
  const auth = { Authorization: `Basic ${btoa(unescape(encodeURIComponent(`${c.username}:${c.password}`)))}` };
  const url = (path: string) => `${c.url.replace(/\/+$/, "")}/${joinPath(ROOT, path).split("/").map(encodeURIComponent).join("/")}`;
  const made = new Set<string>();
  async function ensureDirs(path: string) {
    const parts = joinPath(ROOT, path).split("/").slice(0, -1);
    let acc = "";
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      if (made.has(acc)) continue;
      await fetch(`${c.url.replace(/\/+$/, "")}/${acc.split("/").map(encodeURIComponent).join("/")}`, { method: "MKCOL", headers: auth }).catch(() => null);
      made.add(acc);
    }
  }
  return {
    kind: "webdav",
    label: "WebDAV",
    remote: true,
    async put(path, data, onProgress) {
      await ensureDirs(path);
      const res = await xhrUpload("PUT", url(path), auth, data, onProgress);
      if (res.status >= 300) throw new Error(`WebDAV Upload fehlgeschlagen (${res.status})`);
    },
    async get(path, onProgress) {
      const res = await fetch(url(path), { headers: auth });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`WebDAV Download fehlgeschlagen (${res.status})`);
      return readBody(res, onProgress);
    },
    async remove(path) {
      await fetch(url(path), { method: "DELETE", headers: auth });
    },
    async list(prefix) {
      const res = await fetch(url(prefix), { method: "PROPFIND", headers: { ...auth, Depth: "1" } });
      if (res.status === 401) throw new Error("WebDAV hat den Zugang abgelehnt (401)");
      if (!res.ok) return [];
      const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
      const out: { path: string; size: number }[] = [];
      for (const r of Array.from(xml.getElementsByTagNameNS("DAV:", "response"))) {
        if (r.getElementsByTagNameNS("DAV:", "collection").length) continue;
        const href = decodeURIComponent(r.getElementsByTagNameNS("DAV:", "href")[0]?.textContent ?? "");
        const name = href.split("/").filter(Boolean).pop() ?? "";
        const size = Number(r.getElementsByTagNameNS("DAV:", "getcontentlength")[0]?.textContent ?? 0);
        out.push({ path: joinPath(prefix, name), size });
      }
      return out;
    },
  };
}
