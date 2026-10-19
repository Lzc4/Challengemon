"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseTransport, watchBattlecam, type CamState, type CamTransport } from "@/lib/battlecam";

export default function BattleCamView({
  runId,
  me,
  target,
  name,
  transport,
  screens = "both",
}: {
  runId: string;
  me: string;
  target: string | null;
  name: string;
  transport?: () => CamTransport;
  screens?: "both" | "top";
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CamState>("connecting");

  useEffect(() => {
    if (!target) return;
    return watchBattlecam(
      me,
      target,
      (stream) => {
        if (video.current) video.current.srcObject = stream;
      },
      setState,
      transport ? transport() : supabaseTransport(runId),
    );
  }, [runId, me, target, transport]);

  return (
    <div className={`cam ${screens === "top" ? "top-only" : ""}`}>
      <video ref={video} autoPlay playsInline muted />
      {state !== "live" && (
        <div className="cam-state">{state === "offline" ? `${name} spielt gerade nicht` : `Verbinde mit ${name}…`}</div>
      )}
      {state === "live" && <span className="cam-live">● LIVE</span>}
    </div>
  );
}
