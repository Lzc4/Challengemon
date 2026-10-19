import data from "@/lib/data/gen4.json";
import data5 from "@/lib/data/gen5.json";
import { onMainMatrix } from "./maps";

const CHARS = data.chars as string[];
const SPECIES = data.species as string[];
const MOVES = data.moves as string[];
const LOCATIONS = data.locations as Record<string, string>;
const ITEMS = data.items as Record<string, string>;

interface Dex {
  species: string[];
  moves: string[];
  locations: Record<string, string>;
  items: Record<string, string>;
  text: (b: Uint8Array, offset: number, maxChars: number) => string;
  gen5: boolean;
}

function decodeText5(b: Uint8Array, offset: number, maxChars: number) {
  let out = "";
  for (let i = 0; i < maxChars; i++) {
    const v = b[offset + i * 2] | (b[offset + i * 2 + 1] << 8);
    if (v === 0xffff || v === 0) break;
    out += v === 0x246d || v === 0xe08e ? "♂" : v === 0x246e || v === 0xe08f ? "♀" : String.fromCharCode(v);
  }
  return out;
}

const DEX4: Dex = { species: SPECIES, moves: MOVES, locations: LOCATIONS, items: ITEMS, text: (b, o, n) => decodeText(b, o, n), gen5: false };
const DEX5: Dex = {
  species: data5.species as string[],
  moves: data5.moves as string[],
  locations: data5.locations as Record<string, string>,
  items: data5.items as Record<string, string>,
  text: decodeText5,
  gen5: true,
};

export function isGen5(game: Gen4Game | null | undefined) {
  return game === "bw" || game === "b2w2";
}

function dexOf(game?: Gen4Game | null) {
  return isGen5(game) ? DEX5 : DEX4;
}

export const PARTITION = 0x40000;
const PARTY_SIZE = 236;
// gen5 party-mons sind kleiner als in gen4
const PARTY_SIZE5 = 220;
const partySize = (game?: Gen4Game) => (game === "bw" || game === "b2w2" ? PARTY_SIZE5 : PARTY_SIZE);
const STORED_SIZE = 136;
const BOX_COUNT = 18;
const BOX_SLOTS = 30;

export type Gen4Game = "hgss" | "pt" | "dp" | "bw" | "b2w2";
export type Gen4Only = "hgss" | "pt" | "dp";

export interface Gen4Layout {
  generalSize: number;
  footerSize: number;
  trainer: number;
  party: number;
  storageStart: number;
  storageSize: number;
  box: (box: number) => number;
  map: number;
  posX: number;
  posY: number;
  exitX: number | null;
  exitY: number | null;
  medicine: number;
  badges: number;
}

export const LAYOUTS: Record<Gen4Only, Gen4Layout> = {
  hgss: {
    generalSize: 0xf628,
    footerSize: 0x10,
    trainer: 0x64,
    party: 0x98,
    storageStart: 0xf700,
    storageSize: 0x12310,
    box: (box) => box * 0x1000,
    map: 0x1234,
    posX: 0x123c,
    posY: 0x1240,
    exitX: null,
    exitY: null,
    medicine: 0xb64,
    badges: 16,
  },
  pt: {
    generalSize: 0xcf2c,
    footerSize: 0x14,
    trainer: 0x68,
    party: 0xa0,
    storageStart: 0xcf2c,
    storageSize: 0x121e4,
    box: (box) => 4 + box * BOX_SLOTS * STORED_SIZE,
    map: 0x1280,
    posX: 0x1288,
    posY: 0x128c,
    exitX: 0x12d8,
    exitY: 0x12dc,
    medicine: 0xb4c,
    badges: 8,
  },
  dp: {
    generalSize: 0xc100,
    footerSize: 0x14,
    trainer: 0x64,
    party: 0x98,
    storageStart: 0xc100,
    storageSize: 0x121e0,
    box: (box) => 4 + box * BOX_SLOTS * STORED_SIZE,
    map: 0x1238,
    posX: 0x1240,
    posY: 0x1244,
    exitX: 0x1290,
    exitY: 0x1294,
    medicine: 0xb40,
    badges: 8,
  },
};

