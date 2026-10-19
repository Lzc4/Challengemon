"use client";

import MonSprite from "@/components/MonSprite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type Gen4Game, type Gen4Save, type Mon } from "@/lib/save/gen4";
import { nextLevelCap } from "@/lib/levelCaps";
import { useLevelCaps } from "@/lib/hooks";
import { diffParty, type LogEntry } from "@/lib/battleLog";
import { loadAccountLayout, loadLayout, newWidget, saveLayout, WIDGETS, DEFAULT_LAYOUT, type Widget, type WidgetType } from "@/lib/overlayLayout";
import TownMap, { PLAYER_COLORS } from "../TownMap";
import PokeIcon from "../PokeIcon";
import BattleCamView from "../BattleCamView";
import PartySlot, { HpBar, monName } from "./PartySlot";
import type { Encounter, LiveStatus, Profile, RunMode } from "@/lib/types";

export interface OverlayData {
  runId: string;
  mode: RunMode;
  userId: string;
  players: Profile[];
  live: LiveStatus[];
  encounters: Encounter[];
  myParty: Mon[] | null;
  myMapId: number | null;
  myPos: { x: number | null; y: number | null };
  mySave: Gen4Save | null;
  game: Gen4Game;
  mapUrl: string | null;
  iconsUrl: string | null;
  notices: string[];
}

interface Ctx extends OverlayData {
  caps: boolean;
  editing: boolean;
  partyOf: (id: string | null) => Mon[] | null;
  resolve: (opt: string | number | undefined) => string | null;
  nameOf: (id: string | null) => string;
  logs: Record<string, LogEntry[]>;
  events: { id: number; text: string; bad: boolean }[];
}

function Empty({ text }: { text: string }) {
  return <div className="px-box px-empty">{text}</div>;
}

