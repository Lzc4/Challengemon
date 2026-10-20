"use client";

import { useEffect, useState } from "react";
import { localProvider } from "./local";
import { forgetGoogle, gdriveProvider } from "./gdrive";
import { nextcloudProvider } from "./nextcloud";
import { s3Provider } from "./s3";
import { webdavProvider } from "./webdav";
import { PROVIDER_LABEL, type ProviderKind, type StorageConfig, type StorageProvider } from "./types";

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
  const k = read().active;
  return k in PROVIDER_LABEL ? k : "local";
}

export function configuredKinds(): ProviderKind[] {
  const s = read();
  const kinds = (Object.keys(s.configs) as ProviderKind[]).filter((k) => k in PROVIDER_LABEL);
  return kinds.includes("local") ? kinds : ["local", ...kinds];
}

export function providerFor(kind: ProviderKind): StorageProvider | null {
  const c = read().configs[kind];
  switch (kind) {
    case "local":
      return localProvider();
    case "gdrive":
      return c ? gdriveProvider() : null;
    case "nextcloud":
      return c && c.kind === "nextcloud" ? nextcloudProvider(c) : null;
    case "s3":
      return c && c.kind === "s3" ? s3Provider(c) : null;
    case "webdav":
      return c && c.kind === "webdav" ? webdavProvider(c) : null;
    default:
      return null;
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
