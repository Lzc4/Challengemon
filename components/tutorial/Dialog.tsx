"use client";

import { useCallback, useEffect, useState } from "react";

export function useTypewriter(text: string) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const t = setInterval(() => setShown((n) => (n >= text.length ? n : n + 1)), 22);
    return () => clearInterval(t);
  }, [text]);
  return { visible: text.slice(0, shown), done: shown >= text.length, finish: () => setShown(text.length) };
}

const typing = (el: EventTarget | null) => el instanceof HTMLElement && !!el.closest("input, textarea, select, button, a");

export default function Dialog({
  text,
  who,
  onNext,
  children,
}: {
  text: string;
  who?: string;
  onNext?: () => void;
  children?: React.ReactNode;
}) {
  const tw = useTypewriter(text);
  const advance = useCallback(() => {
    if (!tw.done) tw.finish();
    else onNext?.();
  }, [tw, onNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.key === "Enter" || e.key === " " || e.key.toLowerCase() === "z") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  return (
    <div className="tut-dialog" onClick={(e) => !typing(e.target) && advance()} role="dialog" aria-live="polite">
      {who && <span className="tut-who">{who}</span>}
      <p>{tw.visible}</p>
      {tw.done && children}
      {tw.done && onNext && <span className="tut-next">▼</span>}
    </div>
  );
}
