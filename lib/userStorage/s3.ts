import { AwsV4Signer } from "aws4fetch";
import { readBody, xhrUpload, joinPath } from "./http";
import type { S3Config, StorageProvider } from "./types";

function objectUrl(c: S3Config, key: string, query = "") {
  const base = c.endpoint.replace(/\/+$/, "");
  const path = joinPath(c.prefix, key).split("/").map(encodeURIComponent).join("/");
  return `${base}/${encodeURIComponent(c.bucket)}/${path}${query}`;
}

// presigned urls fuer github, sonst normal signierte header
async function signed(c: S3Config, method: string, url: string, headers: Record<string, string> = {}, signQuery = false, expires = 3600) {
  const u = new URL(url);
  if (signQuery) u.searchParams.set("X-Amz-Expires", String(expires));
  const signer = new AwsV4Signer({
    method,
    url: u.toString(),
    headers,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    region: c.region || undefined,
    service: "s3",
    signQuery,
  });
  const r = await signer.sign();
  const out: Record<string, string> = {};
  r.headers.forEach((v, k) => {
    if (k !== "host") out[k] = v;
  });
  return { url: r.url.toString(), headers: out };
}

export function s3Provider(c: S3Config): StorageProvider {
  return {
    kind: "s3",
    label: `S3 · ${c.bucket}`,
    remote: true,
    async put(path, data, onProgress) {
      const s = await signed(c, "PUT", objectUrl(c, path), { "Content-Type": "application/octet-stream" });
      const res = await xhrUpload("PUT", s.url, s.headers, data, onProgress);
      if (res.status >= 300) throw new Error(`S3 Upload fehlgeschlagen (${res.status}). Ist CORS für diese Seite erlaubt?`);
    },
    async get(path, onProgress) {
      const s = await signed(c, "GET", objectUrl(c, path));
      const res = await fetch(s.url, { headers: s.headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`S3 Download fehlgeschlagen (${res.status})`);
      return readBody(res, onProgress);
    },
    async remove(path) {
      const s = await signed(c, "DELETE", objectUrl(c, path));
      await fetch(s.url, { method: "DELETE", headers: s.headers });
    },
    async list(prefix) {
      const full = joinPath(c.prefix, prefix);
      const base = `${c.endpoint.replace(/\/+$/, "")}/${encodeURIComponent(c.bucket)}`;
      const s = await signed(c, "GET", `${base}?list-type=2&prefix=${encodeURIComponent(full ? `${full}/` : "")}`);
      const res = await fetch(s.url, { headers: s.headers });
      if (!res.ok) return [];
      const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
      const strip = c.prefix ? joinPath(c.prefix).length + 1 : 0;
      return Array.from(xml.getElementsByTagName("Contents")).map((n) => ({
        path: (n.getElementsByTagName("Key")[0]?.textContent ?? "").slice(strip),
        size: Number(n.getElementsByTagName("Size")[0]?.textContent ?? 0),
      }));
    },
    async remoteRead(path) {
      const s = await signed(c, "GET", objectUrl(c, path), {}, true);
      return { method: "GET", url: s.url, headers: {} };
    },
    async remoteWrite(path) {
      const s = await signed(c, "PUT", objectUrl(c, path), {}, true);
      return { method: "PUT", url: s.url, headers: {} };
    },
  };
}
