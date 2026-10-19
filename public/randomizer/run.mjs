import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createBps, crc32 } from "./bps.mjs";

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const job = JSON.parse(Buffer.from(event.inputs.job, "base64").toString("utf8"));

// tokens/urls nicht im log zeigen
for (const r of [job.base, job.upload]) {
  console.log(`::add-mask::${r.url}`);
  for (const v of Object.values(r.headers ?? {})) console.log(`::add-mask::${v}`);
}

const summary = (line) => process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);

async function main() {
  console.log("Basis-ROM wird aus deinem Speicher geladen…");
  const res = await fetch(job.base.url, { method: job.base.method, headers: job.base.headers });
  if (!res.ok) throw new Error(`Download der Basis-ROM fehlgeschlagen: ${res.status}`);
  const base = new Uint8Array(await res.arrayBuffer());
  if (crc32(base) !== job.baseCrc) throw new Error("Die Basis-ROM in deinem Speicher passt nicht zur Bibliothek (CRC)");
  writeFileSync("base.rom", base);
  writeFileSync("settings.rnqs", Buffer.from(job.settings, "base64"));

  console.log("Randomisiere…");
  execFileSync("java", ["-Xmx4g", "-cp", "upr/PokeRandoZX.jar:build", "SeededRandomizer", "settings.rnqs", "base.rom", "out.rom", String(job.seed)], { stdio: "inherit" });
  const out = new Uint8Array(readFileSync("out.rom"));

  console.log("Patch wird erstellt…");
  // nur den patch zurueckschreiben, nicht die ganze rom
  const patch = createBps(base, out);
  console.log(`Patch: ${(patch.length / 1024).toFixed(0)} KB`);

  const up = await fetch(job.upload.url, { method: job.upload.method, headers: job.upload.headers, body: patch });
  if (!up.ok) throw new Error(`Upload des Patches fehlgeschlagen: ${up.status} ${await up.text()}`);
  summary(`Randomisiert. Patch ${(patch.length / 1024).toFixed(0)} KB, ROM-CRC ${crc32(out).toString(16)}`);
}

main().catch((err) => {
  console.error(err);
  summary(`Fehler: ${err.message ?? err}`);
  process.exit(1);
});
