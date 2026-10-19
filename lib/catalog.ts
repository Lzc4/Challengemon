import type { System } from "./types";

export type Support = "full" | "basic";

export interface CatalogGame {
  id: string;
  title: string;
  gen: number;
  region: string;
  system: System;
  year: number;
  codes: string[];
  support: Support;
}

export const CATALOG: CatalogGame[] = [
  { id: "red", title: "Pokémon Rot", gen: 1, region: "Kanto", system: "gb", year: 1996, codes: ["GB-RED"], support: "basic" },
  { id: "blue", title: "Pokémon Blau", gen: 1, region: "Kanto", system: "gb", year: 1996, codes: ["GB-BLUE"], support: "basic" },
  { id: "yellow", title: "Pokémon Gelb", gen: 1, region: "Kanto", system: "gb", year: 1998, codes: ["GB-YELLOW"], support: "basic" },
  { id: "gold", title: "Pokémon Gold", gen: 2, region: "Johto", system: "gbc", year: 1999, codes: ["GB-GOLD"], support: "basic" },
  { id: "silver", title: "Pokémon Silber", gen: 2, region: "Johto", system: "gbc", year: 1999, codes: ["GB-SILVER"], support: "basic" },
  { id: "crystal", title: "Pokémon Kristall", gen: 2, region: "Johto", system: "gbc", year: 2000, codes: ["GB-CRYSTAL"], support: "basic" },
  { id: "ruby", title: "Pokémon Rubin", gen: 3, region: "Hoenn", system: "gba", year: 2002, codes: ["AXV"], support: "basic" },
  { id: "sapphire", title: "Pokémon Saphir", gen: 3, region: "Hoenn", system: "gba", year: 2002, codes: ["AXP"], support: "basic" },
  { id: "firered", title: "Pokémon Feuerrot", gen: 3, region: "Kanto", system: "gba", year: 2004, codes: ["BPR"], support: "basic" },
  { id: "leafgreen", title: "Pokémon Blattgrün", gen: 3, region: "Kanto", system: "gba", year: 2004, codes: ["BPG"], support: "basic" },
  { id: "emerald", title: "Pokémon Smaragd", gen: 3, region: "Hoenn", system: "gba", year: 2004, codes: ["BPE"], support: "basic" },
  { id: "diamond", title: "Pokémon Diamant", gen: 4, region: "Sinnoh", system: "nds", year: 2006, codes: ["ADA"], support: "full" },
  { id: "pearl", title: "Pokémon Perl", gen: 4, region: "Sinnoh", system: "nds", year: 2006, codes: ["APA"], support: "full" },
  { id: "platinum", title: "Pokémon Platin", gen: 4, region: "Sinnoh", system: "nds", year: 2008, codes: ["CPU"], support: "full" },
  { id: "heartgold", title: "Pokémon HeartGold", gen: 4, region: "Johto & Kanto", system: "nds", year: 2009, codes: ["IPK"], support: "full" },
  { id: "soulsilver", title: "Pokémon SoulSilver", gen: 4, region: "Johto & Kanto", system: "nds", year: 2009, codes: ["IPG"], support: "full" },
  { id: "black", title: "Pokémon Schwarz", gen: 5, region: "Einall", system: "nds", year: 2010, codes: ["IRB"], support: "full" },
  { id: "white", title: "Pokémon Weiß", gen: 5, region: "Einall", system: "nds", year: 2010, codes: ["IRA"], support: "full" },
  { id: "black2", title: "Pokémon Schwarz 2", gen: 5, region: "Einall", system: "nds", year: 2012, codes: ["IRE"], support: "full" },
  { id: "white2", title: "Pokémon Weiß 2", gen: 5, region: "Einall", system: "nds", year: 2012, codes: ["IRD"], support: "full" },
];

export function catalogFor(code: string | null | undefined) {
  if (!code) return null;
  return CATALOG.find((g) => g.codes.some((c) => code.startsWith(c))) ?? null;
}

export const SUPPORT_LABEL: Record<Support, string> = {
  full: "Volle Unterstützung",
  basic: "Basis",
};
