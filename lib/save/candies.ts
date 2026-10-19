import { LAYOUTS, PARTITION, crc16, isGen5, u16, type Gen4Game, type Gen4Only } from "./gen4";
import { giveItemAt, giveItemInState } from "./items";

const RARE_CANDY = 50;

export type CandyResult = "added" | "already" | "full" | "notfound";

const w16 = (b: Uint8Array, o: number, v: number) => {
  b[o] = v & 0xff;
  b[o + 1] = (v >> 8) & 0xff;
};

export function patchStateCandies(state: Uint8Array, game: Gen4Game, amount = 999): CandyResult {
  const result = giveItemInState(state, game, RARE_CANDY, amount, true);
  return result === "invalid" ? "notfound" : result;
}

export function patchSaveCandies(save: Uint8Array, game: Gen4Game, amount = 999) {
  if (isGen5(game)) return false;
  const L = LAYOUTS[game as Gen4Only];
  let changed = false;
  for (const base of [0, PARTITION]) {
    if (save.length < base + L.generalSize) continue;
    const g = save.subarray(base, base + L.generalSize);
    if (crc16(g.subarray(0, L.generalSize - L.footerSize)) !== u16(g, L.generalSize - 2)) continue;
    if (giveItemAt(save, base, game, RARE_CANDY, amount, true) === "added") {
      w16(g, L.generalSize - 2, crc16(g.subarray(0, L.generalSize - L.footerSize)));
      changed = true;
    }
  }
  return changed;
}
