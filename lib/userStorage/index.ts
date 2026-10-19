"use client";

import { useEffect, useState } from "react";
import { localProvider } from "./local";
import { forgetGoogle, gdriveProvider } from "./gdrive";
import { dropboxConnected, dropboxProvider } from "./dropbox";
import { s3Provider } from "./s3";
import { webdavProvider } from "./webdav";
import type { ProviderKind, StorageConfig, StorageProvider } from "./types";

export * from "./types";

const KEY = "cm.storage";
const EVENT = "cm-storage-changed";

interface Saved {
  active: ProviderKind;
  configs: Partial<Record<ProviderKind, StorageConfig>>;
}

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {}
  return { active: "local", configs: { local: { kind: "local" } } };
}

function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function configureStorage(config: StorageConfig, makeActive = true) {
  const s = read();
  s.configs[config.kind] = config;
  if (makeActive) s.active = config.kind;
  write(s);
}

export function forgetStorage(kind: ProviderKind) {
  if (kind === "gdrive") forgetGoogle();
  const s = read();
  delete s.configs[kind];
  if (s.active === kind) s.active = "local";
  s.configs.local = { kind: "local" };
  write(s);
}

export function activeKind(): ProviderKind {
  return read().active;
}

export function configuredKinds(): ProviderKind[] {
  const s = read();
  const kinds = Object.keys(s.configs) as ProviderKind[];
  if (dropboxConnected() && !kinds.includes("dropbox")) kinds.push("dropbox");
  return kinds.includes("local") ? kinds : ["local", ...kinds];
}

export function providerFor(kind: ProviderKind): StorageProvider | null {
  const c = read().configs[kind];
  switch (kind) {
    case "local":
      return localProvider();
    case "gdrive":
      return c ? gdriveProvider() : null;
    case "dropbox":
      return c || dropboxConnected() ? dropboxProvider() : null;
    case "s3":
      return c && c.kind === "s3" ? s3Provider(c) : null;
    case "webdav":
      return c && c.kind === "webdav" ? webdavProvider(c) : null;
  }
}

export function activeProvider(): StorageProvider {
  return providerFor(activeKind()) ?? localProvider();
}

export function storageConfig(kind: ProviderKind) {
  return read().configs[kind] ?? null;
}

export function useStorageKind() {
  const [kind, setKind] = useState<ProviderKind>("local");
  useEffect(() => {
    const sync = () => setKind(activeKind());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return kind;
}
