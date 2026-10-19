import hgss from "@/lib/data/hgss_maps.json";
import pt from "@/lib/data/pt_maps.json";
import dp from "@/lib/data/dp_maps.json";
import gen4 from "@/lib/data/gen4.json";
import gen5 from "@/lib/data/gen5.json";
import unova from "@/lib/data/unova.json";

type Game = "hgss" | "pt" | "dp" | "bw" | "b2w2";

const HGSS_MAPS = hgss.maps as unknown as Record<string, [number, number, number, number, number]>;
const HGSS_ANCHORS = hgss.anchors as unknown as Record<string, [number, number, number]>;
type SinnohMaps = Record<string, [number, number, number]>;
const SINNOH_MAPS: Record<"pt" | "dp", SinnohMaps> = {
  pt: pt.maps as unknown as SinnohMaps,
  dp: dp.maps as unknown as SinnohMaps,
};
const PT_ANCHORS = pt.anchors as unknown as Record<string, [number, number]>;
const NAMES = gen4.locations as Record<string, string>;
const NAMES5 = gen5.locations as Record<string, string>;
const UNOVA = unova as unknown as {
  zones: Record<"bw" | "b2w2", number[]>;
  outdoor: Record<"bw" | "b2w2", number[]>;
  anchors: Record<string, [number, number]>;
  alias: Record<string, number>;
  towns: number[];
  edges: [number, number][];
  edgesB2: [number, number][];
};
const UNOVA_OUTDOOR = {
  bw: new Set(UNOVA.outdoor.bw),
  b2w2: new Set(UNOVA.outdoor.b2w2),
};
const UNOVA_TOWNS = new Set(UNOVA.towns);
const B2W2_ONLY = new Set([117, 118, 119, 120, 122, 123, 124, 125, 126, 127, 128, 130, 131, 132, 133, 141, 142, 143, 144, 147]);

function unovaAnchor(loc: number) {
  const id = UNOVA.alias[String(loc)] ?? loc;
  const a = UNOVA.anchors[String(id)];
  return a ? { id, x: a[0], y: a[1] } : null;
}

export function unovaEdges(game: "bw" | "b2w2") {
  const list = game === "b2w2" ? [...UNOVA.edges, ...UNOVA.edgesB2] : UNOVA.edges;
  return list
    .filter(([a, b]) => game === "b2w2" || (!B2W2_ONLY.has(a) && !B2W2_ONLY.has(b)))
    .map(([a, b]) => [unovaAnchor(a), unovaAnchor(b)])
    .filter((e): e is [{ id: number; x: number; y: number }, { id: number; x: number; y: number }] => !!e[0] && !!e[1]);
}

const PT_TOWNS = new Set(Object.values(SINNOH_MAPS.pt).filter(([, type, main]) => type === 1 && main).map(([loc]) => loc));

export const MAP_TYPES = ["", "Stadt", "Route", "Höhle", "Gebäude", "Pokémon-Center", "Untergrund"];

export interface MapPoint {
  mapsec: number;
  name: string;
  x: number;
  y: number;
  region: number;
  town: boolean;
}

export interface MapGeometry {
  width: number;
  height: number;
  pixel: (x: number, y: number) => { x: number; y: number };
  view: { x: number; y: number; w: number; h: number };
}

export const GEOMETRY: Record<Game, MapGeometry> = {
  hgss: {
    width: 384,
    height: 144,
    pixel: (x, y) => ({ x: x * 8 + 4, y: y * 8 + 20 }),
    view: { x: 0, y: -1, w: 47, h: 18 },
  },
  pt: {
    width: 216,
    height: 168,
    pixel: (x, y) => ({ x: x * 7 + 5, y: y * 7 - 34 }),
    view: { x: 0, y: 4, w: 33, h: 27 },
  },
  bw: { width: 100, height: 100, pixel: (x, y) => ({ x, y }), view: { x: 0, y: 0, w: 102, h: 100 } },
  b2w2: { width: 100, height: 100, pixel: (x, y) => ({ x, y }), view: { x: 0, y: 0, w: 102, h: 100 } },
  dp: {
    width: 216,
    height: 168,
    pixel: (x, y) => ({ x: x * 7 + 5, y: y * 7 - 34 }),
    view: { x: 0, y: 4, w: 33, h: 27 },
  },
};

