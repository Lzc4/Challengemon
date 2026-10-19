"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { downloadSave, latestSave, loadRunRom, myLibrary, uploadSave } from "@/lib/storage";
import { publishSummary } from "@/lib/useParsedSaves";
import { checksum } from "@/lib/compress";
import { idbDelete, idbGet, idbSet } from "@/lib/idb";
import { DEFAULT_CONTROLS, HIDDEN_BUTTONS } from "@/lib/controls";
import { startGamepadBridge } from "@/lib/gamepad";
import { SYSTEMS } from "@/lib/games";
import { moveNamesFor, teachMoveInState, findLiveState, gen4Game, parseGen4Save, supportsSaveView, type Gen4Game, type Gen4Save, type Mon } from "@/lib/save/gen4";
import OverlayLayer from "@/components/overlay/OverlayLayer";
import ChatDock from "@/components/ChatDock";
import { hostBattlecam, supabaseTransport } from "@/lib/battlecam";
import { patchSaveCandies, patchStateCandies } from "@/lib/save/candies";
import { giveableItems, giveItemInState } from "@/lib/save/items";
import { readTmMoves, type TmEntry } from "@/lib/rom/tms";
import GameOver from "@/components/GameOver";
import { ensureHgssAssets, useHgssAssets } from "@/lib/rom/assets";
import { autoTrack } from "@/lib/autoTrack";
import { useLevelCaps, useProfiles } from "@/lib/hooks";
import type { Encounter, LiveStatus, RunWithRelations, SaveRow } from "@/lib/types";

const EJS_DATA = "https://cdn.emulatorjs.org/4.2.3/data/";
const SRAM_INTERVAL = 10_000;
const STATE_INTERVAL = 90_000;
const LIVE_INTERVAL = 2_000;

type Win = Window & Record<string, unknown>;

interface Pending {
  state?: Uint8Array;
  stateAt?: number;
  sram?: Uint8Array;
  sramAt?: number;
}

interface GameManager {
  FS: {
    writeFile: (p: string, d: Uint8Array) => void;
    mkdir: (p: string) => void;
    analyzePath: (p: string) => { exists: boolean };
  };
  getState: () => Uint8Array;
  loadState: (d: Uint8Array) => void;
  getSaveFile: (save?: boolean) => Uint8Array | null;
  getSaveFilePath: () => string;
  loadSaveFiles: () => void;
  simulateInput: (player: number, index: number, value: number) => void;
  getFrameNum?: () => number;
  setFastForwardRatio?: (ratio: number) => void;
  toggleFastForward?: (active: number) => void;
  setVSync?: (enabled: number) => void;
}

const FF_RATIOS = [2, 3, 4, 6, 8, 0];
const FF_KEY = "ff-ratio";

function readRatio() {
  try {
    const v = Number(localStorage.getItem(FF_KEY));
    return FF_RATIOS.includes(v) ? v : 4;
  } catch {
    return 4;
  }
}

function applyFastForward(on: boolean, ratio: number) {
  const emu = (window as unknown as Win).EJS_emulator as { isFastForward?: boolean; gameManager?: GameManager } | undefined;
  const g = emu?.gameManager;
  if (!emu || !g?.toggleFastForward) return false;
  emu.isFastForward = false;
  g.setFastForwardRatio?.(ratio);
  g.toggleFastForward(on ? 1 : 0);
  return true;
}

function gm(): GameManager | null {
  const emu = (window as unknown as Win).EJS_emulator as { gameManager?: GameManager } | undefined;
  return emu?.gameManager ?? null;
}

