import { supabase } from "./supabase/client";

export interface InviteStatus {
  valid: boolean;
  used: boolean;
  inviter: string | null;
}

export interface MyInvite {
  code: string;
  created_at: string;
  used_at: string | null;
  used_name: string | null;
}

export interface InviteInfo {
  quota: number;
  admin: boolean;
  created: number;
}

export const normalizeInvite = (code: string) => code.trim().toUpperCase();

export function inviteFromUrl() {
  if (typeof window === "undefined") return "";
  return normalizeInvite(new URLSearchParams(window.location.search).get("invite") ?? "");
}

export const inviteLink = (code: string) => `${window.location.origin}/login?invite=${encodeURIComponent(code)}`;

export async function inviteOnly() {
  // im zweifel nach dem code fragen, die datenbank prueft eh nochmal
  const { data, error } = await supabase().rpc("signup_info");
  if (error || !data) return true;
  return (data as { invite_only?: boolean }).invite_only !== false;
}

export async function checkInvite(code: string): Promise<InviteStatus> {
  const { data, error } = await supabase().rpc("invite_status", { code: normalizeInvite(code) });
  if (error) throw error;
  return data as InviteStatus;
}

export function inviteProblem(status: InviteStatus) {
  if (status.valid) return null;
  return status.used ? "Der Code wurde schon benutzt. Jeder Code klappt nur ein einziges Mal." : "Diesen Code kenne ich nicht. Tippfehler?";
}

export function signupError(message: string) {
  return message.includes("invite_invalid") ? "Der Einladungscode ist nicht (mehr) gültig." : message;
}

export async function myInvites(): Promise<MyInvite[]> {
  const { data, error } = await supabase().rpc("my_invites");
  if (error) throw error;
  return (data as MyInvite[]) ?? [];
}

export async function inviteInfo(): Promise<InviteInfo> {
  const { data, error } = await supabase().rpc("invite_info");
  if (error) throw error;
  return data as InviteInfo;
}

export async function createInvite(): Promise<string> {
  const { data, error } = await supabase().rpc("create_invite");
  if (error) throw new Error(error.message.includes("invite_quota") ? "Du hast alle deine Einladungen schon verteilt." : error.message);
  return data as string;
}

export async function deleteInvite(code: string) {
  const { error } = await supabase().rpc("delete_invite", { code });
  if (error) throw error;
}
