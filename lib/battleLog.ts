import type { Mon } from "./save/gen4";

export interface LogEntry {
  id: number;
  at: number;
  text: string;
  tone: "info" | "good" | "bad";
}

const name = (m: Mon) => (m.isEgg ? "Ei" : m.isNicknamed ? m.nickname : m.speciesName);
let seq = 0;

export function diffParty(prev: Mon[] | null, next: Mon[]): LogEntry[] {
  if (!prev) return [];
  const out: LogEntry[] = [];
  const push = (text: string, tone: LogEntry["tone"] = "info") => out.push({ id: ++seq, at: Date.now(), text, tone });
  const before = new Map(prev.map((m) => [m.pid, m]));
  for (const m of next) {
    const p = before.get(m.pid);
    if (!p) {
      push(`${name(m)} ist jetzt im Team.`, "good");
      continue;
    }
    if (p.species !== m.species && !p.isEgg) push(`${name(p)} hat sich zu ${m.speciesName} entwickelt!`, "good");
    if (p.isEgg && !m.isEgg) push(`Aus dem Ei ist ${m.speciesName} geschlüpft!`, "good");
    if (m.level > p.level) push(`${name(m)} erreicht Lv. ${m.level}!`, "good");
    for (const mv of m.moves) if (!p.moves.includes(mv)) push(`${name(m)} hat ${mv} erlernt!`, "good");
    if (m.hp === 0 && p.hp > 0) push(`${name(m)} wurde besiegt!`, "bad");
    else if (m.hp < p.hp) push(`${name(m)} verliert ${p.hp - m.hp} KP (${m.hp}/${m.maxHp}).`, "bad");
    else if (m.hp > p.hp && m.level === p.level) push(`${name(m)} wurde um ${m.hp - p.hp} KP geheilt.`, "info");
    if (m.status && m.status !== p.status) push(`${name(m)} ist jetzt ${m.status}.`, "bad");
    if (m.item !== p.item && m.item) push(`${name(m)} trägt jetzt ${m.item}.`, "info");
  }
  const nextPids = new Set(next.map((m) => m.pid));
  for (const p of prev) if (!nextPids.has(p.pid)) push(`${name(p)} hat das Team verlassen.`, "info");
  return out;
}
