import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const MB = 1024 * 1024;
export const LIMITS = {
  romSlots: Number(process.env.CLOUD_ROM_SLOTS ?? 1),
  romMax: Number(process.env.CLOUD_ROM_MAX_MB ?? 512) * MB,
  dataMax: Number(process.env.CLOUD_DATA_MAX_MB ?? 256) * MB,
  fileMax: Number(process.env.CLOUD_FILE_MAX_MB ?? 64) * MB,
};

const ROOT = path.resolve(process.env.CLOUD_DIR ?? path.join(process.cwd(), ".cloud-data"));
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ROM = /^roms\/[A-Za-z0-9_-]{1,40}-[0-9a-f]{8}\.(nds|gba|gbc|gb)$/;
const TOP = new Set(["roms", "runs", "test"]);

export class CloudError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const userDir = (user: string) => path.join(ROOT, user);

export function cleanPath(parts: string[]) {
  if (!parts.length || parts.length > 6 || !TOP.has(parts[0]) || !parts.every((p) => SEGMENT.test(p) && !p.includes(".."))) {
    throw new CloudError(400, "Ungültiger Pfad");
  }
  return parts.join("/");
}

const abs = (user: string, rel: string) => path.join(userDir(user), ...rel.split("/"));

async function walk(dir: string, base = ""): Promise<{ path: string; size: number }[]> {
  const out: { path: string; size: number }[] = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (e.name.includes(".upload-")) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(path.join(dir, e.name), rel)));
    else if (e.isFile()) out.push({ path: rel, size: (await stat(path.join(dir, e.name))).size });
  }
  return out;
}

export async function usage(user: string) {
  const files = await walk(userDir(user));
  const roms = files.filter((f) => f.path.startsWith("roms/"));
  const data = files.filter((f) => !f.path.startsWith("roms/")).reduce((n, f) => n + f.size, 0);
  return { roms, data, ...LIMITS };
}

export async function list(user: string, prefix: string) {
  const dir = prefix.replace(/\/+$/, "");
  const rel = dir ? cleanPath(dir.split("/")) : "";
  const base = rel ? abs(user, rel) : userDir(user);
  const out: { path: string; size: number }[] = [];
  for (const e of await readdir(base, { withFileTypes: true }).catch(() => [])) {
    if (!e.isFile() || e.name.includes(".upload-")) continue;
    out.push({ path: rel ? `${rel}/${e.name}` : e.name, size: (await stat(path.join(base, e.name))).size });
  }
  return out;
}

export async function read(user: string, rel: string) {
  const file = abs(user, rel);
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return null;
  return { size: info.size, stream: Readable.toWeb(createReadStream(file)) as ReadableStream };
}

export async function write(user: string, rel: string, body: ReadableStream<Uint8Array> | null, declared: number | null) {
  if (!body) throw new CloudError(400, "Leerer Upload");
  const isRom = rel.startsWith("roms/");
  let max: number;
  if (isRom) {
    if (!ROM.test(rel)) throw new CloudError(400, "Unbekanntes Spielformat");
    const now = await usage(user);
    const others = now.roms.filter((r) => r.path !== rel);
    if (others.length >= LIMITS.romSlots) {
      const name = others[0].path.slice(5);
      throw new CloudError(
        409,
        `In deiner Challengemon-Cloud ist Platz für ${LIMITS.romSlots === 1 ? "ein Spiel" : `${LIMITS.romSlots} Spiele`}. Lösch erst „${name}“ aus der Bibliothek oder nimm für dieses Spiel einen anderen Speicher.`,
      );
    }
    max = LIMITS.romMax;
  } else {
    const now = await usage(user);
    const existing = (await stat(abs(user, rel)).catch(() => null))?.size ?? 0;
    max = Math.min(LIMITS.fileMax, LIMITS.dataMax - (now.data - existing));
    if (max <= 0) throw new CloudError(413, "Dein Platz für Spielstände in der Challengemon-Cloud ist voll. Lösch alte Runs, dann geht es wieder.");
  }
  if (declared !== null && declared > max) throw new CloudError(413, "Die Datei ist zu groß für die Challengemon-Cloud.");

  const target = abs(user, rel);
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.upload-${randomBytes(6).toString("hex")}`;
  let seen = 0;
  const guard = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      if (seen > max) cb(new CloudError(413, "Die Datei ist zu groß für die Challengemon-Cloud."));
      else cb(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]), guard, createWriteStream(tmp));
    await rename(tmp, target);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
  return seen;
}

export async function remove(user: string, rel: string) {
  await rm(abs(user, rel), { force: true });
}

export async function wipe(user: string) {
  await rm(userDir(user), { recursive: true, force: true });
}
