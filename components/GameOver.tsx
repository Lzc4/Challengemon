"use client";

import Link from "next/link";

export default function GameOver({
  reason,
  stats,
  runId,
  onContinue,
}: {
  reason: string;
  stats: { name: string; deaths: number; caught: number }[];
  runId: string;
  onContinue: () => void;
}) {
  return (
    <div className="gameover">
      <div className="gameover-box">
        <div className="gameover-title">GAME OVER</div>
        <p>{reason}</p>
        <div className="gameover-stats">
          {stats.map((s) => (
            <div key={s.name}>
              <b>{s.name}</b>
              <span>
                {s.caught} gefangen · ✝ {s.deaths}
              </span>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href={`/runs/${runId}`} className="button primary">
            Zum Run
          </Link>
          <button type="button" onClick={onContinue}>
            Trotzdem weiterspielen
          </button>
        </div>
      </div>
    </div>
  );
}
