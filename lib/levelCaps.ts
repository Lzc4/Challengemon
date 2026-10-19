const HGSS_JOHTO = [
  { name: "Falk (Viola City)", level: 13 },
  { name: "Kai (Azalea City)", level: 17 },
  { name: "Bianka (Dukatia City)", level: 19 },
  { name: "Jens (Teak City)", level: 25 },
  { name: "Hartwig (Anemonia City)", level: 31 },
  { name: "Jasmin (Oliviana City)", level: 35 },
  { name: "Norbert (Mahagonia City)", level: 34 },
  { name: "Sandra (Ebenholz City)", level: 41 },
  { name: "Top Vier & Siegfried", level: 50 },
];

const PT_SINNOH = [
  { name: "Veit (Erzelingen)", level: 14 },
  { name: "Silvana (Ewigenau)", level: 22 },
  { name: "Lamina (Herzhofen)", level: 26 },
  { name: "Hilda (Schleiede)", level: 32 },
  { name: "Marinus (Weideburg)", level: 37 },
  { name: "Adam (Fleetburg)", level: 41 },
  { name: "Frida (Blizzach)", level: 44 },
  { name: "Volkner (Sonnewik)", level: 50 },
  { name: "Top Vier & Cynthia", level: 62 },
];

const DP_SINNOH = [
  { name: "Veit (Erzelingen)", level: 14 },
  { name: "Silvana (Ewigenau)", level: 22 },
  { name: "Hilda (Schleiede)", level: 30 },
  { name: "Marinus (Weideburg)", level: 30 },
  { name: "Lamina (Herzhofen)", level: 36 },
  { name: "Adam (Fleetburg)", level: 39 },
  { name: "Frida (Blizzach)", level: 42 },
  { name: "Volkner (Sonnewik)", level: 49 },
  { name: "Top Vier & Cynthia", level: 66 },
];

type Game = "hgss" | "pt" | "dp" | "bw" | "b2w2";

const BW_UNOVA = [
  { name: "Benny/Maik/Colin (Orion City)", level: 14 },
  { name: "Aloe (Septerna City)", level: 20 },
  { name: "Artie (Stratos City)", level: 23 },
  { name: "Kamilla (Rayono City)", level: 27 },
  { name: "Turner (Marea City)", level: 31 },
  { name: "Géraldine (Panaero City)", level: 35 },
  { name: "Sandro (Nevaio City)", level: 39 },
  { name: "Lysander/Lilia (Twindrake City)", level: 43 },
  { name: "Top Vier & N & G-Cis", level: 54 },
];

const B2W2_UNOVA = [
  { name: "Cheren (Eventura City)", level: 13 },
  { name: "Arena Vapydro City", level: 18 },
  { name: "Artie (Stratos City)", level: 24 },
  { name: "Kamilla (Rayono City)", level: 30 },
  { name: "Turner (Marea City)", level: 33 },
  { name: "Géraldine (Panaero City)", level: 39 },
  { name: "Lysander (Twindrake City)", level: 48 },
  { name: "Arena Abidaya City", level: 51 },
  { name: "Top Vier & Lilia", level: 59 },
];

export function nextLevelCap(save: { game?: Game; badges: number; kantoBadges: number } | null | undefined, game?: Game) {
  const g = save?.game ?? game ?? "hgss";
  const badges = save?.badges ?? 0;
  if (g === "pt") return PT_SINNOH[Math.min(badges, PT_SINNOH.length - 1)];
  if (g === "dp") return DP_SINNOH[Math.min(badges, DP_SINNOH.length - 1)];
  if (g === "bw") return BW_UNOVA[Math.min(badges, BW_UNOVA.length - 1)];
  if (g === "b2w2") return B2W2_UNOVA[Math.min(badges, B2W2_UNOVA.length - 1)];
  if ((save?.kantoBadges ?? 0) > 0) return null;
  return HGSS_JOHTO[Math.min(badges, HGSS_JOHTO.length - 1)];
}
