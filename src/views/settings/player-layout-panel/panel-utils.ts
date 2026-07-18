import type { PlayerChromeConfig, PlayerControlConfig, PlayerSlot } from "@/lib/player-chrome";

const SLOT_LIMITS: Record<PlayerSlot, number> = {
  "top-left": 3,
  "top-right": 4,
  "seek-leading": 2,
  "seek-trailing": 2,
  "bottom-left": 5,
  "bottom-center": 7,
  "bottom-right": 10,
};

export const SLOTS: PlayerSlot[] = [
  "top-left",
  "top-right",
  "seek-leading",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "seek-trailing",
];

export const SLOT_LABEL: Record<PlayerSlot, string> = {
  "top-left": "Top · left",
  "top-right": "Top · right",
  "seek-leading": "Above bar · left",
  "seek-trailing": "Above bar · right",
  "bottom-left": "Bottom · left",
  "bottom-center": "Bottom · center",
  "bottom-right": "Bottom · right",
};

export function slotLimit(slot: PlayerSlot): number {
  return SLOT_LIMITS[slot];
}

export function visibleInSlot(config: PlayerChromeConfig, slot: PlayerSlot): PlayerControlConfig[] {
  return config.controls
    .filter((c) => c.slot === slot)
    .slice()
    .sort((a, b) => a.order - b.order);
}
