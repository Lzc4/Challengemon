"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";
import type { Profile } from "./types";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase()
      .auth.getUser()
      .then(({ data }: { data: { user: User | null } }) => setUser(data.user));
  }, []);
  return user;
}

export function useMyProfile() {
  const user = useUser();
  const [me, setMe] = useState<Profile | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase()
      .from("profiles")
      .select("id, name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: { data: Profile | null }) => setMe(data));
  }, [user]);
  return me;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  useEffect(() => {
    supabase()
      .from("profiles")
      .select("id, name")
      .order("name")
      .then(({ data }: { data: Profile[] | null }) => setProfiles(data ?? []));
  }, []);
  return profiles;
}

export function formatBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "nie";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const CAPS_EVENT = "level-caps-change";
const capsKey = (runId: string) => `level-caps:${runId}`;

function readCaps(runId: string) {
  try {
    return localStorage.getItem(capsKey(runId)) !== "off";
  } catch {
    return true;
  }
}

export function useLevelCaps(runId: string | null | undefined): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!runId) return;
    const sync = () => setOn(readCaps(runId));
    sync();
    window.addEventListener(CAPS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CAPS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [runId]);
  const set = (value: boolean) => {
    if (!runId) return;
    try {
      localStorage.setItem(capsKey(runId), value ? "on" : "off");
    } catch {}
    setOn(value);
    window.dispatchEvent(new Event(CAPS_EVENT));
  };
  return [on, set];
}
