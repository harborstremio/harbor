import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { dispatchTvNav } from "@/lib/keyboard-navigation";
import { isGamepadCaptured } from "./capture";
import { publishGamepads } from "./store";
import { resetLiveGamepad, setLiveAxis, setLiveButton } from "./live";
import { startWebGamepadSource } from "./web-source";
import type { GamepadEventPayload, GamepadInfo, GpAxis, GpButton } from "./protocol";
import {
  NAV_AXIS,
  NAV_BUTTON,
  NAV_REPEATABLE,
  PLAYER_AXIS,
  PLAYER_BUTTON,
  PLAYER_REPEATABLE,
  type PlayerKey,
} from "./mapping";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const CONTROLLER_ACTIVITY = "harbor:controller-activity";
const NAV_WHEN_CONTROLS_UP = new Set<GpButton>(["dup", "ddown", "dleft", "dright", "south"]);

function controlsUp(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.hasAttribute("data-player-chrome-visible")
  );
}

function synthKey({ key, code }: PlayerKey): void {
  const init = { key, code, bubbles: true, cancelable: true };
  window.dispatchEvent(new KeyboardEvent("keydown", init));
  window.dispatchEvent(new KeyboardEvent("keyup", init));
}

function keyboardNav(dir: string): boolean {
  const root = document.querySelector<HTMLElement>("[data-controller-keyboard]");
  if (!root || !["up", "down", "left", "right"].includes(dir)) return false;
  const keys = [...root.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
  const current = root.contains(document.activeElement)
    ? (document.activeElement as HTMLButtonElement)
    : null;
  if (!current) {
    keys[0]?.focus({ preventScroll: true });
    return true;
  }
  const a = current.getBoundingClientRect(),
    ax = a.left + a.width / 2,
    ay = a.top + a.height / 2;
  let candidates = keys
    .filter((key) => key !== current)
    .map((key) => {
      const b = key.getBoundingClientRect(),
        dx = b.left + b.width / 2 - ax,
        dy = b.top + b.height / 2 - ay;
      const valid =
        dir === "left" ? dx < 0 : dir === "right" ? dx > 0 : dir === "up" ? dy < 0 : dy > 0;
      const primary = dir === "left" || dir === "right" ? Math.abs(dx) : Math.abs(dy);
      const cross = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
      return { key, valid, primary, cross };
    })
    .filter((x) => x.valid);
  if (dir === "left" || dir === "right") {
    const sameRow = candidates.filter((x) => x.cross < a.height / 2);
    if (sameRow.length) candidates = sameRow;
  }
  const next = candidates.sort((x, y) => x.primary + x.cross * 2 - y.primary - y.cross * 2)[0];
  next?.key.focus({ preventScroll: true });
  return true;
}

let nativePads: GamepadInfo[] = [];
let webPads: GamepadInfo[] = [];

function publishMerged(): void {
  publishGamepads([...nativePads, ...webPads]);
}

function seedList(): void {
  void invoke<GamepadInfo[]>("gamepad_list")
    .then((list) => {
      nativePads = list ?? [];
      publishMerged();
    })
    .catch(() => {});
}

export function useGamepad(): void {
  const { settings } = useSettings();
  const { player } = useView();
  const enabled = settings.controllerSupportEnabled;
  const backgroundInput = settings.controllerBackgroundInput;

  useEffect(() => {
    void invoke("gamepad_set_background_input", { allowed: backgroundInput }).catch(() => {});
  }, [backgroundInput]);

  const cfgRef = useRef({
    deadzone: settings.controllerDeadzone,
    repeatMs: settings.controllerRepeatMs,
    initialDelayMs: settings.controllerInitialDelayMs,
  });
  cfgRef.current = {
    deadzone: settings.controllerDeadzone,
    repeatMs: settings.controllerRepeatMs,
    initialDelayMs: settings.controllerInitialDelayMs,
  };

  const playerRef = useRef(!!player);
  playerRef.current = !!player;

  const backgroundInputRef = useRef(backgroundInput);
  backgroundInputRef.current = backgroundInput;

  useEffect(() => {
    if (!isTauri || !enabled) return;

    const repeats = new Map<string, { delay: number | null; interval: number | null }>();
    const axisDir = new Map<GpAxis, "neg" | "pos" | null>();

    const stopRepeat = (id: string) => {
      const r = repeats.get(id);
      if (!r) return;
      if (r.delay != null) window.clearTimeout(r.delay);
      if (r.interval != null) window.clearInterval(r.interval);
      repeats.delete(id);
    };
    // fire is told whether this is the first press or the autorepeat, because a
    // synthetic keydown that always claimed repeat:false made a held stick
    // indistinguishable from a burst of taps downstream.
    const startRepeat = (id: string, fire: (repeat: boolean) => void) => {
      stopRepeat(id);
      fire(false);
      const r: { delay: number | null; interval: number | null } = { delay: null, interval: null };
      r.delay = window.setTimeout(() => {
        r.delay = null;
        r.interval = window.setInterval(() => fire(true), Math.max(40, cfgRef.current.repeatMs));
      }, Math.max(0, cfgRef.current.initialDelayMs));
      repeats.set(id, r);
    };
    const stopAll = () => {
      for (const id of [...repeats.keys()]) stopRepeat(id);
    };

    const fireButton = (button: GpButton, repeat = false) => {
      if (isGamepadCaptured()) return;
      if (playerRef.current) {
        window.dispatchEvent(new Event(CONTROLLER_ACTIVITY));
        if (!(controlsUp() && NAV_WHEN_CONTROLS_UP.has(button))) {
          const key = PLAYER_BUTTON[button];
          if (key) synthKey(key);
          return;
        }
      }
      const nav = NAV_BUTTON[button];
      if (nav && !keyboardNav(nav)) {
        dispatchTvNav(nav, repeat);
        document.activeElement?.dispatchEvent(
          new CustomEvent("harbor-controller-focus", { bubbles: true }),
        );
      }
    };

    const fireAxis = (axis: GpAxis, dir: "neg" | "pos", repeat = false) => {
      if (isGamepadCaptured()) return;
      if (playerRef.current) {
        window.dispatchEvent(new Event(CONTROLLER_ACTIVITY));
        if (!axisNavigates(axis)) {
          const key = PLAYER_AXIS[axis]?.[dir];
          if (key) synthKey(key);
          return;
        }
      }
      const nav = NAV_AXIS[axis]?.[dir];
      if (nav) dispatchTvNav(nav, repeat);
    };

    const onButton = (button: GpButton, pressed: boolean) => {
      if (!pressed) {
        stopRepeat(`btn:${button}`);
        return;
      }
      const repeatable = playerRef.current
        ? PLAYER_REPEATABLE.has(button)
        : NAV_REPEATABLE.has(button);
      if (repeatable) startRepeat(`btn:${button}`, (r) => fireButton(button, r));
      else fireButton(button);
    };

    const axisNavigates = (axis: GpAxis) =>
      !playerRef.current || (controlsUp() && !!NAV_AXIS[axis] && axis !== "ry");

    const onAxis = (axis: GpAxis, value: number) => {
      const mapped = axisNavigates(axis) ? NAV_AXIS[axis] : PLAYER_AXIS[axis];
      const dz = Math.max(0.05, cfgRef.current.deadzone);
      const dir: "neg" | "pos" | null = !mapped
        ? null
        : value <= -dz
          ? "neg"
          : value >= dz
            ? "pos"
            : null;
      if ((axisDir.get(axis) ?? null) === dir) return;
      axisDir.set(axis, dir);
      stopRepeat(`axis:${axis}`);
      if (dir) startRepeat(`axis:${axis}`, (r) => fireAxis(axis, dir, r));
    };

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void invoke("gamepad_set_enabled", { enabled: true }).catch(() => {});
    seedList();

    void listen<GamepadEventPayload>("gamepad://event", (event) => {
      const p = event.payload;
      switch (p.kind) {
        case "connected":
          seedList();
          break;
        case "disconnected":
          resetLiveGamepad();
          seedList();
          break;
        case "button":
          setLiveButton(p.button, p.pressed);
          onButton(p.button, p.pressed);
          break;
        case "axis":
          setLiveAxis(p.axis, p.value);
          onAxis(p.axis, p.value);
          break;
      }
    }).then((raw) => {
      const safe = makeSafeTauriUnlisten(raw);
      if (cancelled) safe();
      else unlisten = safe;
    });

    const stopWebSource = startWebGamepadSource({
      onButton: (button, isPressed) => {
        setLiveButton(button, isPressed);
        onButton(button, isPressed);
      },
      onAxis: (axis, value) => {
        setLiveAxis(axis, value);
        onAxis(axis, value);
      },
      onPads: (pads) => {
        webPads = pads;
        publishMerged();
      },
      inputAllowed: () => backgroundInputRef.current || document.hasFocus(),
    });

    return () => {
      cancelled = true;
      stopAll();
      stopWebSource();
      axisDir.clear();
      webPads = [];
      resetLiveGamepad();
      unlisten?.();
      void invoke("gamepad_set_enabled", { enabled: false }).catch(() => {});
    };
  }, [enabled]);
}
