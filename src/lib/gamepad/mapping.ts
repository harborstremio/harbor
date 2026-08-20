import type { GpButton } from "./protocol";

export type NavAction = "up" | "down" | "left" | "right" | "select" | "back" | "home";
export type PlayerKey = { key: string; code: string };

export const NAV_BUTTON: Partial<Record<GpButton, NavAction>> = {
  dup: "up",
  ddown: "down",
  dleft: "left",
  dright: "right",
  east: "back",
  start: "home",
  guide: "home",
};

export const NAV_REPEATABLE = new Set<GpButton>(["dup", "ddown", "dleft", "dright"]);

const ARROW_LEFT: PlayerKey = { key: "ArrowLeft", code: "ArrowLeft" };
const ARROW_RIGHT: PlayerKey = { key: "ArrowRight", code: "ArrowRight" };
const ARROW_UP: PlayerKey = { key: "ArrowUp", code: "ArrowUp" };
const ARROW_DOWN: PlayerKey = { key: "ArrowDown", code: "ArrowDown" };

export const PLAYER_BUTTON: Partial<Record<GpButton, PlayerKey>> = {
  east: { key: "Escape", code: "Escape" },
  north: { key: "i", code: "KeyI" },
  lb: { key: "b", code: "KeyB" },
  rb: { key: "n", code: "KeyN" },
  lt: ARROW_LEFT,
  rt: ARROW_RIGHT,
  dleft: ARROW_LEFT,
  dright: ARROW_RIGHT,
  dup: ARROW_UP,
  ddown: ARROW_DOWN,
};

export const PLAYER_REPEATABLE = new Set<GpButton>(["dleft", "dright", "dup", "ddown"]);
