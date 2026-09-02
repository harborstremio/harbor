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

const AUDIO_DEVICE = /headset|headphone|audio|cloud|\bmic\b/i;
const NON_GAMEPAD_VENDORS = ["0951", "03f0"];

export type GamepadShape = {
  id: string;
  mapping: string;
  buttons: readonly unknown[];
  axes: readonly number[];
};

export function isLikelyGamepad(pad: GamepadShape): boolean {
  const id = pad.id.toLowerCase();
  if (AUDIO_DEVICE.test(id)) return false;
  if (NON_GAMEPAD_VENDORS.some((vendor) => id.includes(`vendor: ${vendor}`))) return false;
  if (pad.mapping === "standard") return true;
  return pad.buttons.length >= 8 && pad.axes.length >= 2;
}

export type WebGamepadHandlers = {
  onButton: (button: GpButton, pressed: boolean) => void;
  onAxis: (axis: GpAxis, value: number) => void;
  onPads: (pads: GamepadInfo[]) => void;
  /** Gate input dispatch (e.g. on window focus loss). Defaults to always allowed. */
  inputAllowed?: () => boolean;
};

export function startWebGamepadSource(h: WebGamepadHandlers): () => void {
  if (!isWindows()) return () => {};
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return () => {};
  }

  const pressed = new Map<string, boolean>();
  const axisValue = new Map<string, number>();
  const inputAllowed = h.inputAllowed ?? (() => true);
  let padSignature = "";
  let raf = 0;
  let stopped = false;

  const poll = () => {
    if (stopped) return;
    raf = requestAnimationFrame(poll);

    let list: (Gamepad | null)[];
    try {
      list = navigator.getGamepads();
    } catch {
      return;
    }

    const active: GamepadInfo[] = [];
    for (const pad of list) {
      if (!pad || !pad.connected || handledNatively(pad) || !isLikelyGamepad(pad)) continue;
      active.push({ id: WEB_ID_BASE + pad.index, name: pad.id });

      pad.buttons.forEach((btn, i) => {
        const name = STANDARD_BUTTONS[i];
        if (!name) return;
        const key = `${pad.index}:${name}`;
        const down = btn.pressed || btn.value >= PRESS_THRESHOLD;
        if (pressed.get(key) === down) return;
        pressed.set(key, down);
        if (inputAllowed()) h.onButton(name, down);
      });

      pad.axes.forEach((value, i) => {
        const name = STANDARD_AXES[i];
        if (!name) return;
        const key = `${pad.index}:${name}`;
        if (axisValue.get(key) === value) return;
        axisValue.set(key, value);
        if (inputAllowed()) h.onAxis(name, value);
      });
    }

    const signature = active.map((p) => `${p.id}:${p.name}`).join("|");
    if (signature !== padSignature) {
      padSignature = signature;
      h.onPads(active);
    }
  };

  raf = requestAnimationFrame(poll);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