function writeSram(data: Uint8Array) {
  const g = gm();
  if (!g) return;
  const path = g.getSaveFilePath();
  const parts = path.split("/").filter(Boolean);
  let cur = "";
  for (const part of parts.slice(0, -1)) {
    cur += `/${part}`;
    if (!g.FS.analyzePath(cur).exists) g.FS.mkdir(cur);
  }
  g.FS.writeFile(path, data);
  g.loadSaveFiles();
}

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<"init" | "rom" | "saves" | "running" | "error">("init");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("noch nicht gesichert");
  const [padStatus, setPadStatus] = useState("");
  const [ffHeld, setFfHeld] = useState(false);
  const [ffLocked, setFfLocked] = useState(false);
  const [ffRatio, setFfRatio] = useState(4);
  const [candyNote, setCandyNote] = useState<string | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [tms, setTms] = useState<TmEntry[] | null>(null);
  const [tmOpen, setTmOpen] = useState(false);
  const [tmFilter, setTmFilter] = useState("");
  const [teachOpen, setTeachOpen] = useState(false);
  const [barCollapsed, setBarCollapsed] = useState(false);
  const [teachMon, setTeachMon] = useState(0);
  const [teachSlot, setTeachSlot] = useState(0);
  const [teachMove, setTeachMove] = useState("");
  const [stuck, setStuck] = useState(false);
  const [stateMismatch, setStateMismatch] = useState(false);
  const [noWebgl2, setNoWebgl2] = useState(false);
  const [gfxLost, setGfxLost] = useState(false);
  const [gfxCompat, setGfxCompat] = useState(false);
  const [speed, setSpeed] = useState<number | null>(null);
  const fastForward = ffHeld || ffLocked;
  const [overlay, setOverlay] = useState(true);
  const [editing, setEditing] = useState(false);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const handledDeaths = useRef(new Set<number>());
  const wipeReported = useRef(false);
  const [live, setLive] = useState<LiveStatus[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [myParty, setMyParty] = useState<Mon[] | null>(null);
  const [myMapId, setMyMapId] = useState<number | null>(null);
  const [myPos, setMyPos] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [mySave, setMySave] = useState<Gen4Save | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [run, setRun] = useState<RunWithRelations | null>(null);
  const profiles = useProfiles();
  const [caps, setCaps] = useLevelCaps(id);
  const [notices, setNotices] = useState<string[]>([]);
  const assets = useHgssAssets(run?.game_code);
  const game = gen4Game(run?.game_code ?? null);

  useEffect(() => {
    if (!me || !run || !myParty || run.mode === "casual") return;
    const fainted = myParty.filter((m) => !m.isEgg && m.hp === 0);
    for (const mon of fainted) {
      if (handledDeaths.current.has(mon.pid)) continue;
      const enc = encounters.find((e) => e.user_id === me && e.pid !== null && Number(e.pid) === mon.pid && e.status === "caught");
      if (!enc) continue;
      handledDeaths.current.add(mon.pid);
      void supabase().from("encounters").update({ status: "dead", in_party: false }).eq("id", enc.id);
      setNotices((cur) => [`${mon.isNicknamed ? mon.nickname : mon.speciesName} ist gestorben… (${enc.location})`, ...cur].slice(0, 3));
    }
    const fighters = myParty.filter((m) => !m.isEgg);
    if (fighters.length && fighters.every((m) => m.hp === 0) && !run.ended_at && !wipeReported.current) {
      wipeReported.current = true;
      const name = profiles.find((p) => p.id === me)?.name ?? "?";
      const reason = `Das ganze Team von ${name} wurde besiegt.`;
      void supabase().from("runs").update({ ended_at: new Date().toISOString(), end_reason: reason, result: "lost", ended_by: me }).eq("id", run.id);
      setRun((cur) => (cur ? { ...cur, ended_at: new Date().toISOString(), end_reason: reason } : cur));
      setGameOver(reason);
    }
  }, [me, run, myParty, encounters, profiles]);

  useEffect(() => {
    if (!me || !run) return;
    const party = myParty ?? mySave?.party ?? null;
    if (!party) return;
    const tids = party.map((m) => m.tid);
    const save: Gen4Save = mySave
      ? { ...mySave, party }
      : {
          game: game ?? "hgss",
          trainer: "",
          tid: tids.sort((a, b) => tids.filter((t) => t === b).length - tids.filter((t) => t === a).length)[0],
          money: 0,
          badges: 0,
          kantoBadges: 0,
          playSeconds: 0,
          party,
          boxes: [],
        };
    autoTrack(run.id, me, save, encounters).then((added) => {
      if (!added.length) return;
      setNotices((cur) =>
        [...added.map((a) => `${a.mon.isNicknamed ? a.mon.nickname : a.mon.speciesName} wurde für ${a.location} eingetragen!`), ...cur].slice(0, 3),
      );
    });
  }, [me, run, myParty, mySave, encounters]);

  const toggleOverlay = useCallback(() => {
    setOverlay((v) => {
      try {
        localStorage.setItem("overlay", v ? "0" : "1");
      } catch {}
      return !v;
    });
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem("overlay") === "0") setOverlay(false);
    } catch {}
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "o" || e.key === "O") toggleOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleOverlay]);

  useEffect(() => {
    const client = supabase();
    const loadLive = async () => {
      const { data } = await client.from("live_status").select("*").eq("run_id", id);
      setLive((data as LiveStatus[]) ?? []);
    };
    const loadEnc = async () => {
      const { data } = await client.from("encounters").select("*").eq("run_id", id).order("created_at");
      setEncounters((data as Encounter[]) ?? []);
    };
    loadLive();
    loadEnc();
    const channel = client
      .channel(`play-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_status", filter: `run_id=eq.${id}` }, loadLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "encounters", filter: `run_id=eq.${id}` }, loadEnc)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "runs", filter: `id=eq.${id}` }, (payload: { new: { ended_at: string | null; end_reason: string | null } }) => {
        const next = payload.new;
        setRun((cur) => (cur ? { ...cur, ended_at: next.ended_at, end_reason: next.end_reason } : cur));
        if (next.ended_at && !wipeReported.current) {
          wipeReported.current = true;
          setGameOver(next.end_reason ?? "Der Run ist vorbei.");
        }
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [id]);
  const userRef = useRef<string | null>(null);
  const gameRef = useRef<Gen4Game | null>(null);
  const lastSram = useRef<string | null>(null);
  const lastFrame = useRef<number>(-1);
  const busy = useRef(false);
  const quitting = useRef(false);
  const pendingKey = useRef("");
  const lastLive = useRef("");

  useEffect(() => {
    setFfRatio(readRatio());
    try {
      setBarCollapsed(localStorage.getItem("bar-collapsed") === "1");
    } catch {}
    try {
      setGfxCompat(localStorage.getItem("gfx-compat") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    applyFastForward(fastForward, ffRatio);
  }, [fastForward, ffRatio, phase]);

  useEffect(() => {
    if (phase !== "running") return;
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e)) return;
      e.preventDefault();
      setFfHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setFfHeld(false);
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "running") return;
    let last = gm()?.getFrameNum?.() ?? null;
    let lastAt = performance.now();
    const timer = setInterval(() => {
      const now = gm()?.getFrameNum?.();
      const at = performance.now();
      if (now != null && last != null && now >= last) setSpeed((now - last) / 60 / ((at - lastAt) / 1000));
      last = now ?? null;
      lastAt = at;
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const giveCandies = useCallback(() => {
    const g = gm();
    const game = gameRef.current;
    if (!g || !game) return;
    const state = g.getState();
    const result = patchStateCandies(state, game);
    if (result === "added") g.loadState(state);
    const text = {
      added: "999 Sonderbonbons liegen in der Medizin-Tasche",
      already: "Du hast schon 999 Sonderbonbons",
      full: "Medizin-Tasche ist voll",
      notfound: "Tasche nicht gefunden – erst nach dem Starter-Pokémon möglich",
    }[result];
    setCandyNote(text);
    setTimeout(() => setCandyNote(null), 5000);
  }, []);

  const giveItem = useCallback(() => {
    const g = gm();
    const game = gameRef.current;
    const item = giveableItems(gameRef.current).find((it) => it.name.toLowerCase() === itemName.trim().toLowerCase());
    if (!g || !game) return;
    if (!item) {
      setCandyNote("Item nicht gefunden – Namen aus der Liste wählen");
      return;
    }
    const state = g.getState();
    const result = giveItemInState(state, game, item.id, Math.max(1, itemQty));
    if (result === "added") g.loadState(state);
    const tm = tms?.find((t) => t.label === item.name);
    const shown = tm ? `${item.name} (${tm.moveName})` : item.name;
    const text = {
      added: `${Math.max(1, itemQty)}× ${shown} liegt im Beutel`,
      already: `${item.name}: Maximum schon erreicht`,
      full: "Diese Tasche ist voll",
      notfound: "Beutel nicht gefunden – erst nach dem Starter-Pokémon möglich",
      invalid: "Dieses Item kann nicht vergeben werden",
    }[result];
    setCandyNote(text);
    setTimeout(() => setCandyNote(null), 5000);
  }, [itemName, itemQty, tms]);

  const teach = useCallback(() => {
    const g = gm();
    const game = gameRef.current;
    const move = moveNamesFor(gameRef.current).find((m) => m.name.toLowerCase() === teachMove.trim().toLowerCase());
    if (!g || !game) return;
    if (!move) {
      setCandyNote("Attacke nicht gefunden – Namen aus der Liste wählen");
      return;
    }
    const state = g.getState();
    const result = teachMoveInState(state, game, teachMon, teachSlot, move.id);
    if (result === "taught") g.loadState(state);
    setCandyNote(
      result === "taught"
        ? `${myParty?.[teachMon]?.nickname ?? "Pokémon"} kann jetzt ${move.name}`
        : result === "invalid"
          ? "Das Pokémon kennt die Attacke schon"
          : "Team nicht gefunden – erst nach dem Starter-Pokémon möglich",
    );
    setTimeout(() => setCandyNote(null), 5000);
  }, [teachMove, teachMon, teachSlot, myParty]);

  const pushLive = useCallback(async () => {
    const g = gm();
    const userId = userRef.current;
    if (!g || !userId) return;
    if (!gameRef.current) return;
    const found = findLiveState(g.getState(), gameRef.current);
    if (!found) return;
    const { party, mapId, x, y } = found;
    setMyParty(party);
    setMyMapId(mapId);
    setMyPos({ x, y });
    const json = JSON.stringify([party, mapId, x, y]);
    if (json === lastLive.current) return;
    lastLive.current = json;
    await supabase()
      .from("live_status")
      .upsert(
        { run_id: id, user_id: userId, party, map_id: mapId, pos_x: x, pos_y: y, updated_at: new Date().toISOString() },
        { onConflict: "run_id,user_id" },
      );
  }, [id]);

  const snapshotLocal = useCallback(async () => {
    const g = gm();
    if (!g) return null;
    const now = Date.now();
    const record: Pending = { state: g.getState(), stateAt: now };
    const sram = g.getSaveFile();
    if (sram) {
      record.sram = sram;
      record.sramAt = now;
    }
    await idbSet("pending", pendingKey.current, record);
    return record;
  }, []);

  const flush = useCallback(
    async (opts: { state: boolean; force?: boolean }) => {
      const g = gm();
      const userId = userRef.current;
      if (!g || !userId || busy.current) return false;
      busy.current = true;
      try {
        let didSomething = false;
        const sram = g.getSaveFile();
        if (sram) {
          const sum = checksum(sram);
          if (sum !== lastSram.current) {
            setSaveStatus("speichert Ingame-Save…");
            await uploadSave(id, userId, "sram", sram);
            lastSram.current = sum;
            const parsedSave = gameRef.current ? parseGen4Save(sram, gameRef.current) : null;
            if (parsedSave) {
              setMySave(parsedSave);
              void publishSummary(id, userId, parsedSave).catch(() => null);
            }
            didSomething = true;
          }
        }
        if (opts.state) {
          const frameNum = g.getFrameNum?.() ?? -2;
          if (opts.force || frameNum !== lastFrame.current) {
            setSaveStatus("speichert Fortsetzungs-Stand…");
            await snapshotLocal();
            await uploadSave(id, userId, "state", g.getState());
            await idbDelete("pending", pendingKey.current);
            lastFrame.current = frameNum;
            didSomething = true;
          }
        }
        if (didSomething) setSaveStatus(`gesichert ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`);
        return true;
      } catch (err) {
        setSaveStatus(`Upload-Fehler, lokal gesichert (${err instanceof Error ? err.message : "?"})`);
        return false;
      } finally {
        busy.current = false;
      }
    },
    [id, snapshotLocal],
  );

  const saveAndQuit = useCallback(async () => {
    if (quitting.current) return;
    quitting.current = true;
    setSaveStatus("speichert und beendet…");
    await snapshotLocal();
    await pushLive().catch(() => null);
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      while (busy.current) await new Promise((r) => setTimeout(r, 100));
      ok = await flush({ state: true, force: true });
    }
    if (!ok) {
      quitting.current = false;
      setSaveStatus("Upload fehlgeschlagen. Stand liegt lokal und wird beim nächsten Start hochgeladen.");
      return;
    }
    window.location.href = `/runs/${id}`;
  }, [flush, id, snapshotLocal, pushLive]);

  useEffect(() => {
    let cancelled = false;
    let stopBridge: (() => void) | null = null;
    const stopCams: (() => void)[] = [];
    const timers: ReturnType<typeof setInterval>[] = [];

    async function boot() {
      const client = supabase();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) return;
      userRef.current = user.id;
      setMe(user.id);
      pendingKey.current = `${id}:${user.id}`;

      const { data } = await client.from("runs").select("*, run_players(*)").eq("id", id).maybeSingle();
      const r = data as RunWithRelations | null;
      if (!r) {
        setPhase("error");
        setMessage("Run nicht gefunden.");
        return;
      }
      setRun(r);
      if (r.ended_at) {
        wipeReported.current = true;
        setGameOver(r.end_reason ?? "Der Run ist vorbei.");
      }
      if (r.archived_at) {
        setPhase("error");
        setMessage("Dieser Run ist archiviert. Die ROM wurde gelöscht, Tracker und Statistik bleiben erhalten.");
        return;
      }
      const mine = r.run_players.find((p) => p.user_id === user.id);
      if (!mine) {
        setPhase("error");
        setMessage("Du bist in diesem Run kein Spieler.");
        return;
      }
      if (r.randomize !== "none" && mine.status !== "ready") {
        setPhase("error");
        setMessage("Deine ROM für diesen Run ist noch nicht randomisiert. Das machst du auf der Run-Seite.");
        return;
      }

      setPhase("rom");
      let rom: Uint8Array;
      try {
        rom = await loadRunRom(r, mine, await myLibrary(), (done, total) => setProgress(total ? done / total : 0));
      } catch (err) {
        setPhase("error");
        setMessage(err instanceof Error ? err.message : String(err));
        return;
      }
      if (cancelled) return;
      const g4 = gen4Game(r.game_code);
      gameRef.current = g4;
      if (g4) void ensureHgssAssets(rom, g4).catch(() => null);
      if (g4) {
        try {
          setTms(readTmMoves(rom, g4));
        } catch {
          setTms(null);
        }
      }

      setPhase("saves");
      const choice = new URLSearchParams(window.location.search).get("state");
      const pending = choice ? null : await idbGet<Pending>("pending", pendingKey.current);
      const [serverSram, latestState] = await Promise.all([latestSave(id, user.id, "sram"), latestSave(id, user.id, "state")]);
      let serverState = latestState;
      if (choice === "none") serverState = null;
      else if (choice) {
        const { data: picked } = await client.from("saves").select("*").eq("id", Number(choice)).eq("user_id", user.id).maybeSingle();
        serverState = (picked as SaveRow | null) ?? null;
      }

      let sram: Uint8Array | null = null;
      let state: Uint8Array | null = null;
      let uploadPendingSram = false;
      let uploadPendingState = false;

      const serverSramAt = serverSram ? new Date(serverSram.created_at).getTime() : 0;
      const serverStateAt = serverState ? new Date(serverState.created_at).getTime() : 0;

      if (pending?.sram && (pending.sramAt ?? 0) > serverSramAt) {
        sram = pending.sram;
        uploadPendingSram = true;
      } else if (serverSram) {
        sram = await downloadSave(serverSram);
      }
      if (pending?.state && (pending.stateAt ?? 0) > serverStateAt) {
        state = pending.state;
        uploadPendingState = true;
      } else if (serverState) {
        state = await downloadSave(serverState);
      }
      if (r.rare_candies && g4) {
        if (state) patchStateCandies(state, g4);
        if (sram) patchSaveCandies(sram, g4);
      }
      if (sram) lastSram.current = uploadPendingSram ? null : checksum(sram);
      if (sram && g4) {
        const first = parseGen4Save(sram, g4);
        setMySave(first);
        // damit die anderen das team direkt sehen
        if (first) void publishSummary(id, user.id, first).catch(() => null);
      }
      if (cancelled) return;

      const w = window as unknown as Win;
      const system = r.system;
      w.EJS_player = "#game";
      w.EJS_core = SYSTEMS[system].core;
      w.EJS_pathtodata = EJS_DATA;
      w.EJS_gameUrl = URL.createObjectURL(new Blob([rom as BlobPart]));
      w.EJS_gameName = `run-${id}`;
      w.EJS_gameID = id;
      w.EJS_startOnLoaded = true;
      w.EJS_disableDatabases = true;
      w.EJS_defaultControls = DEFAULT_CONTROLS;
      w.EJS_Buttons = HIDDEN_BUTTONS;
      w.EJS_color = "#e3b341";
      w.EJS_disableLocalStorage = true;
      let compat = false;
      try {
        compat = localStorage.getItem("gfx-compat") === "1";
      } catch {}
      w.EJS_defaultOptions = { webgl2Enabled: compat ? "disabled" : "enabled", vsync: "enabled", fastForward: "disabled", ejs_threads: "disabled" };
      setNoWebgl2(!document.createElement("canvas").getContext("webgl2"));
      w.EJS_onGameStart = () => {
        setTimeout(async () => {
          try {
            if (sram) writeSram(sram);
            const expected = state ? gm()?.getState().length ?? 0 : 0;
            if (state && expected && state.length !== expected) {
              setStateMismatch(true);
              uploadPendingState = false;
              state = null;
            }
            if (state) {
              gm()?.loadState(state);
              const before = gm()?.getFrameNum?.() ?? 0;
              setTimeout(() => {
                const after = gm()?.getFrameNum?.() ?? 0;
                if (after - before < 30) setStuck(true);
              }, 6000);
            }
          } catch (err) {
            setSaveStatus(`Stand konnte nicht geladen werden: ${err instanceof Error ? err.message : "?"}`);
          }
          lastFrame.current = gm()?.getFrameNum?.() ?? -1;
          applyFastForward(false, readRatio());
          gm()?.setVSync?.(1);
          document.querySelector<HTMLCanvasElement>("#game canvas")?.addEventListener("webglcontextlost", () => setGfxLost(true));
          if (uploadPendingState || uploadPendingSram) {
            if (uploadPendingState && state) await uploadSave(id, user.id, "state", state).catch(() => null);
            if (uploadPendingSram && sram) {
              await uploadSave(id, user.id, "sram", sram).catch(() => null);
              lastSram.current = checksum(sram);
            }
            await idbDelete("pending", pendingKey.current);
            setSaveStatus("lokalen Stand nachträglich hochgeladen");
          }
          timers.push(setInterval(() => flush({ state: false }), SRAM_INTERVAL));
          timers.push(setInterval(() => flush({ state: true }), STATE_INTERVAL));
          if (supportsSaveView(r.game_code)) {
            void pushLive().catch(() => null);
            timers.push(setInterval(() => void pushLive().catch(() => null), LIVE_INTERVAL));
          }
        }, 1000);
        (w.EJS_emulator as { gamepad?: { terminate?: () => void } } | undefined)?.gamepad?.terminate?.();
        const stopCam = hostBattlecam(
          user.id,
          () => document.querySelector<HTMLCanvasElement>("#game canvas"),
          supabaseTransport(id),
          system === "nds" ? 256 / 384 : system === "gba" ? 240 / 160 : 160 / 144,
        );
        stopCams.push(stopCam);
        stopBridge = startGamepadBridge({
          touch: system === "nds",
          getCanvas: () => document.querySelector<HTMLCanvasElement>("#game canvas"),
          simulate: (index, value) => gm()?.simulateInput(0, index, value),
          onSaveQuit: () => saveAndQuit(),
          onStatus: setPadStatus,
          onToggleOverlay: toggleOverlay,
          onFastForward: setFfHeld,
        });
      };

      setPhase("running");
      if (cancelled || w.__ejsLoaderInjected) return;
      w.__ejsLoaderInjected = true;
      const script = document.createElement("script");
      script.src = `${EJS_DATA}loader.js`;
      document.body.appendChild(script);
    }

    boot().catch((err) => {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Unbekannter Fehler");
    });

    const onHide = () => {
      if (document.visibilityState === "hidden" && gm() && !quitting.current) {
        snapshotLocal().then(() => flush({ state: true }));
      }
    };
    const onPageHide = () => {
      if (gm() && !quitting.current) void snapshotLocal();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      timers.forEach(clearInterval);
      stopBridge?.();
      stopCams.forEach((fn) => fn());
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [id]);

  return (
    <div className="play">
      <div className={`play-bar${barCollapsed ? " collapsed" : ""}`}>
        <button
          className="bar-toggle"
          title={barCollapsed ? "Leiste ausklappen" : "Leiste einklappen"}
          onClick={() => {
            const next = !barCollapsed;
            setBarCollapsed(next);
            try {
              localStorage.setItem("bar-collapsed", next ? "1" : "0");
            } catch {}
          }}
        >
          {barCollapsed ? "▼" : "▲"}
        </button>
        <span className="title">{run?.name ?? "…"}</span>
        {padStatus && <span className="small muted">{padStatus}</span>}
        <span className="small muted">{saveStatus}</span>
        {phase === "running" && (
          <>
            {supportsSaveView(run?.game_code ?? null) && (
              <>
                <button onClick={toggleOverlay}>Overlay</button>
                <button onClick={() => setEditing((v) => !v)}>{editing ? "Editor schließen" : "Overlay bearbeiten"}</button>
                <button onClick={() => setCaps(!caps)}>Level-Caps {caps ? "an" : "aus"}</button>
              </>
            )}
            <button className={fastForward ? "primary" : ""} onClick={() => setFfLocked((v) => !v)}>
              ⏩ {ffLocked ? "Vorspulen an" : "Vorspulen"}
            </button>
            <select
              value={ffRatio}
              title="Vorspul-Tempo"
              onChange={(e) => {
                const v = Number(e.target.value);
                setFfRatio(v);
                try {
                  localStorage.setItem(FF_KEY, String(v));
                } catch {}
              }}
            >
              {FF_RATIOS.map((r) => (
                <option key={r} value={r}>
                  {r ? `${r}×` : "Max"}
                </option>
              ))}
            </select>

            {speed !== null && (
              <span
                className={`small ${fastForward && speed < 1.4 ? "error" : "muted"}`}
                title="Tatsächliches Spieltempo"
              >
                {speed.toFixed(1)}×{fastForward && speed < 1.4 ? " – Rechner/Browser zu langsam zum Vorspulen" : ""}
              </span>
            )}
            {supportsSaveView(run?.game_code ?? null) && <button onClick={giveCandies}>🍬 999 Sonderbonbons</button>}
            {supportsSaveView(run?.game_code ?? null) && <button onClick={() => setItemOpen((v) => !v)}>🎁 Item</button>}
            {tms && <button onClick={() => setTmOpen((v) => !v)}>💿 TMs</button>}
            {supportsSaveView(run?.game_code ?? null) && <button onClick={() => setTeachOpen((v) => !v)}>📖 Attacke</button>}
            {teachOpen && (
              <span className="item-giver">
                <select value={teachMon} onChange={(e) => setTeachMon(Number(e.target.value))}>
                  {(myParty ?? []).map((m, i) => (
                    <option key={`${m.pid}-${i}`} value={i}>
                      {m.nickname || m.speciesName}
                    </option>
                  ))}
                </select>
                <select value={teachSlot} onChange={(e) => setTeachSlot(Number(e.target.value))}>
                  {[0, 1, 2, 3].map((i) => (
                    <option key={i} value={i}>
                      Platz {i + 1}: {myParty?.[teachMon]?.moves[i] ?? "frei"}
                    </option>
                  ))}
                </select>
                <input list="teach-moves" value={teachMove} placeholder="z. B. Blitz" onChange={(e) => setTeachMove(e.target.value)} onKeyDown={(e) => e.key === "Enter" && teach()} />
                <datalist id="teach-moves">
                  {moveNamesFor(game).map((m) => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>
                <button className="primary" onClick={teach}>
                  Beibringen
                </button>
              </span>
            )}
            {itemOpen && (
              <span className="item-giver">
                <input
                  list="give-items"
                  value={itemName}
                  placeholder="z. B. TM70"
                  onChange={(e) => setItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && giveItem()}
                />
                <datalist id="give-items">
                  {giveableItems(game).map((it) => (
                    <option key={it.id} value={it.name} label={tms?.find((t) => t.label === it.name)?.moveName} />
                  ))}
                </datalist>
                <input type="number" min={1} max={999} value={itemQty} onChange={(e) => setItemQty(Number(e.target.value) || 1)} />
                <button className="primary" onClick={giveItem}>
                  Geben
                </button>
              </span>
            )}
            {candyNote && <span className="small muted">{candyNote}</span>}
            <button
              title="Bild eingefroren, Ton läuft? Schaltet auf eine einfachere Grafik-Variante um und lädt neu."
              onClick={async () => {
                await flush({ state: true, force: true });
                try {
                  localStorage.setItem("gfx-compat", gfxCompat ? "0" : "1");
                } catch {}
                window.location.reload();
              }}
            >
              {gfxCompat ? "Grafik: Kompatibel" : "Grafik: Normal"}
            </button>
            <button onClick={() => flush({ state: true, force: true })}>Jetzt sichern</button>
            <button className="primary" onClick={saveAndQuit}>
              Speichern &amp; Beenden
            </button>
          </>
        )}
        {phase !== "running" && <Link href={`/runs/${id}`}>Zurück</Link>}
      </div>
      <div className="play-stage">
        <div id="game" />
        {tmOpen && tms && (
          <div className="tm-panel">
            <div className="row">
              <strong>TMs & VMs in deiner ROM</strong>
              <button onClick={() => setTmOpen(false)} style={{ marginLeft: "auto" }}>
                ✕
              </button>
            </div>
            <input placeholder="Suchen…" onChange={(e) => setTmFilter(e.target.value)} />
            <div className="tm-grid">
              {tms
                .filter((t) => !tmFilter || `${t.label} ${t.moveName}`.toLowerCase().includes(tmFilter.toLowerCase()))
                .map((t) => (
                  <button
                    key={t.label}
                    className="tm-entry"
                    title="Ins Item-Feld übernehmen"
                    onClick={() => {
                      setItemName(t.label);
                      setItemQty(1);
                      setItemOpen(true);
                    }}
                  >
                    <b>{t.label}</b> {t.moveName}
                  </button>
                ))}
            </div>
          </div>
        )}
        {gfxLost && (
          <div className="stuck-banner" style={{ top: 116 }}>
            Die Grafik ist im Browser abgestürzt. Chrome komplett schließen und neu öffnen oder oben auf „Grafik: Normal“ klicken.
            <button onClick={() => setGfxLost(false)}>✕</button>
          </div>
        )}
        {(stateMismatch || noWebgl2) && (
          <div className="stuck-banner" style={{ top: stuck ? 64 : 12 }}>
            {noWebgl2
              ? "Grafikbeschleunigung (WebGL2) ist im Browser aus. Browser komplett neu starten, sonst läuft der Emulator in einer langsamen Variante."
              : "Dein Fortsetzungs-Stand passt nicht zu dieser Emulator-Variante und wurde übersprungen. Du startest vom Ingame-Spielstand."}
            <button
              onClick={() => {
                setStateMismatch(false);
                setNoWebgl2(false);
              }}
            >
              ✕
            </button>
          </div>
        )}
        {stuck && (
          <div className="stuck-banner">
            Das Spiel scheint nach dem Laden zu hängen.{" "}
            <Link href={`/runs/${id}#wiederherstellen`}>Älteren Stand oder nur den Ingame-Spielstand laden →</Link>
            <button onClick={() => setStuck(false)}>✕</button>
          </div>
        )}
        {gameOver && run && (
          <GameOver
            reason={gameOver}
            runId={run.id}
            onContinue={() => setGameOver(null)}
            stats={profiles
              .filter((p) => run.run_players.some((rp) => rp.user_id === p.id))
              .map((p) => ({
                name: p.name,
                deaths: encounters.filter((e) => e.user_id === p.id && e.status === "dead").length,
                caught: encounters.filter((e) => e.user_id === p.id && e.status !== "missed").length,
              }))}
          />
        )}
        {phase === "running" && me && run && supportsSaveView(run.game_code) && (
          <OverlayLayer
            hidden={!overlay}
            editing={editing}
            onDone={() => setEditing(false)}
            data={{
              runId: run.id,
              mode: run.mode,
              userId: me,
              players: profiles.filter((p) => run.run_players.some((rp) => rp.user_id === p.id)),
              live,
              encounters,
              myParty,
              myMapId,
              myPos,
              mySave,
              game: game ?? "hgss",
              mapUrl: assets.mapUrl,
              iconsUrl: assets.iconsUrl,
              notices,
            }}
          />
        )}
        {phase !== "running" && (
          <div className="play-loading">
            <div className="card stack" style={{ minWidth: 280 }}>
              {phase === "error" ? (
                <p className="error">{message}</p>
              ) : (
                <>
                  <span>
                    {phase === "rom" ? (progress >= 1 ? "ROM geladen" : "ROM wird geladen…") : phase === "saves" ? "Spielstand wird geladen…" : "Startet…"}
                  </span>
                  <div className="progress">
                    <div style={{ width: `${Math.round((phase === "rom" ? progress : phase === "saves" ? 1 : 0) * 100)}%` }} />
                  </div>
                  <span className="small muted">Beim ersten Mal wird die ROM heruntergeladen, danach kommt sie aus dem Browser-Cache.</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {run && <ChatDock runId={run.id} inGame />}
    </div>
  );
}
