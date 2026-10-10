import { useSyncExternalStore } from "react";
import { setItemWithRecovery } from "@/lib/storage-recovery";

const KEY = "harbor.advisory.ignored.v1";
const ignored = new Set<string>();
const listeners = new Set<() => void>();

(() => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return;
    for (const entry of raw) if (typeof entry === "string" && entry) ignored.add(entry);
  } catch {}
})();

function persist(): void {
  try {
    setItemWithRecovery(KEY, JSON.stringify([...ignored]));
  } catch {}
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function isAdvisoryIgnored(titleId: string | null | undefined): boolean {
  return !!titleId && ignored.has(titleId);
}

export function ignoreAdvisory(titleId: string): void {
  if (!titleId || ignored.has(titleId)) return;
  ignored.add(titleId);
  persist();
  emit();
}

export function clearAdvisoryIgnores(): void {
  if (ignored.size === 0) return;
  ignored.clear();
  persist();
  emit();
}

export function advisoryIgnoreCount(): number {
  return ignored.size;
}

export function useAdvisoryIgnoreCount(): number {
  return useSyncExternalStore(subscribe, advisoryIgnoreCount, advisoryIgnoreCount);
}
