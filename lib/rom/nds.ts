const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const magic = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

export function readNdsFile(rom: Uint8Array, path: string): Uint8Array | null {
  const fnt = u32(rom, 0x40);
  const fat = u32(rom, 0x48);
  const parts = path.split("/").filter(Boolean);
  let dir = 0;
  for (let p = 0; p < parts.length; p++) {
    const entry = fnt + dir * 8;
    let pos = fnt + u32(rom, entry);
    let fileId = u16(rom, entry + 4);
    const last = p === parts.length - 1;
    let next: number | null = null;
    while (true) {
      const len = rom[pos++];
      if (!len) break;
      if (len < 0x80) {
        const name = new TextDecoder().decode(rom.subarray(pos, pos + len));
        pos += len;
        if (last && name === parts[p]) {
          const start = u32(rom, fat + fileId * 8);
          const end = u32(rom, fat + fileId * 8 + 4);
          return rom.subarray(start, end);
        }
        fileId++;
      } else {
        const n = len - 0x80;
        const name = new TextDecoder().decode(rom.subarray(pos, pos + n));
        pos += n;
        const id = u16(rom, pos) & 0xfff;
        pos += 2;
        if (!last && name === parts[p]) next = id;
      }
    }
    if (next === null) return null;
    dir = next;
  }
  return null;
}

export function readNarc(buf: Uint8Array): Uint8Array[] {
  if (magic(buf, 0) !== "NARC") throw new Error("Keine NARC-Datei");
  const fatb = u16(buf, 0x0c);
  const count = u16(buf, fatb + 8);
  const fntb = fatb + u32(buf, fatb + 4);
  const fimg = fntb + u32(buf, fntb + 4);
  const base = fimg + 8;
  const files: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const start = u32(buf, fatb + 12 + i * 8);
    const end = u32(buf, fatb + 16 + i * 8);
    files.push(buf.subarray(base + start, base + end));
  }
  return files;
}

function lz(buf: Uint8Array): Uint8Array {
  const type = buf[0];
  const size = buf[1] | (buf[2] << 8) | (buf[3] << 16);
  const out = new Uint8Array(size);
  let src = 4;
  let dst = 0;
  while (dst < size) {
    const flags = buf[src++];
    for (let bit = 7; bit >= 0 && dst < size; bit--) {
      if (!(flags & (1 << bit))) {
        out[dst++] = buf[src++];
        continue;
      }
      let len: number;
      let disp: number;
      if (type === 0x10) {
        const a = buf[src++];
        const b = buf[src++];
        len = (a >> 4) + 3;
        disp = (((a & 0xf) << 8) | b) + 1;
      } else {
        const a = buf[src++];
        const ind = a >> 4;
        if (ind === 0) {
          const b = buf[src++];
          const c = buf[src++];
          len = (((a & 0xf) << 4) | (b >> 4)) + 0x11;
          disp = (((b & 0xf) << 8) | c) + 1;
        } else if (ind === 1) {
          const b = buf[src++];
          const c = buf[src++];
          const d = buf[src++];
          len = (((a & 0xf) << 12) | (b << 4) | (c >> 4)) + 0x111;
          disp = (((c & 0xf) << 8) | d) + 1;
        } else {
          const b = buf[src++];
          len = ind + 1;
          disp = (((a & 0xf) << 8) | b) + 1;
        }
      }
      for (let i = 0; i < len && dst < size; i++, dst++) out[dst] = out[dst - disp];
    }
  }
  return out;
}

function unpack(buf: Uint8Array, want: string) {
  if (magic(buf, 0) === want) return buf;
  if (buf[0] === 0x10 || buf[0] === 0x11) {
    const out = lz(buf);
    if (magic(out, 0) === want) return out;
  }
  throw new Error(`${want} nicht gefunden`);
}

export type Rgba = [number, number, number, number];

export function readPalette(file: Uint8Array): Rgba[] {
  const b = unpack(file, "RLCN");
  const blk = u16(b, 0x0c);
  const size = u32(b, blk + 0x10);
  const start = blk + 8 + u32(b, blk + 0x14);
  const colors: Rgba[] = [];
  for (let i = 0; i + 1 < size && start + i + 1 < b.length; i += 2) {
    const v = u16(b, start + i);
    colors.push([((v & 31) * 255) / 31, (((v >> 5) & 31) * 255) / 31, (((v >> 10) & 31) * 255) / 31, 255]);
  }
  return colors;
}

