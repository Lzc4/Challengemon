interface BridgeOptions {
  touch: boolean;
  getCanvas: () => HTMLCanvasElement | null;
  simulate: (index: number, value: number) => void;
  onSaveQuit: () => void;
  onStatus: (status: string) => void;
  onToggleOverlay?: () => void;
  onFastForward?: (on: boolean) => void;
}

const DEADZONE = 0.25;
const SPEED = 0.018;
const HOLD_MS = 800;

const BUTTON_MAP: Record<number, number> = {
  0: 0,
  1: 8,
  2: 1,
  3: 9,
  4: 10,
  5: 11,
  8: 2,
  9: 3,
  10: 14,
};

const PAD = { L2: 6, R2: 7, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, TOUCHPAD: 17 };

function screenRect(canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  const aspect = 256 / 384;
  let w = r.width;
  let h = r.height;
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  const left = r.left + (r.width - w) / 2;
  const top = r.top + (r.height - h) / 2;
  return { left, top: top + h / 2, width: w, height: h / 2 };
}

function padName(id: string) {
  const lower = id.toLowerCase();
  if (lower.includes("dualsense")) return "DualSense";
  if (lower.includes("dualshock") || lower.includes("054c") || lower.includes("wireless controller")) return "DualShock";
  return id.replace(/\(.*?\)/g, "").trim().slice(0, 40) || "Controller";
}

export function startGamepadBridge(opts: BridgeOptions) {
  const cursor = document.createElement("div");
  cursor.className = "touch-cursor";
  cursor.style.display = "none";
  document.body.appendChild(cursor);

  let x = 0.5;
  let y = 0.5;
  let lastMove = 0;
  let touching = false;
  let holdStart = 0;
  let quitFired = false;
  let l2Down = false;
  let r2Down = false;
  let frame = 0;
  let lastStatus = "";
  let lastClient = { x: 0, y: 0 };
  const sent = new Map<number, number>();

  function send(index: number, value: number) {
    if (sent.get(index) === value) return;
    sent.set(index, value);
    opts.simulate(index, value);
  }

  function status(text: string) {
    if (text === lastStatus) return;
    lastStatus = text;
    opts.onStatus(text);
  }

  function dispatch(type: string, cx: number, cy: number) {
    const canvas = opts.getCanvas();
    if (!canvas) return;
    canvas.dispatchEvent(
      new MouseEvent(type, {
        clientX: cx,
        clientY: cy,
        movementX: cx - lastClient.x,
        movementY: cy - lastClient.y,
        button: 0,
        buttons: touching ? 1 : 0,
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
    lastClient = { x: cx, y: cy };
  }

  function tick() {
    frame = requestAnimationFrame(tick);
    const pads = Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p && p.connected);
    const pad = pads.find((p) => p.mapping === "standard") ?? pads[0];
    if (!pad) {
      status("Kein Controller erkannt, drück eine Taste am Controller");
      return;
    }
    status(
      pad.mapping === "standard"
        ? `🎮 ${padName(pad.id)} verbunden`
        : `🎮 ${padName(pad.id)} ohne Standard-Belegung, bitte Chrome oder Edge nutzen`,
    );

    const pressed = (i: number) => !!pad.buttons[i]?.pressed;
    const now = performance.now();

    if (pressed(PAD.TOUCHPAD)) {
      if (!holdStart) holdStart = now;
      if (!quitFired && now - holdStart > HOLD_MS) {
        quitFired = true;
        opts.onSaveQuit();
      }
    } else {
      holdStart = 0;
    }

    const l2 = pressed(PAD.L2);
    if (l2 && !l2Down) opts.onToggleOverlay?.();
    l2Down = l2;

    const r2 = pressed(PAD.R2) || (pad.buttons[PAD.R2]?.value ?? 0) > 0.3;
    if (r2 !== r2Down) opts.onFastForward?.(r2);
    r2Down = r2;

    for (const [from, to] of Object.entries(BUTTON_MAP)) send(to, pressed(Number(from)) ? 1 : 0);

    const lx = pad.axes[0] ?? 0;
    const ly = pad.axes[1] ?? 0;
    send(4, pressed(PAD.UP) || ly < -0.5 ? 1 : 0);
    send(5, pressed(PAD.DOWN) || ly > 0.5 ? 1 : 0);
    send(6, pressed(PAD.LEFT) || lx < -0.5 ? 1 : 0);
    send(7, pressed(PAD.RIGHT) || lx > 0.5 ? 1 : 0);

    if (!opts.touch) return;
    const canvas = opts.getCanvas();
    if (!canvas) return;

    const rx = pad.axes[2] ?? 0;
    const ry = pad.axes[3] ?? 0;
    const moving = Math.abs(rx) > DEADZONE || Math.abs(ry) > DEADZONE;
    if (moving) {
      x = Math.min(1, Math.max(0, x + (Math.abs(rx) > DEADZONE ? rx * SPEED : 0)));
      y = Math.min(1, Math.max(0, y + (Math.abs(ry) > DEADZONE ? ry * SPEED : 0)));
      lastMove = now;
    }

    const rect = screenRect(canvas);
    const cx = rect.left + x * rect.width;
    const cy = rect.top + y * rect.height;
    const r3 = pressed(PAD.R3);
    cursor.style.display = now - lastMove < 3000 || r3 || touching ? "block" : "none";
    cursor.style.left = `${cx}px`;
    cursor.style.top = `${cy}px`;

    if (r3 && !touching) {
      touching = true;
      cursor.classList.add("down");
      dispatch("mousemove", cx, cy);
      dispatch("mousedown", cx, cy);
    } else if (!r3 && touching) {
      touching = false;
      cursor.classList.remove("down");
      dispatch("mouseup", cx, cy);
    } else if (touching && moving) {
      dispatch("mousemove", cx, cy);
    }
  }

  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    cursor.remove();
  };
}
