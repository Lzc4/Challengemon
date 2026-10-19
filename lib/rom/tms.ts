import data from "@/lib/data/gen4.json";
import data5 from "@/lib/data/gen5.json";
import { isGen5, type Gen4Game } from "@/lib/save/gen4";

const MOVES = data.moves as string[];
const MOVES5 = data5.moves as string[];
const TM_COUNT = 92;
const HM_COUNT = 8;
const PREFIX: Record<Gen4Game, number[]> = {
  dp: [0xd1, 0x00, 0xd2, 0x00, 0xd3, 0x00, 0xd4, 0x00],
  pt: [0xd1, 0x00, 0xd2, 0x00, 0xd3, 0x00, 0xd4, 0x00],
  hgss: [0x1e, 0x00, 0x32, 0x00],
  bw: [0x87, 0x03, 0x88, 0x03],
  b2w2: [0x87, 0x03, 0x88, 0x03],
};

const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function blzDecode(buf: Uint8Array): Uint8Array {
  const n = buf.length;
  const inc = u32(buf, n - 4);
  if (!inc) return buf;
  const hdr = buf[n - 5];
  const enc = u32(buf, n - 8) & 0xffffff;
  const out = new Uint8Array(n + inc);
  out.set(buf);
  let src = n - hdr;
  let dst = out.length;
  const end = n - enc;
  while (src > end) {
    let flags = buf[--src];
    for (let i = 0; i < 8 && src > end; i++, flags <<= 1) {
      if (flags & 0x80) {
        const hi = buf[--src];
        const lo = buf[--src];
        let len = (hi >> 4) + 3;
        const disp = (((hi & 0x0f) << 8) | lo) + 3;
        while (len-- > 0 && dst > 0) {
          dst--;
          out[dst] = out[dst + disp];
        }
      } else {
        out[--dst] = buf[--src];
      }
    }
  }
  return out;
}

export function readArm9(rom: Uint8Array) {
  const offset = u32(rom, 0x20);
  const size = u32(rom, 0x2c);
  let arm9 = rom.slice(offset, offset + size);
  while (arm9.length > 12 && u32(arm9, arm9.length - 12) === 0xdec00621) arm9 = arm9.slice(0, arm9.length - 12);
  const marker = arm9[arm9.length - 5];
  const compSize = u32(arm9, arm9.length - 8) & 0xffffff;
  if (marker >= 0x08 && marker <= 0x0b && compSize > arm9.length * 0.9 && compSize < arm9.length * 1.1) return blzDecode(arm9);
  return arm9;
}

function find(hay: Uint8Array, needle: number[]) {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

export interface TmEntry {
  label: string;
  move: number;
  moveName: string;
}

export function readTmMoves(rom: Uint8Array, game: Gen4Game): TmEntry[] | null {
  const arm9 = readArm9(rom);
  const prefix = PREFIX[game];
  const at = find(arm9, prefix);
  if (at < 0) return null;
  const start = at + prefix.length;
  const moves = isGen5(game) ? MOVES5 : MOVES;
  const hmCount = isGen5(game) ? 6 : HM_COUNT;
  const extraTms = isGen5(game) ? 3 : 0;
  const read = (i: number) => arm9[start + i * 2] | (arm9[start + i * 2 + 1] << 8);
  const entry = (label: string, move: number): TmEntry => ({ label, move, moveName: moves[move] ?? `#${move}` });
  const list: TmEntry[] = [];
  for (let i = 0; i < TM_COUNT; i++) list.push(entry(`TM${String(i + 1).padStart(2, "0")}`, read(i)));
  for (let i = 0; i < extraTms; i++) list.push(entry(`TM${TM_COUNT + i + 1}`, read(TM_COUNT + hmCount + i)));
  for (let i = 0; i < hmCount; i++) list.push(entry(`VM${String(i + 1).padStart(2, "0")}`, read(TM_COUNT + i)));
  return list;
}