export function gen4Game(gameCode: string | null | undefined): Gen4Game | null {
  const prefix = gameCode?.slice(0, 3);
  if (prefix === "IPK" || prefix === "IPG") return "hgss";
  if (prefix === "CPU") return "pt";
  if (prefix === "ADA" || prefix === "APA") return "dp";
  if (prefix === "IRB" || prefix === "IRA") return "bw";
  if (prefix === "IRE" || prefix === "IRD") return "b2w2";
  return null;
}

const BLOCK_POSITION = [
  0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 1, 0, 2, 3, 1, 0, 3, 2, 2, 0, 1, 3, 3, 0, 1, 2, 2, 0, 3,
  1, 3, 0, 2, 1, 1, 2, 0, 3, 1, 3, 0, 2, 2, 1, 0, 3, 3, 1, 0, 2, 2, 3, 0, 1, 3, 2, 0, 1, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3,
  1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 0,
];

export interface Mon {
  pid: number;
  species: number;
  speciesName: string;
  nickname: string;
  isNicknamed: boolean;
  isEgg: boolean;
  shiny: boolean;
  gender: "m" | "f" | null;
  level: number;
  hp: number;
  maxHp: number;
  status: string | null;
  item: string | null;
  moves: string[];
  metLocation: number;
  metLocationName: string | null;
  eggLocation: number;
  eggLocationName: string | null;
  metLevel: number;
  tid: number;
}

export interface Gen4Save {
  game: Gen4Game;
  trainer: string;
  tid: number;
  money: number;
  badges: number;
  kantoBadges: number;
  playSeconds: number;
  party: Mon[];
  boxes: Mon[];
}

