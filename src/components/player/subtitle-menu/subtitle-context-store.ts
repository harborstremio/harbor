import { useSyncExternalStore } from "react";

export type SubtitleContentContext = {
  candidateIds: string[];
  stremioId: string | null;
};

let current: SubtitleContentContext | null = null;
const listeners = new Set<() => void>();

function same(a: SubtitleContentContext | null, b: SubtitleContentContext | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.stremioId === b.stremioId && a.candidateIds.join("|") === b.candidateIds.join("|");
}

export function publishSubtitleContext(ctx: SubtitleContentContext | null): void {
  if (same(current, ctx)) return;
  current = ctx;
  listeners.forEach((l) => l());
}

export function useSubtitleContext(): SubtitleContentContext | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}
