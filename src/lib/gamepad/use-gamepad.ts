import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { dispatchTvNav } from "@/lib/keyboard-navigation";
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

function synthKey({ key, code }: PlayerKey): void {
  const init = { key, code, bubbles: true, cancelable: true };
  window.dispatchEvent(new KeyboardEvent("keydown", init));
  window.dispatchEvent(new KeyboardEvent("keyup", init));
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

  const backgroundRef = useRef(backgroundInput);
  backgroundRef.current = backgroundInput;

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
    const startRepeat = (id: string, fire: () => void) => {
      stopRepeat(id);
      fire();
      const r: { delay: number | null; interval: number | null } = { delay: null, interval: null };
      r.delay = window.setTimeout(() => {
        r.delay = null;
        r.interval = window.setInterval(fire, Math.max(40, cfgRef.current.repeatMs));
      }, Math.max(0, cfgRef.current.initialDelayMs));
      repeats.set(id, r);
    };
    const stopAll = () => {
      for (const id of [...repeats.keys()]) stopRepeat(id);
    };

    const fireButton = (button: GpButton) => {
      if (playerRef.current) {
        const key = PLAYER_BUTTON[button];
        if (key) synthKey(key);
        return;
      }
      const nav = NAV_BUTTON[button];
      if (nav) dispatchTvNav(nav);
    };

    const fireAxis = (axis: GpAxis, dir: "neg" | "pos") => {
      if (playerRef.current) {
        const key = PLAYER_AXIS[axis]?.[dir];
        if (key) synthKey(key);
        return;
      }
      const nav = NAV_AXIS[axis]?.[dir];
      if (nav) dispatchTvNav(nav);
    };

    const onButton = (button: GpButton, pressed: boolean) => {
      if (!pressed) {
        stopRepeat(`btn:${button}`);
        return;
      }
      const repeatable = playerRef.current
        ? PLAYER_REPEATABLE.has(button)
        : NAV_REPEATABLE.has(button);
      if (repeatable) startRepeat(`btn:${button}`, () => fireButton(button));
      else fireButton(button);
    };

    const onAxis = (axis: GpAxis, value: number) => {
      const mapped = playerRef.current ? PLAYER_AXIS[axis] : NAV_AXIS[axis];
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
      if (dir) startRepeat(`axis:${axis}`, () => fireAxis(axis, dir));
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
      inputAllowed: () => document.hasFocus() || backgroundRef.current,
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
