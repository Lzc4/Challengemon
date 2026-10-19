import type { Mon } from "@/lib/save/gen4";
import PokeIcon from "../PokeIcon";

export function monName(m: Pick<Mon, "isEgg" | "isNicknamed" | "nickname" | "speciesName">) {
  return m.isEgg ? "EI" : m.isNicknamed ? m.nickname : m.speciesName;
}

export function HpBar({ mon }: { mon: Mon }) {
  const pct = mon.maxHp ? Math.max(0, Math.min(100, (mon.hp / mon.maxHp) * 100)) : 0;
  const tone = pct > 50 ? "good" : pct > 20 ? "warn" : "bad";
  return (
    <span className="px-hp">
      <span className={`px-hp-fill ${tone}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

export default function PartySlot({ mon, iconsUrl, full }: { mon: Mon; iconsUrl: string | null; full?: boolean }) {
  const fainted = !mon.isEgg && mon.hp === 0;
  return (
    <div className={`px-slot${fainted ? " fainted" : ""}${full ? " full" : ""}`}>
      <div className="px-slot-icon">
        <PokeIcon species={mon.species} isEgg={mon.isEgg} iconsUrl={iconsUrl} scale={2} animate={!fainted} />
      </div>
      <div className="px-slot-body">
        <div className="px-row">
          <span className="px-name">{monName(mon)}</span>
          {mon.gender && <span className={`px-gender ${mon.gender}`}>{mon.gender === "m" ? "♂" : "♀"}</span>}
        </div>
        {!mon.isEgg && (
          <>
            <div className="px-row">
              <span className="px-hp-tag">KP</span>
              <HpBar mon={mon} />
            </div>
            <div className="px-row px-sub">
              <span>
                <span className="px-lv">Lv</span>
                {mon.level}
              </span>
              {mon.status && <span className="px-status">{mon.status}</span>}
              <span>
                {mon.hp}/{mon.maxHp}
              </span>
            </div>
            {full && (
              <>
                <div className="px-moves">
                  {mon.moves.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
                {mon.item && <div className="px-item">✦ {mon.item}</div>}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
