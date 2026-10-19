import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";

export type Msg = {
  type: "want" | "offer" | "answer" | "ice" | "bye";
  from: string;
  to: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

const ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

interface Bus {
  channel: RealtimeChannel;
  handlers: Set<(m: Msg) => void>;
  ready: Promise<void>;
  refs: number;
}

const buses = new Map<string, Bus>();

export interface CamTransport {
  send: (m: Msg) => Promise<void>;
  on: (h: (m: Msg) => void) => () => void;
  release: () => void;
}

export function supabaseTransport(runId: string): CamTransport {
  let b = buses.get(runId);
  if (!b) {
    const handlers = new Set<(m: Msg) => void>();
    const channel = supabase().channel(`cam-${runId}`, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "cam" }, ({ payload }: { payload: unknown }) => handlers.forEach((h) => h(payload as Msg)));
    const ready = new Promise<void>((resolve) => {
      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") resolve();
      });
    });
    b = { channel, handlers, ready, refs: 0 };
    buses.set(runId, b);
  }
  b.refs++;
  const current = b;
  return {
    send: async (m: Msg) => {
      await current.ready;
      await current.channel.send({ type: "broadcast", event: "cam", payload: m });
    },
    on: (h: (m: Msg) => void) => {
      current.handlers.add(h);
      return () => current.handlers.delete(h);
    },
    release: () => {
      current.refs--;
      if (current.refs <= 0) {
        supabase().removeChannel(current.channel);
        buses.delete(runId);
      }
    },
  };
}

function peer(onIce: (c: RTCIceCandidateInit) => void) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const queued: RTCIceCandidateInit[] = [];
  pc.onicecandidate = (e) => e.candidate && onIce(e.candidate.toJSON());
  return {
    pc,
    addIce: async (c: RTCIceCandidateInit) => {
      if (pc.remoteDescription) await pc.addIceCandidate(c).catch(() => null);
      else queued.push(c);
    },
    flush: async () => {
      for (const c of queued.splice(0)) await pc.addIceCandidate(c).catch(() => null);
    },
  };
}

function croppedStream(source: HTMLCanvasElement, aspect: number) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = source.captureStream(30);
  void video.play().catch(() => null);
  const out = document.createElement("canvas");
  const outH = 768;
  out.width = Math.round(outH * aspect);
  out.height = outH;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const timer = setInterval(() => {
    const cw = video.videoWidth;
    const ch = video.videoHeight;
    if (!cw || !ch) return;
    let w = cw;
    let h = ch;
    if (cw / ch > aspect) w = ch * aspect;
    else h = cw / aspect;
    ctx.drawImage(video, (cw - w) / 2, (ch - h) / 2, w, h, 0, 0, out.width, out.height);
  }, 1000 / 30);
  return {
    stream: out.captureStream(30),
    stop: () => {
      clearInterval(timer);
      (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    },
  };
}

export function hostBattlecam(me: string, getCanvas: () => HTMLCanvasElement | null, b: CamTransport, aspect = 256 / 384) {
  const peers = new Map<string, ReturnType<typeof peer>>();
  let crop: ReturnType<typeof croppedStream> | null = null;

  const off = b.on(async (m) => {
    if (m.to !== me) return;
    if (m.type === "want") {
      peers.get(m.from)?.pc.close();
      const canvas = getCanvas();
      if (!canvas) return;
      crop ??= croppedStream(canvas, aspect);
      const stream = crop.stream;
      const p = peer((candidate) => void b.send({ type: "ice", from: me, to: m.from, candidate }));
      peers.set(m.from, p);
      stream.getTracks().forEach((t) => {
        if ("contentHint" in t) t.contentHint = "detail";
        p.pc.addTrack(t, stream);
      });
      const offer = await p.pc.createOffer();
      await p.pc.setLocalDescription(offer);
      await b.send({ type: "offer", from: me, to: m.from, sdp: offer });
    } else if (m.type === "answer" && m.sdp) {
      const p = peers.get(m.from);
      if (!p) return;
      await p.pc.setRemoteDescription(m.sdp);
      await p.flush();
    } else if (m.type === "ice" && m.candidate) {
      await peers.get(m.from)?.addIce(m.candidate);
    } else if (m.type === "bye") {
      peers.get(m.from)?.pc.close();
      peers.delete(m.from);
    }
  });

  return () => {
    off();
    peers.forEach((p) => p.pc.close());
    crop?.stop();
    b.release();
  };
}

export type CamState = "connecting" | "live" | "offline";

export function watchBattlecam(
  me: string,
  target: string,
  onStream: (s: MediaStream | null) => void,
  onState: (s: CamState) => void,
  b: CamTransport,
) {
  let current: ReturnType<typeof peer> | null = null;
  let live = false;
  let tries = 0;
  onState("connecting");

  const off = b.on(async (m) => {
    if (m.to !== me || m.from !== target) return;
    if (m.type === "offer" && m.sdp) {
      current?.pc.close();
      const p = peer((candidate) => void b.send({ type: "ice", from: me, to: target, candidate }));
      current = p;
      p.pc.ontrack = (e) => {
        live = true;
        onState("live");
        onStream(e.streams[0] ?? new MediaStream([e.track]));
      };
      p.pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(p.pc.connectionState)) {
          live = false;
          onStream(null);
          onState("connecting");
        }
      };
      await p.pc.setRemoteDescription(m.sdp);
      await p.flush();
      const answer = await p.pc.createAnswer();
      await p.pc.setLocalDescription(answer);
      await b.send({ type: "answer", from: me, to: target, sdp: answer });
    } else if (m.type === "ice" && m.candidate) {
      await current?.addIce(m.candidate);
    }
  });

  const ask = () => {
    if (live) return;
    tries++;
    if (tries > 3) onState("offline");
    void b.send({ type: "want", from: me, to: target });
  };
  ask();
  const timer = setInterval(ask, 5000);

  return () => {
    clearInterval(timer);
    off();
    void b.send({ type: "bye", from: me, to: target });
    current?.pc.close();
    onStream(null);
    b.release();
  };
}
