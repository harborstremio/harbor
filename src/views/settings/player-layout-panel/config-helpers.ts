import {
  CONTROL_META,
  PANELS,
  type PlayerChromeConfig,
  type PlayerControlConfig,
  type PlayerControlId,
  type PlayerSlot,
} from "@/lib/player-chrome";

import { SLOTS, visibleInSlot } from "./panel-utils";

export function moveControlSlot(config: PlayerChromeConfig, id: PlayerControlId, dir: -1 | 1): PlayerChromeConfig {
  const current = config.controls.find((c) => c.id === id);
  if (!current) return config;
  const cursor = SLOTS.indexOf(current.slot);
  if (cursor < 0) return config;
  const nextIndex = (cursor + dir + SLOTS.length) % SLOTS.length;
  const nextSlot: PlayerSlot = SLOTS[nextIndex];
  const trailingOrder = nextTrailingOrder(config, nextSlot);
  return {
    ...config,
    controls: config.controls.map((c) => (c.id === id ? { ...c, slot: nextSlot, order: trailingOrder } : c)),
  };
}

export function moveControlOrder(config: PlayerChromeConfig, id: PlayerControlId, dir: -1 | 1): PlayerChromeConfig {
  const peers = visibleInSlot(config, requireSlot(config, id));
  const idx = peers.findIndex((c) => c.id === id);
  if (idx < 0) return config;
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= peers.length) return config;
  const target = peers[swapIdx];
  const a = peers[idx].order;
  const b = target.order;
  return {
    ...config,
    controls: config.controls.map((c) => {
      if (c.id === id) return { ...c, order: b };
      if (c.id === target.id) return { ...c, order: a };
      return c;
    }),
  };
}

export function requireSlot(config: PlayerChromeConfig, id: PlayerControlId): PlayerSlot {
  const c = config.controls.find((x) => x.id === id);
  return c ? c.slot : CONTROL_META[id].defaultSlot;
}

export function nextTrailingOrder(config: PlayerChromeConfig, slot: PlayerSlot): number {
  const peers = config.controls.filter((c) => c.slot === slot);
  if (peers.length === 0) return 0;
  return Math.max(...peers.map((c) => c.order)) + 10;
}

export function sameConfig(a: PlayerChromeConfig, b: PlayerChromeConfig): boolean {
  if (a.options.timeFormat !== b.options.timeFormat) return false;
  if (a.options.volumeStyle !== b.options.volumeStyle) return false;
  if (a.controls.length !== b.controls.length) return false;
  const byId = new Map<PlayerControlId, PlayerControlConfig>();
  for (const c of b.controls) byId.set(c.id, c);
  for (const c of a.controls) {
    const m = byId.get(c.id);
    if (!m) return false;
    if (m.slot !== c.slot) return false;
    if (m.order !== c.order) return false;
    if (!!m.hidden !== !!c.hidden) return false;
    if ((m.variant ?? "auto") !== (c.variant ?? "auto")) return false;
  }
  const aIcons = a.customIcons ?? {};
  const bIcons = b.customIcons ?? {};
  const aKeys = Object.keys(aIcons);
  const bKeys = Object.keys(bIcons);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (aIcons[k as PlayerControlId] !== bIcons[k as PlayerControlId]) return false;
  }
  for (const pid of PANELS) {
    const ap = a.panels?.[pid];
    const bp = b.panels?.[pid];
    if ((ap?.corner ?? null) !== (bp?.corner ?? null)) return false;
    if (!!ap?.hidden !== !!bp?.hidden) return false;
  }
  return true;
}
