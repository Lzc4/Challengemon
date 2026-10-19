// cheerpj darf nur vom cdn geladen werden (community lizenz)
const LOADER = "https://cjrtnc.leaningtech.com/4.2/loader.js";
const CLASSPATH = "/app/randomizer/PokeRandoZX.jar:/app/randomizer/seeded.jar";

declare global {
  interface Window {
    cheerpjInit?: (opts: Record<string, unknown>) => Promise<void>;
    cheerpjRunMain?: (cls: string, classpath: string, ...args: string[]) => Promise<number>;
    cheerpOSAddStringFile?: (path: string, data: Uint8Array | string) => void;
    cjFileBlob?: (path: string) => Promise<Blob>;
  }
}

let ready: Promise<void> | null = null;
let counter = 0;

function boot() {
  if (!ready) {
    ready = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = LOADER;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Java-Laufzeit (CheerpJ) konnte nicht geladen werden"));
      document.head.appendChild(s);
    }).then(() => window.cheerpjInit!({ version: 17, status: "none" }));
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

export function localRandomizerSupported() {
  return typeof WebAssembly !== "undefined" && typeof indexedDB !== "undefined";
}

export async function randomizeLocally(base: Uint8Array, settings: Uint8Array, seed: string, onStage?: (stage: string) => void): Promise<Uint8Array> {
  onStage?.("Java-Laufzeit wird geladen…");
  await boot();
  const n = ++counter;
  const input = `/str/base-${n}.rom`;
  const rnqs = `/str/settings-${n}.rnqs`;
  const output = `/files/challengemon-${n}.rom`;
  window.cheerpOSAddStringFile!(input, base);
  window.cheerpOSAddStringFile!(rnqs, settings);
  onStage?.("ROM wird randomisiert…");
  const code = await window.cheerpjRunMain!("SeededRandomizer", CLASSPATH, rnqs, input, output, seed);
  if (code !== 0) throw new Error(`Randomizer beendet mit Code ${code}. Passt die Settings-Datei zu diesem Spiel und zur Randomizer-Version 4.6.1?`);
  const blob = await window.cjFileBlob!(output);
  const out = new Uint8Array(await blob.arrayBuffer());
  // /files liegt in cheerpjs indexeddb, sonst bleiben da hunderte mb liegen
  await window.cheerpjRunMain!("SeededRandomizer", CLASSPATH, "--delete", output).catch(() => 0);
  window.cheerpOSAddStringFile!(input, new Uint8Array(0));
  return out;
}
