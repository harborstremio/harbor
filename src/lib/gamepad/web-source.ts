import type { GamepadInfo, GpAxis, GpButton } from "./protocol";

const STANDARD_BUTTONS: (GpButton | null)[] = [
  "south",
  "east",
  "west",
  "north",
  "lb",
  "rb",
  "lt",
  "rt",
  "back",
  "start",
  "lstick",
  "rstick",
  "dup",
  "ddown",
  "dleft",
  "dright",
  "guide",
];

const STANDARD_AXES: (GpAxis | null)[] = ["lx", "ly", "rx", "ry"];

const PRESS_THRESHOLD = 0.5;
const WEB_ID_BASE = 1000;

function isWindows(): boolean {
  return typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
}

const MICROSOFT_VENDOR = "045e";

function handledNatively(pad: Gamepad): boolean {
  const id = pad.id.toLowerCase();
  if (id.includes("xinput")) return true;
  return id.includes(MICROSOFT_VENDOR);
}

export type WebGamepadHandlers = {
  onButton: (button: GpButton, pressed: boolean) => void;
  onAxis: (axis: GpAxis, value: number) => void;
  onPads: (pads: GamepadInfo[]) => void;
};

export function startWebGamepadSource(h: WebGamepadHandlers): () => void {
  if (!isWindows()) return () => {};
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return () => {};
  }

  const pressed = new Map<string, boolean>();
  const axisValue = new Map<string, number>();
  let padSignature = "";
  let raf = 0;
  let discoveryTimer = 0;
  let stopped = false;

  const poll = (): boolean => {
    let list: (Gamepad | null)[];
    try {
      list = navigator.getGamepads();
    } catch {
      return false;
    }

    const active: GamepadInfo[] = [];
    for (const pad of list) {
      if (!pad || !pad.connected || handledNatively(pad)) continue;
      active.push({ id: WEB_ID_BASE + pad.index, name: pad.id });

      pad.buttons.forEach((btn, i) => {
        const name = STANDARD_BUTTONS[i];
        if (!name) return;
        const key = `${pad.index}:${name}`;
        const down = btn.pressed || btn.value >= PRESS_THRESHOLD;
        if (pressed.get(key) === down) return;
        pressed.set(key, down);
        h.onButton(name, down);
      });

      pad.axes.forEach((value, i) => {
        const name = STANDARD_AXES[i];
        if (!name) return;
        const key = `${pad.index}:${name}`;
        if (axisValue.get(key) === value) return;
        axisValue.set(key, value);
        h.onAxis(name, value);
      });
    }

    const signature = active.map((p) => `${p.id}:${p.name}`).join("|");
    if (signature !== padSignature) {
      padSignature = signature;
      h.onPads(active);
    }
    return active.length > 0;
  };

  // A requestAnimationFrame loop at 60 fps used to run forever, even with no
  // controller connected. Poll slowly while waiting for one and switch to RAF
  // only while an actual web gamepad is active.
  const stopRaf = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const scheduleDiscovery = () => {
    if (stopped || document.visibilityState === "hidden" || discoveryTimer) return;
    discoveryTimer = window.setTimeout(() => {
      discoveryTimer = 0;
      scan();
    }, 1500);
  };
  const frame = () => {
    if (stopped || document.visibilityState === "hidden") {
      stopRaf();
      return;
    }
    if (poll()) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      scheduleDiscovery();
    }
  };
  const scan = () => {
    if (stopped || document.visibilityState === "hidden") return;
    if (poll()) {
      stopRaf();
      raf = requestAnimationFrame(frame);
    } else scheduleDiscovery();
  };
  const onConnection = () => scan();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      stopRaf();
      if (discoveryTimer) window.clearTimeout(discoveryTimer);
      discoveryTimer = 0;
    } else scan();
  };

  window.addEventListener("gamepadconnected", onConnection);
  window.addEventListener("gamepaddisconnected", onConnection);
  document.addEventListener("visibilitychange", onVisibility);
  scan();
  return () => {
    stopped = true;
    stopRaf();
    if (discoveryTimer) window.clearTimeout(discoveryTimer);
    window.removeEventListener("gamepadconnected", onConnection);
    window.removeEventListener("gamepaddisconnected", onConnection);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