export const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function crc16(b: Uint8Array) {
  let crc = 0xffff;
  for (let i = 0; i < b.length; i++) {
    crc ^= b[i] << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function bits(n: number) {
  let c = 0;
  for (let v = n; v; v >>= 1) c += v & 1;
  return c;
}

export function decodeText(b: Uint8Array, offset: number, maxChars: number) {
  let out = "";
  for (let i = 0; i < maxChars; i++) {
    const v = u16(b, offset + i * 2);
    if (v === 0xffff || v === 0) break;
    const c = CHARS[v] ?? "";
    out += c === "" ? "♂" : c === "" ? "♀" : c;
  }
  return out;
}

function crypt(b: Uint8Array, start: number, end: number, seed: number) {
  let s = seed >>> 0;
  for (let i = start; i < end; i += 2) {
    s = (Math.imul(0x41c64e6d, s) + 0x6073) >>> 0;
    const x = s >>> 16;
    b[i] ^= x & 0xff;
    b[i + 1] ^= x >>> 8;
  }
}

function decryptMon(raw: Uint8Array): Uint8Array | null {
  const b = new Uint8Array(raw);
  const pid = u32(b, 0);
  const chk = u16(b, 6);
  crypt(b, 8, STORED_SIZE, chk);
  if (b.length > STORED_SIZE) crypt(b, STORED_SIZE, b.length, pid);
  const sv = (pid >>> 13) & 31;
  const order = BLOCK_POSITION.slice((sv % 24) * 4, (sv % 24) * 4 + 4);
  const blocks = [0, 1, 2, 3].map((i) => b.slice(8 + i * 32, 8 + (i + 1) * 32));
  order.forEach((src, i) => b.set(blocks[src], 8 + i * 32));
  let sum = 0;
  for (let i = 8; i < STORED_SIZE; i += 2) sum = (sum + u16(b, i)) & 0xffff;
  if (sum !== chk) return null;
  return b;
}

function encryptMon(dec: Uint8Array): Uint8Array {
  const b = new Uint8Array(dec);
  const pid = u32(b, 0);
  let sum = 0;
  for (let i = 8; i < STORED_SIZE; i += 2) sum = (sum + u16(b, i)) & 0xffff;
  b[6] = sum & 0xff;
  b[7] = sum >> 8;
  const sv = (pid >>> 13) & 31;
  const order = BLOCK_POSITION.slice((sv % 24) * 4, (sv % 24) * 4 + 4);
  const blocks = [0, 1, 2, 3].map((i) => b.slice(8 + i * 32, 8 + (i + 1) * 32));
  order.forEach((dst, i) => b.set(blocks[i], 8 + dst * 32));
  crypt(b, 8, STORED_SIZE, sum);
  if (b.length > STORED_SIZE) crypt(b, STORED_SIZE, b.length, pid);
  return b;
}

export type TeachResult = "taught" | "notfound" | "invalid";

export function teachMoveInState(state: Uint8Array, game: Gen4Game, slot: number, moveIndex: number, move: number, pp = 15): TeachResult {
  if (move < 1 || move >= dexOf(game).moves.length || moveIndex < 0 || moveIndex > 3) return "invalid";
  const found = scanParty(state, game);
  if (!found || !trustedGeneral(state, found.offset, found.party, game) || slot >= found.party.length) return "notfound";
  const size = partySize(game);
  const off = found.offset + slot * size;
  const dec = decryptMon(state.subarray(off, off + size));
  if (!dec) return "notfound";
  for (let i = 0; i < 4; i++) if (i !== moveIndex && u16(dec, 0x28 + i * 2) === move) return "invalid";
  dec[0x28 + moveIndex * 2] = move & 0xff;
  dec[0x29 + moveIndex * 2] = move >> 8;
  dec[0x30 + moveIndex] = pp;
  dec[0x34 + moveIndex] = 0;
  state.set(encryptMon(dec), off);
  return "taught";
}

export const MOVE_NAMES = MOVES.map((name, id) => ({ id, name })).filter((m) => m.id > 0 && m.name);

export function moveNamesFor(game: Gen4Game | null) {
  return dexOf(game)
    .moves.map((name, id) => ({ id, name }))
    .filter((m) => m.id > 0 && m.name);
}

const GEN5 = { party: 0x18e00, trainer: 0x19400, position: 0x19500, bag: 0x18400, boxes: 0x400, boxCount: 24 };
const GEN5_MISC: Record<"bw" | "b2w2", number> = { bw: 0x21200, b2w2: 0x21100 };

function parseGen5Save(buf: Uint8Array, game: "bw" | "b2w2"): Gen4Save | null {
  if (buf.length < 0x24000) return null;
  const count = buf[GEN5.party + 4];
  if (count > 6) return null;
  const party: Mon[] = [];
  for (let i = 0; i < count; i++) {
    const off = GEN5.party + 8 + i * PARTY_SIZE5;
    const dec = decryptMon(buf.subarray(off, off + PARTY_SIZE5));
    if (!dec) return null;
    party.push(readMon(dec, DEX5));
  }
  const boxes: Mon[] = [];
  for (let box = 0; box < GEN5.boxCount; box++) {
    for (let slot = 0; slot < BOX_SLOTS; slot++) {
      const off = GEN5.boxes + box * 0x1000 + slot * STORED_SIZE;
      const raw = buf.subarray(off, off + STORED_SIZE);
      if (raw.every((v) => v === 0)) continue;
      const dec = decryptMon(raw);
      if (!dec) continue;
      const mon = readMon(dec, DEX5);
      if (mon.species > 0 && mon.species < DEX5.species.length) boxes.push(mon);
    }
  }
  const t = GEN5.trainer;
  const misc = GEN5_MISC[game];
  return {
    game,
    trainer: decodeText5(buf, t + 4, 8),
    tid: u16(buf, t + 0x14),
    money: u32(buf, misc),
    badges: bits(buf[misc + 4]),
    kantoBadges: 0,
    playSeconds: u16(buf, t + 0x24) * 3600 + buf[t + 0x26] * 60 + buf[t + 0x27],
    party,
    boxes,
  };
}

function statusText(s: number) {
  if (s & 0x7) return "SLF";
  if (s & 0x80) return "GIF+";
  if (s & 0x8) return "GIF";
  if (s & 0x10) return "BRT";
  if (s & 0x20) return "GFR";
  if (s & 0x40) return "PAR";
  return null;
}

function readMon(b: Uint8Array, dex: Dex = DEX4): Mon {
  const pid = u32(b, 0);
  const species = u16(b, 0x08);
  const iv = u32(b, 0x38);
  const isEgg = ((iv >>> 30) & 1) === 1;
  const tid = u16(b, 0x0c);
  const sid = u16(b, 0x0e);
  const shiny = ((tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) & 0xffff) < 8;
  const genderBits = (b[0x40] >> 1) & 3;
  const met = dex.gen5 ? u16(b, 0x80) : u16(b, 0x46) || u16(b, 0x80);
  const egg = dex.gen5 ? u16(b, 0x7e) : u16(b, 0x44) || u16(b, 0x7e);
  const itemId = u16(b, 0x0a);
  const moves = [0x28, 0x2a, 0x2c, 0x2e].map((o) => u16(b, o)).filter(Boolean).map((m) => dex.moves[m] || `#${m}`);
  const hasStats = b.length > STORED_SIZE;
  return {
    pid,
    species,
    speciesName: dex.species[species] || `#${species}`,
    nickname: dex.text(b, 0x48, 11),
    isNicknamed: ((iv >>> 31) & 1) === 1,
    isEgg,
    shiny,
    gender: genderBits === 0 ? "m" : genderBits === 1 ? "f" : null,
    level: hasStats ? b[0x8c] : 0,
    hp: hasStats ? u16(b, 0x8e) : 0,
    maxHp: hasStats ? u16(b, 0x90) : 0,
    status: hasStats ? statusText(u32(b, 0x88)) : null,
    item: itemId ? dex.items[itemId] ?? `Item #${itemId}` : null,
    moves,
    metLocation: met,
    metLocationName: dex.locations[met] ?? null,
    eggLocation: egg,
    eggLocationName: egg ? dex.locations[egg] ?? null : null,
    metLevel: b[0x84] & 0x7f,
    tid,
  };
}

function readParty(g: Uint8Array, L: Gen4Layout): Mon[] | null {
  const count = g[L.party - 4];
  if (count < 1 || count > 6) return null;
  const party: Mon[] = [];
  for (let i = 0; i < count; i++) {
    const off = L.party + i * PARTY_SIZE;
    const dec = decryptMon(g.subarray(off, off + PARTY_SIZE));
    if (!dec) return null;
    party.push(readMon(dec));
  }
  return party;
}

function footerNewer(buf: Uint8Array, start: number, size: number) {
  const a = start + size - 0x14;
  const b = a + PARTITION;
  if (buf.length < b + 8) return 0;
  const cmp = (x: number, y: number) => {
    if (x === 0xffffffff && y !== 0xfffffffe) return 1;
    if (y === 0xffffffff && x !== 0xfffffffe) return 0;
    return x > y ? 0 : x < y ? 1 : -1;
  };
  const major = cmp(u32(buf, a), u32(buf, b));
  if (major !== -1) return major;
  return cmp(u32(buf, a + 4), u32(buf, b + 4)) === 1 ? 1 : 0;
}

function readBoxes(buf: Uint8Array, L: Gen4Layout): Mon[] {
  const candidates = [0, PARTITION]
    .map((p) => p + L.storageStart)
    .filter((o) => buf.length >= o + L.storageSize)
    .map((o) => ({ o, ok: crc16(buf.subarray(o, o + L.storageSize - L.footerSize)) === u16(buf, o + L.storageSize - 2) }));
  const valid = candidates.filter((c) => c.ok);
  let start: number;
  if (valid.length === 2) start = footerNewer(buf, L.storageStart, L.storageSize) === 1 ? valid[1].o : valid[0].o;
  else if (valid.length === 1) start = valid[0].o;
  else return [];
  const mons: Mon[] = [];
  for (let box = 0; box < BOX_COUNT; box++) {
    for (let slot = 0; slot < BOX_SLOTS; slot++) {
      const off = start + L.box(box) + slot * STORED_SIZE;
      const raw = buf.subarray(off, off + STORED_SIZE);
      if (raw.every((v) => v === 0)) continue;
      const dec = decryptMon(raw);
      if (!dec) continue;
      const mon = readMon(dec);
      if (mon.species > 0 && mon.species < SPECIES.length) mons.push(mon);
    }
  }
  return mons;
}

function readSlot(buf: Uint8Array, offset: number, game: Gen4Only) {
  const L = LAYOUTS[game];
  const TRAINER = L.trainer;
  if (buf.length < offset + L.generalSize) return null;
  const g = buf.subarray(offset, offset + L.generalSize);
  const crcOk = crc16(g.subarray(0, L.generalSize - L.footerSize)) === u16(g, L.generalSize - 2);
  const party = readParty(g, L);
  const hours = u16(g, TRAINER + 0x22);
  const minutes = g[TRAINER + 0x24];
  const seconds = g[TRAINER + 0x25];
  if (minutes > 59 || seconds > 59) return null;
  return {
    crcOk,
    save: {
      game,
      trainer: decodeText(g, TRAINER, 8),
      tid: u16(g, TRAINER + 0x10),
      money: u32(g, TRAINER + 0x14),
      badges: bits(g[TRAINER + 0x1a]),
      kantoBadges: game === "hgss" ? bits(g[TRAINER + 0x1f]) : 0,
      playSeconds: hours * 3600 + minutes * 60 + seconds,
      party: party ?? [],
      boxes: [] as Mon[],
    } satisfies Gen4Save,
    partyOk: !!party,
  };
}

export function parseGen4Save(buf: Uint8Array, game: Gen4Game): Gen4Save | null {
  if (game === "bw" || game === "b2w2") return parseGen5Save(buf, game);
  const g4 = game as Gen4Only;
  const slots = [readSlot(buf, 0, g4), readSlot(buf, PARTITION, g4)].filter((s): s is NonNullable<typeof s> => !!s);
  const pool = slots.filter((s) => s.crcOk).length ? slots.filter((s) => s.crcOk) : slots.filter((s) => s.partyOk);
  if (!pool.length) return null;
  pool.sort((a, b) => b.save.playSeconds - a.save.playSeconds);
  const save = pool[0].save;
  save.boxes = readBoxes(buf, LAYOUTS[g4]);
  return save;
}

export function spriteUrl(mon: Pick<Mon, "species" | "shiny" | "isEgg">) {
  const base =
    mon.species > 493
      ? "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white"
      : "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iv/heartgold-soulsilver";
  if (mon.isEgg) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/egg.png";
  return `${base}${mon.shiny ? "/shiny" : ""}/${mon.species}.png`;
}

export interface LiveState {
  party: Mon[];
  mapId: number | null;
  x: number | null;
  y: number | null;
}

export function findLiveState(state: Uint8Array, game: Gen4Game): LiveState | null {
  const found = scanParty(state, game);
  if (!found) return null;
  if (game === "bw" || game === "b2w2") {
    const gen = found.offset - GEN5.party - 8;
    if (gen < 0 || gen + GEN5.position + 0x90 > state.length || !trustedGeneral(state, found.offset, found.party, game)) {
      return { party: found.party, mapId: null, x: null, y: null };
    }
    const mapId = u16(state, gen + GEN5.position + 0x80);
    if (mapId >= 1000) return { party: found.party, mapId: null, x: null, y: null };
    return { party: found.party, mapId, x: u16(state, gen + GEN5.position + 0x86), y: u16(state, gen + GEN5.position + 0x8e) };
  }
  const L = LAYOUTS[game];
  const gen = found.offset - L.party;
  const ok = gen >= 0 && gen + L.posY + 4 <= state.length && (L.exitY === null || gen + L.exitY + 4 <= state.length);
  if (!ok) return { party: found.party, mapId: null, x: null, y: null };
  const mapId = u16(state, gen + L.map);
  if (mapId >= 600) return { party: found.party, mapId: null, x: null, y: null };
  let x = u16(state, gen + L.posX);
  let y = u16(state, gen + L.posY);
  if (L.exitX !== null && L.exitY !== null && !onMainMatrix(game, mapId)) {
    x = u16(state, gen + L.exitX);
    y = u16(state, gen + L.exitY);
  }
  return { party: found.party, mapId, x, y };
}

export function findGeneralOffset(state: Uint8Array, game: Gen4Game): number | null {
  const found = scanParty(state, game);
  if (!found || !trustedGeneral(state, found.offset, found.party, game)) return null;
  const gen = game === "bw" || game === "b2w2" ? found.offset - GEN5.party - 8 : found.offset - LAYOUTS[game].party;
  return gen >= 0 ? gen : null;
}

export function findLiveParty(state: Uint8Array): Mon[] | null {
  return scanParty(state)?.party ?? null;
}

function trustedGeneral(state: Uint8Array, offset: number, party: Mon[], game: Gen4Game) {
  if (game === "bw" || game === "b2w2") {
    const gen = offset - GEN5.party - 8;
    if (gen < 0 || gen + GEN5.trainer + 0x30 > state.length) return false;
    const name = u16(state, gen + GEN5.trainer + 4);
    if (!name || name === 0xffff) return false;
    const tid = u16(state, gen + GEN5.trainer + 0x14);
    return party.some((m) => m.tid === tid);
  }
  const L = LAYOUTS[game];
  const gen = offset - L.party;
  if (gen < 0 || gen + L.medicine + 160 > state.length) return false;
  const name = u16(state, gen + L.trainer);
  if (!name || name === 0xffff) return false;
  const tid = u16(state, gen + L.trainer + 0x10);
  if (!party.some((m) => m.tid === tid)) return false;
  for (let i = 0; i < 40; i++) {
    const id = u16(state, gen + L.medicine + i * 4);
    const qty = u16(state, gen + L.medicine + i * 4 + 2);
    if (id > 600 || qty > 999 || (id === 0 && qty !== 0)) return false;
  }
  return true;
}

function scanParty(state: Uint8Array, game?: Gen4Game): { party: Mon[]; offset: number } | null {
  const dex = dexOf(game);
  let first: { party: Mon[]; offset: number } | null = null;
  const size = partySize(game);
  const end = state.length - size;
  for (let o = 4; o < end; o++) {
    const count = state[o - 4];
    if (count < 1 || count > 6 || state[o - 3] || state[o - 2] || state[o - 1]) continue;
    if (state[o + 4] || state[o + 5]) continue;
    if (o + count * size > state.length) continue;
    const mons: Mon[] = [];
    for (let i = 0; i < count; i++) {
      const off = o + i * size;
      const dec = decryptMon(state.subarray(off, off + size));
      if (!dec) break;
      const mon = readMon(dec, dex);
      if (mon.species < 1 || mon.species >= dex.species.length || mon.level < 1 || mon.level > 100 || mon.maxHp < 1) break;
      mons.push(mon);
    }
    if (mons.length !== count) continue;
    const hit = { party: mons, offset: o };
    if (!game || trustedGeneral(state, o, mons, game)) return hit;
    first ??= hit;
  }
  return first;
}

export function encounterLocation(mon: Mon) {
  if (mon.eggLocationName && mon.eggLocation !== 2000 && mon.eggLocation !== 60002) return mon.eggLocationName;
  return mon.metLocationName;
}

export const SPECIES_NAMES = DEX5.species.slice(1);

export function speciesId(name: string) {
  const i = DEX5.species.findIndex((s) => s.toLowerCase() === name.trim().toLowerCase());
  return i > 0 ? i : null;
}

export function supportsSaveView(gameCode: string | null) {
  return gen4Game(gameCode) !== null;
}