function TeamWidget({ c, w }: { c: Ctx; w: Widget }) {
  const id = c.resolve(w.options.player);
  const party = c.partyOf(id);
  const style = w.options.style;
  if (!party?.length) return <Empty text={`${c.nameOf(id)}: noch kein Team`} />;
  if (style === "icons") {
    return (
      <div className="px-icons">
        {party.map((m, i) => (
          <div key={`${m.pid}-${i}`} className={`px-icon-cell${!m.isEgg && m.hp === 0 ? " fainted" : ""}`}>
            <PokeIcon species={m.species} isEgg={m.isEgg} iconsUrl={c.iconsUrl} scale={2} animate={m.hp > 0} />
            {!m.isEgg && <HpBar mon={m} />}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="px-party">
      {party.map((m, i) => (
        <PartySlot key={`${m.pid}-${i}`} mon={m} iconsUrl={c.iconsUrl} full={style === "full"} />
      ))}
    </div>
  );
}

function FocusWidget({ c, w }: { c: Ctx; w: Widget }) {
  const id = c.resolve(w.options.player);
  const mon = c.partyOf(id)?.[Number(w.options.slot ?? 1) - 1];
  if (!mon) return <Empty text={`${c.nameOf(id)}: Platz ${w.options.slot} ist leer`} />;
  return (
    <div className={`px-focus${!mon.isEgg && mon.hp === 0 ? " fainted" : ""}`}>
      <div className="px-focus-top">
        <MonSprite species={mon.species} isEgg={mon.isEgg} size={96} game={c.game} />
        <div className="px-focus-head">
          <div className="px-row">
            <span className="px-name big">{monName(mon)}</span>
            {mon.gender && <span className={`px-gender ${mon.gender}`}>{mon.gender === "m" ? "♂" : "♀"}</span>}
          </div>
          {mon.isNicknamed && <span className="px-dim">{mon.speciesName}</span>}
          {!mon.isEgg && (
            <>
              <span>
                <span className="px-lv">Lv</span>
                {mon.level}
                {mon.status && <span className="px-status">{mon.status}</span>}
              </span>
              <div className="px-row">
                <span className="px-hp-tag">KP</span>
                <HpBar mon={mon} />
              </div>
              <span className="px-dim">
                {mon.hp}/{mon.maxHp} KP
              </span>
            </>
          )}
        </div>
      </div>
      {!mon.isEgg && (
        <div className="px-box">
          <div className="px-moves">
            {mon.moves.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          {mon.item && <div className="px-item">✦ {mon.item}</div>}
          {mon.metLocationName && (
            <div className="px-dim">
              gefangen: {mon.metLocationName} (Lv. {mon.metLevel})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinksWidget({ c }: { c: Ctx }) {
  const rows = useMemo(() => {
    if (!c.myParty) return [];
    return c.myParty.map((mon) => {
      const mine = c.encounters.find((e) => e.user_id === c.userId && e.pid !== null && Number(e.pid) === mon.pid);
      if (!mine) return { mon, location: null as string | null, partner: null as Encounter | null, partnerMon: null as Mon | null };
      const partner = c.encounters.find((e) => e.user_id !== c.userId && e.location === mine.location) ?? null;
      const partnerMon = partner?.pid ? c.partyOf(partner.user_id)?.find((m) => m.pid === Number(partner.pid)) ?? null : null;
      return { mon, location: mine.location, partner, partnerMon };
    });
  }, [c]);
  if (c.mode !== "soullocke") return <Empty text="Nur im Soullocke-Modus" />;
  if (!rows.length) return <Empty text="Noch keine Soul Links" />;
  return (
    <div className="px-box px-links">
      {rows.map(({ mon, location, partner, partnerMon }, i) => (
        <div key={`${mon.pid}-${i}`} className={`px-link${partner?.status === "dead" ? " dead" : ""}`}>
          <PokeIcon species={mon.species} isEgg={mon.isEgg} iconsUrl={c.iconsUrl} scale={1} animate={false} />
          <span className="px-link-name">{monName(mon)}</span>
          <span className="px-chain">⛓</span>
          <span className="px-link-name right">
            {partnerMon ? monName(partnerMon) : partner ? partner.nickname || partner.species || "?" : "—"}
          </span>
          {partnerMon ? (
            <PokeIcon species={partnerMon.species} isEgg={partnerMon.isEgg} iconsUrl={c.iconsUrl} scale={1} animate={false} />
          ) : (
            <span className="px-icon-gap" />
          )}
          <span className="px-link-loc">{location ?? "nicht eingetragen"}</span>
        </div>
      ))}
    </div>
  );
}

function CapWidget({ c }: { c: Ctx }) {
  if (!c.caps) return c.editing ? <Empty text="Level-Caps aus" /> : null;
  const cap = nextLevelCap(c.mySave, c.game);
  if (!cap) return <Empty text="Kein Level-Cap" />;
  const over = c.myParty ? c.myParty.filter((m) => !m.isEgg && m.level > cap.level).length : 0;
  return (
    <div className={`px-box px-cap${over ? " over" : ""}`}>
      <span>LEVEL-CAP {cap.level}</span>
      <span>{over ? `${over}× DRÜBER!` : cap.name}</span>
    </div>
  );
}

function DeathsWidget({ c }: { c: Ctx }) {
  return (
    <div className="px-box px-deaths-box">
      {c.players.map((p) => (
        <span key={p.id}>
          {p.name} <b>✝ {c.encounters.filter((e) => e.user_id === p.id && e.status === "dead").length}</b>
        </span>
      ))}
    </div>
  );
}

function EventsWidget({ c }: { c: Ctx }) {
  const items = [...c.notices.map((t, i) => ({ id: -i - 1, text: t, bad: false })), ...c.events].slice(0, 4);
  if (!items.length) return <Empty text="Noch keine Meldungen" />;
  return (
    <div className="px-dialog">
      {items.map((e) => (
        <div key={e.id} className={e.bad ? "bad" : ""}>
          {e.text}
        </div>
      ))}
      <span className="px-arrow">▼</span>
    </div>
  );
}

function LogWidget({ c, w }: { c: Ctx; w: Widget }) {
  const id = c.resolve(w.options.player);
  const entries = (id ? c.logs[id] : null) ?? [];
  if (!entries.length) return <Empty text={`${c.nameOf(id)}: noch nichts passiert`} />;
  return (
    <div className="px-dialog px-log">
      {entries.slice(0, Number(w.options.lines ?? 6)).map((e) => (
        <div key={e.id} className={e.tone}>
          {e.text}
        </div>
      ))}
    </div>
  );
}

function CamWidget({ c, w }: { c: Ctx; w: Widget }) {
  const id = c.resolve(w.options.player ?? "partner");
  if (!id || id === c.userId) return <Empty text="Kein Partner" />;
  return (
    <BattleCamView
      runId={c.runId}
      me={c.userId}
      target={id}
      name={c.nameOf(id)}
      screens={w.options.screens === "top" ? "top" : "both"}
    />
  );
}

function MapWidget({ c }: { c: Ctx }) {
  const players = c.players.map((p, i) => {
    const row = c.live.find((l) => l.user_id === p.id);
    const me = p.id === c.userId;
    return {
      id: p.id,
      name: p.name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      mapId: me ? c.myMapId : row?.map_id ?? null,
      posX: me ? c.myPos.x : row?.pos_x ?? null,
      posY: me ? c.myPos.y : row?.pos_y ?? null,
    };
  });
  return <TownMap players={players} mapUrl={c.mapUrl} game={c.game} compact />;
}

function renderWidget(c: Ctx, w: Widget) {
  switch (w.type) {
    case "team":
      return <TeamWidget c={c} w={w} />;
    case "focus":
      return <FocusWidget c={c} w={w} />;
    case "map":
      return <MapWidget c={c} />;
    case "links":
      return <LinksWidget c={c} />;
    case "events":
      return <EventsWidget c={c} />;
    case "cap":
      return <CapWidget c={c} />;
    case "deaths":
      return <DeathsWidget c={c} />;
    case "battlecam":
      return <CamWidget c={c} w={w} />;
    case "battlelog":
      return <LogWidget c={c} w={w} />;
  }
}

function widgetTitle(c: Ctx, w: Widget) {
  const base = WIDGETS[w.type].label.toUpperCase();
  if ("player" in w.options) return `${base} · ${c.nameOf(c.resolve(w.options.player)).toUpperCase()}`;
  return base;
}

interface Popup {
  win: Window;
  root: HTMLElement;
}

function openWindow(id: string, title: string, width: number) {
  const win = window.open("", `ov-${id}`, `popup,width=${width + 32},height=480`);
  if (!win) return null;
  const doc = win.document;
  doc.title = title;
  doc.head.innerHTML = "";
  const base = doc.createElement("base");
  base.href = `${window.location.origin}/`;
  doc.head.append(base);
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => doc.head.append(node.cloneNode(true)));
  doc.documentElement.className = document.documentElement.className;
  doc.body.innerHTML = "";
  doc.body.className = "popup-body";
  const root = doc.createElement("div");
  root.className = "popup-root";
  doc.body.append(root);
  return { win, root };
}

export default function OverlayLayer({
  data,
  editing,
  onDone,
  hidden,
}: {
  data: OverlayData;
  editing: boolean;
  onDone: () => void;
  hidden?: boolean;
}) {
  const [popups, setPopups] = useState<Record<string, Popup>>({});
  const popupsRef = useRef(popups);
  popupsRef.current = popups;

  useEffect(() => {
    const closeAll = () => Object.values(popupsRef.current).forEach((p) => p.win.close());
    window.addEventListener("pagehide", closeAll);
    return () => {
      window.removeEventListener("pagehide", closeAll);
      closeAll();
    };
  }, []);

  function popOut(id: string, title: string, width: number) {
    const existing = popups[id];
    if (existing && !existing.win.closed) {
      existing.win.focus();
      return;
    }
    const p = openWindow(id, title, width);
    if (!p) return;
    p.win.addEventListener("pagehide", () =>
      setPopups((cur) => {
        const next = { ...cur };
        delete next[id];
        return next;
      }),
    );
    setPopups((cur) => ({ ...cur, [id]: p }));
  }

  const [caps] = useLevelCaps(data.runId);
  const [layout, setLayout] = useState<Widget[]>(DEFAULT_LAYOUT);
  const [settings, setSettings] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});
  const [events, setEvents] = useState<{ id: number; text: string; bad: boolean }[]>([]);
  const layer = useRef<HTMLDivElement>(null);
  const lastParties = useRef<Record<string, Mon[]>>({});
  const known = useRef<Map<string, Encounter> | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setLayout(loadLayout());
    loadAccountLayout().then((l) => l && setLayout(l));
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const update = useCallback((next: Widget[]) => {
    setLayout(next);
    saveLayout(next);
  }, []);

  useEffect(() => {
    const parties: Record<string, Mon[]> = {};
    for (const p of data.players) {
      const party = p.id === data.userId ? data.myParty : data.live.find((l) => l.user_id === p.id)?.party ?? null;
      if (party) parties[p.id] = party;
    }
    const added: Record<string, LogEntry[]> = {};
    for (const [id, party] of Object.entries(parties)) {
      const entries = diffParty(lastParties.current[id] ?? null, party);
      if (entries.length) added[id] = entries.reverse();
      lastParties.current[id] = party;
    }
    if (Object.keys(added).length) {
      setLogs((cur) => {
        const next = { ...cur };
        for (const [id, e] of Object.entries(added)) next[id] = [...e, ...(cur[id] ?? [])].slice(0, 30);
        return next;
      });
    }
  }, [data.players, data.userId, data.myParty, data.live]);

  useEffect(() => {
    const prev = known.current;
    known.current = new Map(data.encounters.map((e) => [e.id, e]));
    if (!prev) return;
    const add: { id: number; text: string; bad: boolean }[] = [];
    for (const e of data.encounters) {
      if (e.user_id === data.userId) continue;
      const who = data.players.find((p) => p.id === e.user_id)?.name ?? "?";
      const name = e.nickname || e.species || "Pokémon";
      const before = prev.get(e.id);
      if (!before && e.status === "caught") add.push({ id: Math.random(), text: `${who} fängt ${name}!`, bad: false });
      if (e.status === "dead" && before?.status !== "dead") add.push({ id: Math.random(), text: `${name} von ${who} wurde besiegt…`, bad: true });
    }
    if (add.length) setEvents((cur) => [...add, ...cur].slice(0, 4));
  }, [data.encounters, data.userId, data.players]);

  const ctx: Ctx = useMemo(() => {
    const partner = data.players.find((p) => p.id !== data.userId)?.id ?? null;
    return {
      ...data,
      caps,
      editing,
      logs,
      events,
      resolve: (opt) => (opt === "me" ? data.userId : partner),
      nameOf: (id) => data.players.find((p) => p.id === id)?.name ?? "?",
      partyOf: (id) => {
        if (!id) return null;
        if (id === data.userId) return data.myParty;
        return data.live.find((l) => l.user_id === id)?.party ?? null;
      },
    };
  }, [data, logs, events, caps, editing]);

  function startDrag(e: React.PointerEvent, id: string, mode: "move" | "resize") {
    if (!editing || !layer.current) return;
    e.preventDefault();
    const rect = layer.current.getBoundingClientRect();
    const start = layout.find((w) => w.id === id)!;
    const sx = e.clientX;
    const sy = e.clientY;
    let current = layout;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      current = layout.map((w) => {
        if (w.id !== id) return w;
        if (mode === "resize") return { ...w, w: Math.max(150, Math.min(700, Math.round(start.w + dx))) };
        return {
          ...w,
          x: Math.max(0, Math.min(98, start.x + (dx / rect.width) * 100)),
          y: Math.max(0, Math.min(97, start.y + (dy / rect.height) * 100)),
        };
      });
      setLayout(current);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      update(current);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function setOption(id: string, key: string, value: string) {
    update(layout.map((w) => (w.id === id ? { ...w, options: { ...w.options, [key]: isNaN(Number(value)) ? value : Number(value) } } : w)));
  }

  return (
    <div ref={layer} className={`ov-layer${editing ? " editing" : ""}`} style={hidden && !editing ? { display: "none" } : undefined}>
      {layout
        .filter((w) => popups[w.id])
        .map((w) =>
          createPortal(
            <div className="wg-panel px-theme">
              <div className="wg-title">
                <span>{widgetTitle(ctx, w)}</span>
              </div>
              {renderWidget(ctx, w)}
            </div>,
            popups[w.id].root,
            w.id,
          ),
        )}
      {layout.filter((w) => !popups[w.id]).map((w) => (
        <div key={w.id} className="wg" style={{ left: `min(${w.x}%, calc(100% - ${w.w + 8}px))`, top: `${w.y}%`, width: w.w }}>
          <div className="wg-panel px-theme">
            <div className="wg-title" onPointerDown={(e) => startDrag(e, w.id, "move")}>
              <span>{widgetTitle(ctx, w)}</span>
              <button
                type="button"
                className="wg-popout"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => popOut(w.id, widgetTitle(ctx, w), w.w)}
                title="Als eigenes Fenster öffnen (z. B. auf anderen Monitor ziehen)"
              >
                ⧉
              </button>
              {editing && (
                <span className="wg-tools">
                  <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setSettings(settings === w.id ? null : w.id)} title="Einstellungen">
                    ⚙
                  </button>
                  <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => update(layout.filter((x) => x.id !== w.id))} title="Entfernen">
                    ✕
                  </button>
                </span>
              )}
            </div>
            {renderWidget(ctx, w)}
          </div>
          {editing && settings === w.id && WIDGETS[w.type].defs.length > 0 && (
            <div className="wg-settings">
              {WIDGETS[w.type].defs.map((d) => (
                <label key={d.key}>
                  {d.label}
                  <select value={String(w.options[d.key] ?? "")} onChange={(e) => setOption(w.id, d.key, e.target.value)}>
                    {d.choices.map((ch) => (
                      <option key={String(ch.value)} value={String(ch.value)}>
                        {ch.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          {editing && <div className="wg-resize" onPointerDown={(e) => startDrag(e, w.id, "resize")} title="Breite ziehen" />}
        </div>
      ))}
      {editing && (
        <div className="ov-toolbar">
          <select
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              update([...layout, newWidget(e.target.value as WidgetType)]);
            }}
          >
            <option value="">+ Widget hinzufügen</option>
            {(Object.keys(WIDGETS) as WidgetType[]).map((t) => (
              <option key={t} value={t}>
                {WIDGETS[t].label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => update(DEFAULT_LAYOUT)}>
            Standard
          </button>
          <button type="button" className="primary" onClick={onDone}>
            Fertig
          </button>
        </div>
      )}
    </div>
  );
}
