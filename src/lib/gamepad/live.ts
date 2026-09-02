import { useSyncExternalStore } from "react";
import type { GpAxis, GpButton } from "./protocol";

export type LiveGamepad = {
  buttons: Partial<Record<GpButton, boolean>>;
  axes: Record<GpAxis, number>;
  seq: number;
};

const EMPTY: LiveGamepad = { buttons: {}, axes: { lx: 0, ly: 0, rx: 0, ry: 0 }, seq: 0 };
let state: LiveGamepad = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function setLiveButton(button: GpButton, pressed: boolean): void {
  if (!!state.buttons[button] === pressed) return;
  state = { buttons: { ...state.buttons, [button]: pressed }, axes: state.axes, seq: state.seq + 1 };
  emit();
}

export function setLiveAxis(axis: GpAxis, value: number): void {
  const v = Math.max(-1, Math.min(1, value));
  if (Math.abs(state.axes[axis] - v) < 0.004) return;
  state = { buttons: state.buttons, axes: { ...state.axes, [axis]: v }, seq: state.seq + 1 };
  emit();
}

export function resetLiveGamepad(): void {
  if (state === EMPTY) return;
  state = { buttons: {}, axes: { lx: 0, ly: 0, rx: 0, ry: 0 }, seq: state.seq + 1 };
  emit();
}

export function subscribeLive(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function liveAxes(): LiveGamepad["axes"] {
  return state.axes;
}

export function useLiveButtons(): LiveGamepad["buttons"] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state.buttons,
    () => EMPTY.buttons,
  );
}

export function useLiveGamepad(): LiveGamepad {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
