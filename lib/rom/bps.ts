const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array, start = 0, end = data.length) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

class Writer {
  buf = new Uint8Array(1 << 20);
  len = 0;
  ensure(n: number) {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  byte(v: number) {
    this.ensure(1);
    this.buf[this.len++] = v;
  }
  bytes(src: Uint8Array, start: number, end: number) {
    this.ensure(end - start);
    this.buf.set(src.subarray(start, end), this.len);
    this.len += end - start;
  }
  number(v: number) {
    for (;;) {
      const x = v % 128;
      v = Math.floor(v / 128);
      if (v === 0) {
        this.byte(0x80 | x);
        return;
      }
      this.byte(x);
      v--;
    }
  }
  u32(v: number) {
    this.byte(v & 0xff);
    this.byte((v >>> 8) & 0xff);
    this.byte((v >>> 16) & 0xff);
    this.byte((v >>> 24) & 0xff);
  }
  result() {
    return this.buf.slice(0, this.len);
  }
}

// rsync-artig: source in 32-byte-bloecke hashen, im target danach suchen
const BLOCK = 32;
const MIN_MATCH = BLOCK;
const MUL = 0x01000193;

function blockHash(d: Uint8Array, o: number) {
  let h = 0x811c9dc5;
  for (let i = 0; i < BLOCK; i += 4) {
    h = Math.imul(h ^ (d[o + i] | (d[o + i + 1] << 8) | (d[o + i + 2] << 16) | (d[o + i + 3] << 24)), MUL);
  }
  return h >>> 0;
}

// patch ist bei randomizer-roms nur ein paar hundert kb gross
export function createBps(source: Uint8Array, target: Uint8Array, onProgress?: (done: number, total: number) => void): Uint8Array {
  const blocks = Math.floor(source.length / BLOCK);
  let bits = 16;
  while (1 << bits < blocks * 2 && bits < 26) bits++;
  const mask = (1 << bits) - 1;
  const table = new Int32Array(1 << bits).fill(-1);
  for (let b = 0; b < blocks; b++) {
    const slot = blockHash(source, b * BLOCK) & mask;
    if (table[slot] < 0) table[slot] = b;
  }

  const out = new Writer();
  out.bytes(new TextEncoder().encode("BPS1"), 0, 4);
  out.number(source.length);
  out.number(target.length);
  out.number(0);

  let sourceRel = 0;
  let pending = 0;
  let o = 0;
  const emitTargetRead = (end: number) => {
    if (pending >= end) return;
    out.number((end - pending - 1) * 4 + 1);
    out.bytes(target, pending, end);
    pending = end;
  };

  let tick = 0;
  while (o + BLOCK <= target.length) {
    if (++tick === 1 << 20) {
      tick = 0;
      onProgress?.(o, target.length);
    }
    let src = -1;
    if (o < source.length && o + BLOCK <= source.length && source[o] === target[o] && equalRun(source, o, target, o) >= MIN_MATCH) {
      src = o;
    } else {
      const b = table[blockHash(target, o) & mask];
      if (b >= 0 && equalRun(source, b * BLOCK, target, o) >= MIN_MATCH) src = b * BLOCK;
    }
    if (src < 0) {
      o++;
      continue;
    }
    let start = o;
    let s = src;
    // match nach hinten verlaengern
    while (start > pending && s > 0 && source[s - 1] === target[start - 1]) {
      start--;
      s--;
    }
    const len = o - start + equalRun(source, src, target, o);
    emitTargetRead(start);
    if (s === start) {
      out.number((len - 1) * 4 + 0);
    } else {
      out.number((len - 1) * 4 + 2);
      const rel = s - sourceRel;
      out.number((Math.abs(rel) * 2) + (rel < 0 ? 1 : 0));
      sourceRel = s + len;
    }
    o = start + len;
    pending = o;
  }
  emitTargetRead(target.length);

  out.u32(crc32(source));
  out.u32(crc32(target));
  const body = out.result();
  const w = new Writer();
  w.bytes(body, 0, body.length);
  w.u32(crc32(body));
  onProgress?.(target.length, target.length);
  return w.result();
}

function equalRun(a: Uint8Array, ai: number, b: Uint8Array, bi: number) {
  const max = Math.min(a.length - ai, b.length - bi);
  let n = 0;
  while (n < max && a[ai + n] === b[bi + n]) n++;
  return n;
}

export interface BpsInfo {
  sourceSize: number;
  targetSize: number;
  sourceCrc: number;
  targetCrc: number;
}

export function bpsInfo(patch: Uint8Array): BpsInfo {
  const r = { p: 4 };
  const sourceSize = readNumber(patch, r);
  const targetSize = readNumber(patch, r);
  const n = patch.length;
  const u32 = (o: number) => (patch[o] | (patch[o + 1] << 8) | (patch[o + 2] << 16) | (patch[o + 3] << 24)) >>> 0;
  return { sourceSize, targetSize, sourceCrc: u32(n - 12), targetCrc: u32(n - 8) };
}

function readNumber(d: Uint8Array, r: { p: number }) {
  let data = 0;
  let shift = 1;
  for (;;) {
    const x = d[r.p++];
    data += (x & 0x7f) * shift;
    if (x & 0x80) break;
    shift *= 128;
    data += shift;
  }
  return data;
}

// prueft source-crc vorher und target-crc danach
export function applyBps(source: Uint8Array, patch: Uint8Array): Uint8Array {
  const magic = String.fromCharCode(patch[0], patch[1], patch[2], patch[3]);
  if (magic !== "BPS1") throw new Error("Kein BPS-Patch");
  const info = bpsInfo(patch);
  if (crc32(patch, 0, patch.length - 4) !== ((patch[patch.length - 4] | (patch[patch.length - 3] << 8) | (patch[patch.length - 2] << 16) | (patch[patch.length - 1] << 24)) >>> 0)) {
    throw new Error("Patch ist beschädigt");
  }
  if (source.length !== info.sourceSize || crc32(source) !== info.sourceCrc) throw new Error("Patch passt nicht zu dieser ROM");
  const r = { p: 4 };
  readNumber(patch, r);
  const targetSize = readNumber(patch, r);
  const meta = readNumber(patch, r);
  r.p += meta;
  const target = new Uint8Array(targetSize);
  let out = 0;
  let sourceRel = 0;
  let targetRel = 0;
  const end = patch.length - 12;
  while (r.p < end) {
    const d = readNumber(patch, r);
    const cmd = d & 3;
    const len = Math.floor(d / 4) + 1;
    if (cmd === 0) {
      target.set(source.subarray(out, out + len), out);
      out += len;
    } else if (cmd === 1) {
      target.set(patch.subarray(r.p, r.p + len), out);
      r.p += len;
      out += len;
    } else {
      const v = readNumber(patch, r);
      const off = (v & 1 ? -1 : 1) * Math.floor(v / 2);
      if (cmd === 2) {
        sourceRel += off;
        target.set(source.subarray(sourceRel, sourceRel + len), out);
        sourceRel += len;
        out += len;
      } else {
        targetRel += off;
        for (let i = 0; i < len; i++) target[out++] = target[targetRel++];
      }
    }
  }
  if (crc32(target) !== info.targetCrc) throw new Error("Ergebnis stimmt nicht (CRC)");
  return target;
}
