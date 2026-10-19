import { supabase } from "./supabase/client";

export type WidgetType = "team" | "focus" | "map" | "links" | "events" | "cap" | "deaths" | "battlecam" | "battlelog";

export type WidgetOptions = Record<string, string | number>;

export interface Widget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  options: WidgetOptions;
}

interface OptionDef {
  key: string;
  label: string;
  choices: { value: string | number; label: string }[];
}

const PLAYER_OPTION: OptionDef = {
  key: "player",
  label: "Spieler",
  choices: [
    { value: "partner", label: "Partner" },
    { value: "me", label: "Ich" },
  ],
};

export const WIDGETS: Record<WidgetType, { label: string; w: number; options: WidgetOptions; defs: OptionDef[] }> = {
  team: {
    label: "Team",
    w: 300,
    options: { player: "partner", style: "slots" },
    defs: [
      PLAYER_OPTION,
      {
        key: "style",
        label: "Darstellung",
        choices: [
          { value: "icons", label: "Nur Icon + KP" },
          { value: "slots", label: "Slots (Name, Lv, KP)" },
          { value: "full", label: "Komplett mit Attacken" },
        ],
      },
    ],
  },
  focus: {
    label: "Pokémon im Detail",
    w: 280,
    options: { player: "partner", slot: 1 },
    defs: [
      PLAYER_OPTION,
      { key: "slot", label: "Team-Platz", choices: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `Platz ${n}` })) },
    ],
  },
  map: { label: "Karte", w: 320, options: {}, defs: [] },
  links: { label: "Soul Links", w: 300, options: {}, defs: [] },
  events: { label: "Meldungen", w: 300, options: {}, defs: [] },
  cap: { label: "Level-Cap", w: 260, options: {}, defs: [] },
  deaths: { label: "Todeszähler", w: 220, options: {}, defs: [] },
  battlecam: {
    label: "Battlecam",
    w: 320,
    options: { player: "partner", screens: "both" },
    defs: [
      {
        key: "screens",
        label: "Bildschirme",
        choices: [
          { value: "both", label: "Beide Bildschirme" },
          { value: "top", label: "Nur oberer Bildschirm" },
        ],
      },
    ],
  },
  battlelog: {
    label: "Battle-Log",
    w: 300,
    options: { player: "partner", lines: 6 },
    defs: [
      PLAYER_OPTION,
      { key: "lines", label: "Zeilen", choices: [4, 6, 8, 12].map((n) => ({ value: n, label: String(n) })) },
    ],
  },
};

export const DEFAULT_LAYOUT: Widget[] = [
  { id: "cap", type: "cap", x: 72, y: 2, w: 280, options: {} },
  { id: "map", type: "map", x: 72, y: 12, w: 320, options: {} },
  { id: "team", type: "team", x: 72, y: 40, w: 300, options: { player: "partner", style: "slots" } },
  { id: "links", type: "links", x: 72, y: 78, w: 300, options: {} },
  { id: "log", type: "battlelog", x: 2, y: 70, w: 300, options: { player: "partner", lines: 6 } },
];

const KEY = "overlay-layout-v1";

export function loadLayout(): Widget[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Widget[];
      if (Array.isArray(parsed)) return parsed.filter((w) => w && WIDGETS[w.type]);
    }
  } catch {}
  return DEFAULT_LAYOUT;
}

function validLayout(value: unknown): Widget[] | null {
  if (!Array.isArray(value)) return null;
  return (value as Widget[]).filter((w) => w && WIDGETS[w.type]);
}

let accountTimer: ReturnType<typeof setTimeout> | null = null;

export function saveLayout(layout: Widget[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {}
  if (accountTimer) clearTimeout(accountTimer);
  accountTimer = setTimeout(() => {
    void supabase().auth.updateUser({ data: { overlay_layout: layout } });
  }, 1500);
}

export async function loadAccountLayout(): Promise<Widget[] | null> {
  const { data } = await supabase().auth.getUser();
  const layout = validLayout(data.user?.user_metadata?.overlay_layout);
  if (!layout) return null;
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {}
  return layout;
}

export function newWidget(type: WidgetType): Widget {
  const info = WIDGETS[type];
  return { id: `${type}-${Date.now().toString(36)}`, type, x: 35, y: 30, w: info.w, options: { ...info.options } };
}
