import { useSyncExternalStore } from "react";
import { ALL_BADGE_KINDS, type BadgeKind } from "@/components/format-badge";
import { applyArtPack, setBadgeOverride } from "@/lib/stream-badges";

export type StreamBadgePack = { id: string; name: string; author?: string; kinds: string[] };

const KEY = "harbor.communitybadgepacks.v1";
const VALID = new Set<string>(ALL_BADGE_KINDS);

function load(): StreamBadgePack[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

let packs: StreamBadgePack[] = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(packs));
  } catch {
    /* quota: keep in memory */
  }
  emit();
}

export function installStreamBadgePack(pack: {
  id: string;
  name: string;
  author?: string;
  icons: { key: string; url: string }[];
}): number {
  const art: Partial<Record<BadgeKind, string>> = {};
  const kinds: string[] = [];
  for (const ic of pack.icons) {
    if (VALID.has(ic.key)) {
      art[ic.key as BadgeKind] = ic.url;
      kinds.push(ic.key);
    }
  }
  const n = applyArtPack(art);
  packs = [{ id: pack.id, name: pack.name, author: pack.author, kinds }, ...packs.filter((p) => p.id !== pack.id)];
  persist();
  return n;
}

export function removeStreamBadgePack(id: string): void {
  const p = packs.find((x) => x.id === id);
  if (p) for (const k of p.kinds) if (VALID.has(k)) setBadgeOverride(k as BadgeKind, null);
  packs = packs.filter((x) => x.id !== id);
  persist();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useStreamBadgePacks(): StreamBadgePack[] {
  return useSyncExternalStore(
    subscribe,
    () => packs,
    () => packs,
  );
}
