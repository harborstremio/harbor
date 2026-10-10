import { useSyncExternalStore } from "react";
import type { StoreTab } from "./custom-themes-section/community-store/store-tabs";

export type LibraryTab = "library" | "community" | "mine";
export type LibraryRequest = { tab: LibraryTab; storeTab?: StoreTab };

let open = false;
let pending: LibraryRequest | null = null;
const subs = new Set<() => void>();
const reqSubs = new Set<() => void>();

export function setThemeLibraryOpen(v: boolean): void {
  if (open === v) return;
  open = v;
  for (const f of subs) f();
}

export function requestThemeLibrary(req: LibraryRequest): void {
  pending = req;
  for (const f of reqSubs) f();
}

export function consumeThemeLibraryRequest(): LibraryRequest | null {
  const r = pending;
  pending = null;
  return r;
}

export function subscribeThemeLibraryRequest(fn: () => void): () => void {
  reqSubs.add(fn);
  return () => reqSubs.delete(fn);
}

export function useThemeLibraryOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => open,
    () => open,
  );
}
