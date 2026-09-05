import { tvFocus } from "@/lib/keyboard-navigation";
import {
  findBest,
  getActiveModal,
  getFocusableInZone,
  navOwnsFocus,
  zoneOf,
} from "@/lib/keyboard-navigation/geometry";

export function ringActive(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && navOwnsFocus(el);
}

function neighbour(from: HTMLElement): HTMLElement | null {
  const all = getFocusableInZone(zoneOf(from), getActiveModal(from) ?? document);
  return findBest(from, all, "down") ?? findBest(from, all, "up");
}

export function handoffFocus(run: () => void, next?: HTMLElement | null): void {
  const from = document.activeElement;
  if (!(from instanceof HTMLElement) || !navOwnsFocus(from)) {
    run();
    return;
  }
  const target = next === undefined ? neighbour(from) : next;
  run();
  if (!target) return;
  requestAnimationFrame(() => {
    if (target.isConnected) tvFocus(target);
  });
}
