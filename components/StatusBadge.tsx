import type { PlayerStatus, RunMode } from "@/lib/types";

export const MODE_LABEL: Record<RunMode, string> = {
  soullocke: "Soullocke",
  nuzlocke: "Nuzlocke",
  casual: "Normal",
};

const STATUS: Record<PlayerStatus, { label: string; cls: string }> = {
  waiting: { label: "wartet auf Randomizer", cls: "warn" },
  randomizing: { label: "wird randomisiert…", cls: "info" },
  ready: { label: "spielbereit", cls: "good" },
  failed: { label: "fehlgeschlagen", cls: "bad" },
};

export function StatusBadge({ status }: { status: PlayerStatus }) {
  const s = STATUS[status];
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
