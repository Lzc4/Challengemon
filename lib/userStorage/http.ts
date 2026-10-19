import type { Progress } from "./types";

export async function readBody(res: Response, onProgress?: Progress): Promise<Blob> {
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body || !onProgress) return res.blob();
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let done = 0;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    parts.push(value);
    done += value.length;
    onProgress(done, total || done);
  }
  return new Blob(parts as BlobPart[]);
}

export function xhrUpload(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Blob,
  onProgress?: Progress,
): Promise<{ status: number; text: string; headers: (name: string) => string | null }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => onProgress?.(e.loaded, e.total || body.size);
    x.onload = () => resolve({ status: x.status, text: x.responseText, headers: (n) => x.getResponseHeader(n) });
    x.onerror = () => reject(new Error(`Upload fehlgeschlagen (${url.split("?")[0]})`));
    x.send(body);
  });
}

export function joinPath(...parts: string[]) {
  return parts
    .flatMap((p) => p.split("/"))
    .filter(Boolean)
    .join("/");
}
