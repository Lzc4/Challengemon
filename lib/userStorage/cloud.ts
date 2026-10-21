import { supabase } from "@/lib/supabase/client";
import { gunzipBlob, gzipBlob, isGzip } from "@/lib/compress";
import { readBody, xhrUpload } from "./http";
import type { StorageProvider } from "./types";

const API = "/api/cloud";

export interface CloudUsage {
  roms: { path: string; size: number }[];
  data: number;
  romSlots: number;
  romMax: number;
  dataMax: number;
  fileMax: number;
}

async function auth() {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Für die Challengemon-Cloud musst du eingeloggt sein");
  return { Authorization: `Bearer ${token}` };
}

const url = (path: string) => `${API}/${path.split("/").map(encodeURIComponent).join("/")}`;

async function problem(res: { status: number; text: string }) {
  try {
    return (JSON.parse(res.text) as { error?: string }).error ?? `Fehler ${res.status}`;
  } catch {
    return res.status === 413 ? "Die Datei ist zu groß für die Challengemon-Cloud." : `Challengemon-Cloud antwortet mit Fehler ${res.status}`;
  }
}

export async function cloudUsage(): Promise<CloudUsage> {
  const res = await fetch(`${API}?usage=1`, { headers: await auth() });
  if (!res.ok) throw new Error(await problem({ status: res.status, text: await res.text() }));
  return res.json();
}

export async function wipeCloud() {
  await fetch(API, { method: "DELETE", headers: await auth() });
}

// roms schrumpfen mit gzip auf 30-45 %, spart platz auf dem server und zeit beim laden
const packed = (path: string) => path.startsWith("roms/");

// gehoert zum konto, braucht keine einrichtung und geht auf jedem geraet
export function cloudProvider(): StorageProvider {
  return {
    kind: "cloud",
    label: "Challengemon-Cloud",
    remote: true,
    async put(path, data, onProgress) {
      let body = data;
      let report = onProgress;
      if (packed(path)) {
        // packen zaehlt als erstes fuenftel vom balken
        body = await gzipBlob(data, (d, t) => onProgress?.((d / t) * 0.2, 1));
        report = onProgress && ((d, t) => onProgress(0.2 + (d / t) * 0.8, 1));
      }
      const res = await xhrUpload("PUT", url(path), await auth(), body, report);
      if (res.status >= 300) throw new Error(await problem(res));
    },
    async get(path, onProgress) {
      const res = await fetch(url(path), { headers: await auth() });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(await problem({ status: res.status, text: await res.text() }));
      const blob = await readBody(res, onProgress);
      return packed(path) && (await isGzip(blob)) ? gunzipBlob(blob) : blob;
    },
    async remove(path) {
      await fetch(url(path), { method: "DELETE", headers: await auth() });
    },
    async list(prefix) {
      const res = await fetch(`${API}?prefix=${encodeURIComponent(prefix)}`, { headers: await auth() });
      if (!res.ok) throw new Error(await problem({ status: res.status, text: await res.text() }));
      return res.json();
    },
  };
}
