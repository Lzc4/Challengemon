import data from "@/lib/data/gen4.json";
import data5 from "@/lib/data/gen5.json";
import { findGeneralOffset, isGen5, u16, type Gen4Game } from "./gen4";

const ITEM_NAMES = data.items as Record<string, string>;
const ITEM_NAMES5 = data5.items as Record<string, string>;

type Pocket = "items" | "tms" | "mail" | "medicine" | "berries" | "balls" | "battle";

const BAG_BASE: Record<Gen4Game, number> = { hgss: 0x644, pt: 0x630, dp: 0x624, bw: 0x18400, b2w2: 0x18400 };

const GEN5_POCKETS: Record<Pocket, { offset: number; slots: number; max: number }> = {
  items: { offset: 0x000, slots: 310, max: 999 },
  tms: { offset: 0x624, slots: 109, max: 1 },
  mail: { offset: 0x000, slots: 310, max: 999 },
  medicine: { offset: 0x7d8, slots: 48, max: 999 },
  berries: { offset: 0x898, slots: 64, max: 999 },
  balls: { offset: 0x000, slots: 310, max: 999 },
  battle: { offset: 0x000, slots: 310, max: 999 },
};

const POCKETS: Record<Gen4Game, Record<Pocket, { offset: number; slots: number; max: number }>> = {
  hgss: {
    items: { offset: 0x000, slots: 165, max: 999 },
    tms: { offset: 0x35c, slots: 100, max: 99 },
    mail: { offset: 0x4f0, slots: 12, max: 999 },
    medicine: { offset: 0x520, slots: 40, max: 999 },
    berries: { offset: 0x5c0, slots: 64, max: 999 },
    balls: { offset: 0x6c0, slots: 24, max: 999 },
    battle: { offset: 0x720, slots: 30, max: 999 },
  },
  pt: {
    items: { offset: 0x000, slots: 165, max: 999 },
    tms: { offset: 0x35c, slots: 100, max: 99 },
    mail: { offset: 0x4ec, slots: 12, max: 999 },
    medicine: { offset: 0x51c, slots: 40, max: 999 },
    berries: { offset: 0x5bc, slots: 64, max: 999 },
    balls: { offset: 0x6bc, slots: 15, max: 999 },
    battle: { offset: 0x6f8, slots: 30, max: 999 },
  },
  dp: {
    items: { offset: 0x000, slots: 165, max: 999 },
    tms: { offset: 0x35c, slots: 100, max: 99 },
    mail: { offset: 0x4ec, slots: 12, max: 999 },
    medicine: { offset: 0x51c, slots: 40, max: 999 },
    berries: { offset: 0x5bc, slots: 64, max: 999 },
    balls: { offset: 0x6bc, slots: 15, max: 999 },
    battle: { offset: 0x6f8, slots: 30, max: 999 },
  },
  bw: GEN5_POCKETS,
  b2w2: GEN5_POCKETS,
};

export function pocketOf(id: number, game: Gen4Game): Pocket | null {
  if (isGen5(game)) {
    if ((id >= 328 && id <= 425) || (id >= 618 && id <= 620)) return "tms";
    if (id >= 17 && id <= 54) return "medicine";
    if (id >= 149 && id <= 212) return "berries";
    if ((id >= 1 && id <= 16 && id !== 5) || (id >= 55 && id <= 111) || (id >= 213 && id <= 327) || (id >= 537 && id <= 576)) return "items";
    return null;
  }
  if (id >= 1 && id <= 16 && id !== 5) return "balls";
  if (game === "hgss" && id >= 492 && id <= 500) return "balls";
  if (id >= 17 && id <= 54) return "medicine";
  if (id >= 55 && id <= 67) return "battle";
  if (id >= 137 && id <= 148) return "mail";
  if (id >= 149 && id <= 212) return "berries";
  if (id >= 328 && id <= 427) return "tms";
  if ((id >= 68 && id <= 111) || (id >= 213 && id <= 327)) return "items";
  return null;
}

const giveable = (names: Record<string, string>, game: Gen4Game) =>
  Object.entries(names)
    .map(([id, name]) => ({ id: Number(id), name }))
    .filter((it) => pocketOf(it.id, game) !== null)
    .sort((a, b) => a.id - b.id);

export const GIVEABLE_ITEMS = giveable(ITEM_NAMES, "hgss");
const GIVEABLE_ITEMS5 = giveable(ITEM_NAMES5, "bw");

export function giveableItems(game: Gen4Game | null) {
  return isGen5(game) ? GIVEABLE_ITEMS5 : GIVEABLE_ITEMS;
}

export type GiveResult = "added" | "already" | "full" | "notfound" | "invalid";

const w16 = (b: Uint8Array, o: number, v: number) => {
  b[o] = v & 0xff;
  b[o + 1] = (v >> 8) & 0xff;
};

export function giveItemAt(buf: Uint8Array, general: number, game: Gen4Game, id: number, qty: number, exact = false): GiveResult {
  const pocket = pocketOf(id, game);
  if (!pocket) return "invalid";
  const p = POCKETS[game][pocket];
  const start = general + BAG_BASE[game] + p.offset;
  if (start + p.slots * 4 > buf.length) return "notfound";
  let empty = -1;
  for (let i = 0; i < p.slots; i++) {
    const o = start + i * 4;
    const cur = u16(buf, o);
    if (cur === id) {
      const have = u16(buf, o + 2);
      const next = Math.min(p.max, exact ? qty : have + qty);
      if (next === have) return "already";
      w16(buf, o + 2, next);
      return "added";
    }
    if (cur === 0 && empty < 0) empty = o;
  }
  if (empty < 0) return "full";
  w16(buf, empty, id);
  w16(buf, empty + 2, Math.min(p.max, qty));
  return "added";
}

export function giveItemInState(state: Uint8Array, game: Gen4Game, id: number, qty: number, exact = false): GiveResult {
  const general = findGeneralOffset(state, game);
  if (general === null) return "notfound";
  return giveItemAt(state, general, game, id, qty, exact);
}
