"use client";

// eigene chiptune-toene per web audio, keine dateien
const KEY = "cm.sound";
let ctx: AudioContext | null = null;

export function soundOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
}

function audio() {
  if (!soundOn() || typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tones(notes: [freq: number, ms: number][], volume = 0.05, type: OscillatorType = "square") {
  const ac = audio();
  if (!ac) return;
  let t = ac.currentTime + 0.005;
  for (const [freq, ms] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.01);
    t += ms / 1000;
  }
}

export const sfx = {
  next: () => tones([[1318, 35], [1760, 45]]),
  move: () => tones([[988, 28]], 0.035),
  confirm: () => tones([[784, 60], [1047, 60], [1568, 110]], 0.045),
  back: () => tones([[659, 50], [440, 70]], 0.04),
};