export function onMainMatrix(game: Game, mapId: number) {
  if (game === "hgss" || game === "bw" || game === "b2w2") return true;
  return SINNOH_MAPS[game][String(mapId)]?.[2] === 1;
}

export function mapInfo(game: Game, mapId: number | null | undefined, posX?: number | null, posY?: number | null) {
  if (mapId === null || mapId === undefined) return null;
  if (game === "bw" || game === "b2w2") {
    const loc = UNOVA.zones[game][mapId];
    if (loc === undefined) return null;
    const anchor = unovaAnchor(loc);
    const id = anchor?.id ?? loc;
    const inside = !UNOVA_OUTDOOR[game].has(mapId);
    const type = UNOVA_TOWNS.has(id) ? (inside ? 4 : 1) : inside ? 3 : 2;
    return {
      mapsec: id,
      name: NAMES5[String(loc)] ?? "Unbekannter Ort",
      region: 0,
      type,
      typeName: MAP_TYPES[type] ?? "",
      point: anchor ? { x: anchor.x, y: anchor.y } : null,
    };
  }
  if (game !== "hgss") {
    const entry = SINNOH_MAPS[game][String(mapId)];
    if (!entry) return null;
    const [loc, type] = entry;
    let point: { x: number; y: number } | null = PT_ANCHORS[String(loc)] ? { x: PT_ANCHORS[String(loc)][0], y: PT_ANCHORS[String(loc)][1] } : null;
    if (posX != null && posY != null) {
      const bx = Math.floor(posX / 32);
      const bz = Math.floor(posY / 32);
      if (bx >= 0 && bx < 30 && bz >= 5 && bz < 30) point = { x: bx, y: bz };
    }
    return { mapsec: loc, name: NAMES[String(loc)] ?? "Unbekannter Ort", region: 0, type, typeName: MAP_TYPES[type] ?? "", point };
  }
  const entry = HGSS_MAPS[String(mapId)];
  if (!entry) return null;
  const [mapsec, region, type, wx, wy] = entry;
  let anchor: [number, number, number] | undefined = HGSS_ANCHORS[String(mapsec)];
  if (wx || wy) anchor = [wx, wy, region];
  else if (posX != null && posY != null) {
    const gx = Math.floor(posX / 32);
    const gy = Math.floor(posY / 32);
    if (gx > 0 && gx < 48 && gy > 0 && gy < 17) anchor = [gx, gy, region];
  }
  return {
    mapsec,
    name: NAMES[String(mapsec)] ?? "Unbekannter Ort",
    region,
    type,
    typeName: MAP_TYPES[type] ?? "",
    point: anchor ? { x: anchor[0], y: anchor[1] } : null,
  };
}

export function allPoints(game: Game): MapPoint[] {
  if (game === "bw" || game === "b2w2") {
    return Object.entries(UNOVA.anchors)
      .map(([loc, [x, y]]) => ({ n: Number(loc), x, y }))
      .filter(({ n }) => game === "b2w2" || !B2W2_ONLY.has(n))
      .filter(({ n }) => !(game === "b2w2" ? n === 51 : n === 139 || n === 140))
      .map(({ n, x, y }) => ({ mapsec: n, name: NAMES5[String(n)] ?? "", x, y, region: 0, town: UNOVA_TOWNS.has(n) }));
  }
  if (game !== "hgss") {
    return Object.entries(PT_ANCHORS).map(([loc, [x, y]]) => {
      const n = Number(loc);
      return { mapsec: n, name: NAMES[loc] ?? "", x, y, region: 0, town: PT_TOWNS.has(n) };
    });
  }
  return Object.entries(HGSS_ANCHORS).map(([sec, [x, y, region]]) => {
    const n = Number(sec);
    return { mapsec: n, name: NAMES[sec] ?? "", x, y, region, town: n >= 126 && n <= 148 };
  });
}