export interface Graphics {
  bpp: 4 | 8;
  tiled: boolean;
  widthPx: number;
  data: Uint8Array;
}

export function readGraphics(file: Uint8Array, fallbackWidthPx: number): Graphics {
  const b = unpack(file, "RGCN");
  const blk = u16(b, 0x0c);
  const tilesW = u16(b, blk + 0x0a);
  const depth = u32(b, blk + 0x0c);
  const tiled = (u32(b, blk + 0x14) & 0xff) === 0;
  const size = u32(b, blk + 0x18);
  const start = blk + 8 + u32(b, blk + 0x1c);
  return {
    bpp: depth === 4 ? 8 : 4,
    tiled,
    widthPx: tilesW && tilesW !== 0xffff ? tilesW * 8 : fallbackWidthPx,
    data: b.subarray(start, start + size),
  };
}

export function pixelOf(g: Graphics, tile: number, x: number, y: number) {
  if (g.tiled) {
    if (g.bpp === 4) {
      const v = g.data[tile * 32 + y * 4 + (x >> 1)] ?? 0;
      return x & 1 ? v >> 4 : v & 15;
    }
    return g.data[tile * 64 + y * 8 + x] ?? 0;
  }
  const tilesPerRow = g.widthPx / 8;
  const px = (tile % tilesPerRow) * 8 + x;
  const py = Math.floor(tile / tilesPerRow) * 8 + y;
  const i = py * g.widthPx + px;
  if (g.bpp === 4) {
    const v = g.data[i >> 1] ?? 0;
    return i & 1 ? v >> 4 : v & 15;
  }
  return g.data[i] ?? 0;
}

export function readScreen(file: Uint8Array) {
  const b = unpack(file, "RCSN");
  const blk = u16(b, 0x0c);
  const width = u16(b, blk + 8);
  const height = u16(b, blk + 0x0a);
  const size = u32(b, blk + 0x10);
  const start = blk + 0x14;
  const entries = new Uint16Array(size / 2);
  for (let i = 0; i < entries.length; i++) entries[i] = u16(b, start + i * 2);
  return { width, height, entries };
}

export interface Bitmap {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

export function renderScreen(
  screen: ReturnType<typeof readScreen>,
  gfx: Graphics,
  palette: Rgba[],
  crop: { x: number; y: number; w: number; h: number },
  under?: Bitmap,
): Bitmap {
  const cols = screen.width / 8;
  const pixels = new Uint8ClampedArray(crop.w * crop.h * 4);
  for (let py = 0; py < crop.h; py++) {
    for (let px = 0; px < crop.w; px++) {
      const sx = crop.x + px;
      const sy = crop.y + py;
      const e = screen.entries[(sy >> 3) * cols + (sx >> 3)] ?? 0;
      const tile = e & 0x3ff;
      const tx = e & 0x400 ? 7 - (sx & 7) : sx & 7;
      const ty = e & 0x800 ? 7 - (sy & 7) : sy & 7;
      const idx = pixelOf(gfx, tile, tx, ty);
      const o = (py * crop.w + px) * 4;
      if (under && idx === 0) {
        pixels.set(under.pixels.subarray(o, o + 4), o);
        continue;
      }
      const c = palette[gfx.bpp === 4 ? (e >> 12) * 16 + idx : idx] ?? [0, 0, 0, 255];
      pixels[o] = c[0];
      pixels[o + 1] = c[1];
      pixels[o + 2] = c[2];
      pixels[o + 3] = 255;
    }
  }
  return { width: crop.w, height: crop.h, pixels };
}

export function renderSprite(gfx: Graphics, palette: Rgba[], bank: number, w: number, h: number, yOffset = 0): Bitmap {
  const pixels = new Uint8ClampedArray(w * h * 4);
  const tilesPerRow = w / 8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ay = y + yOffset;
      const tile = Math.floor(ay / 8) * tilesPerRow + Math.floor(x / 8);
      const idx = pixelOf(gfx, tile, x & 7, ay & 7);
      const o = (y * w + x) * 4;
      if (idx === 0) continue;
      const c = palette[bank * 16 + idx] ?? [0, 0, 0, 255];
      pixels[o] = c[0];
      pixels[o + 1] = c[1];
      pixels[o + 2] = c[2];
      pixels[o + 3] = 255;
    }
  }
  return { width: w, height: h, pixels };
}
