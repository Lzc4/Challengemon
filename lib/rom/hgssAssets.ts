import iconPalettes from "@/lib/data/icon_palettes.json";
import { readGraphics, readNarc, readNdsFile, readPalette, readScreen, renderScreen, renderSprite, type Bitmap } from "./nds";
import { readArm9 } from "./tms";

export const MAP_CROP = { x: 0, y: 0, w: 384, h: 144 };
export const ICON_COLS = 32;
export const EGG_ICON = 0;

export function mapPixel(gridX: number, gridY: number) {
  return { x: gridX * 8 + 4, y: gridY * 8 + 20 };
}

export function extractPokegearMap(rom: Uint8Array): Bitmap {
  const narcFile = readNdsFile(rom, "a/1/4/4");
  if (!narcFile) throw new Error("Pokégear-Karte nicht in der ROM gefunden");
  const files = readNarc(narcFile);
  return renderScreen(readScreen(files[11]), readGraphics(files[10], 512), readPalette(files[20]), MAP_CROP);
}

export const SINNOH_CROP = { x: 20, y: 0, w: 216, h: 168 };

export function extractSinnohMap(rom: Uint8Array): Bitmap {
  const narcFile = readNdsFile(rom, "graphic/tmap_gra.narc");
  if (!narcFile) throw new Error("Karte nicht in der ROM gefunden");
  const files = readNarc(narcFile);
  const palette = readPalette(files[0]);
  const gfx = readGraphics(files[19], 256);
  const crop = SINNOH_CROP;
  const bg = renderScreen(readScreen(files[22]), gfx, palette, crop);
  return renderScreen(readScreen(files[24]), gfx, palette, crop, bg);
}

const ICON_NARC = {
  hgss: "a/0/2/0",
  pt: "poketool/icongra/pl_poke_icon.narc",
  dp: "poketool/icongra/poke_icon.narc",
  bw: "a/0/0/7",
  b2w2: "a/0/0/7",
} as const;

// gen5 hat die icon-paletten als nibble-tabelle in der arm9, suchen ueber die bekannten gen4 werte
function gen5PaletteTable(rom: Uint8Array): number[] {
  const known = iconPalettes as number[];
  const arm9 = readArm9(rom);
  const needle = known.slice(1, 41).map((v) => v * 17);
  outer: for (let i = 1; i < arm9.length - 41; i++) {
    for (let k = 0; k < needle.length; k++) if (arm9[i + k] !== needle[k]) continue outer;
    return Array.from(arm9.subarray(i - 1, i + 650), (v) => v & 15);
  }
  return known;
}

export function extractIconSheet(rom: Uint8Array, game: keyof typeof ICON_NARC = "hgss"): Bitmap {
  const narcFile = readNdsFile(rom, ICON_NARC[game]);
  if (!narcFile) throw new Error("Pokémon-Icons nicht in der ROM gefunden");
  const files = readNarc(narcFile);
  const palette = readPalette(files[0]);
  const gen5 = game === "bw" || game === "b2w2";
  const table = gen5 ? gen5PaletteTable(rom) : (iconPalettes as number[]);
  const count = gen5 ? 650 : 494;
  // b2w2 hat eine palette mehr am anfang, deshalb erstes ncgr suchen
  const first = gen5 ? files.findIndex((f) => f.length > 4 && f[0] === 0x52 && f[1] === 0x47 && f[2] === 0x43 && f[3] === 0x4e) : 7;
  const rows = Math.ceil(count / ICON_COLS);
  const width = ICON_COLS * 32;
  const height = rows * 64;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < count; i++) {
    const source = i === EGG_ICON ? (gen5 ? 650 : 494) : i;
    const fileIndex = gen5 ? first + source * 2 : i === EGG_ICON ? 501 : i + 7;
    const file = files[fileIndex];
    if (!file?.length) continue;
    try {
      const gfx = readGraphics(file, 32);
      const bank = table[source] ?? 0;
      const ox = (i % ICON_COLS) * 32;
      const oy = Math.floor(i / ICON_COLS) * 64;
      for (const frame of [0, 1]) {
        const bmp = renderSprite(gfx, palette, bank, 32, 32, frame * 32);
        for (let y = 0; y < 32; y++) {
          const src = y * 32 * 4;
          const dst = ((oy + frame * 32 + y) * width + ox) * 4;
          pixels.set(bmp.pixels.subarray(src, src + 32 * 4), dst);
        }
      }
    } catch {}
  }
  return { width, height, pixels };
}

export async function bitmapToPng(bmp: Bitmap): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(bmp.pixels), bmp.width, bmp.height), 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG fehlgeschlagen"))), "image/png"));
}
