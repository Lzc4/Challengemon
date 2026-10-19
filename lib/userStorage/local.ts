import { idbDelete, idbGet, idbKeys, idbSet } from "../idb";
import type { StorageProvider } from "./types";

export function localProvider(): StorageProvider {
  return {
    kind: "local",
    label: "Dieses Gerät",
    remote: false,
    async put(path, data, onProgress) {
      await idbSet("files", path, data);
      onProgress?.(data.size, data.size);
    },
    async get(path, onProgress) {
      const blob = await idbGet<Blob>("files", path);
      if (blob) onProgress?.(blob.size, blob.size);
      return blob ?? null;
    },
    async remove(path) {
      await idbDelete("files", path);
    },
    async list(prefix) {
      const keys = (await idbKeys("files")).filter((k) => k.startsWith(prefix));
      const out = [];
      for (const k of keys) {
        const b = await idbGet<Blob>("files", k);
        out.push({ path: k, size: b?.size ?? 0 });
      }
      return out;
    },
  };
}
