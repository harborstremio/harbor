import { useSyncExternalStore } from "react";
import { isSectionKey, registerSection } from "@/lib/profile-sync/sections";
import { flushSyncNow, markSectionDirty, requestSyncPull } from "@/lib/profile-sync/scheduler";
import { pushConfigToPairedHarbors } from "@/components/play-on-send";
import type { TvDoc, TvValue, TvWire } from "./model";

export type TvWireName = TvWire;

export type TvThemeDoc = {
  id: string;
  name: string;
  tokens: Record<string, string> | null;
};

export type TvBundle = {
  settings: TvDoc;
  playerlayout: TvDoc;
  theme: TvThemeDoc | null;
};

const LS = "harbor.tvsettings.v1.";
const EMPTY: TvBundle = { settings: {}, playerlayout: {}, theme: null };

const cache = new Map<string, TvBundle>();
const subs = new Set<() => void>();

const TV_WIRES: TvWire[] = ["settings", "theme", "playerlayout"];

export function tvSyncReady(): boolean {
  return tvWiresBlocked().length === 0;
}

function slot(profileId: string): string {
  return LS + (profileId || "default");
}

function coerceDoc(raw: unknown): TvDoc {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: TvDoc = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "boolean" || typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.every((e) => typeof e === "string")) out[k] = v as string[];
  }
  return out;
}

function coerceTheme(raw: unknown): TvThemeDoc | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== "string" || !t.id) return null;
  const tokens =
    t.tokens && typeof t.tokens === "object" && !Array.isArray(t.tokens)
      ? Object.fromEntries(
          Object.entries(t.tokens as Record<string, unknown>).filter(
            ([, v]) => typeof v === "string",
          ),
        )
      : null;
  return {
    id: t.id,
    name: typeof t.name === "string" ? t.name : t.id,
    tokens: tokens as Record<string, string> | null,
  };
}

function load(profileId: string): TvBundle {
  const held = cache.get(profileId);
  if (held) return held;
  let parsed: TvBundle = EMPTY;
  try {
    const raw = JSON.parse(localStorage.getItem(slot(profileId)) ?? "null");
    if (raw && typeof raw === "object") {
      parsed = {
        settings: coerceDoc((raw as Record<string, unknown>).settings),
        playerlayout: coerceDoc((raw as Record<string, unknown>).playerlayout),
        theme: coerceTheme((raw as Record<string, unknown>).theme),
      };
    }
  } catch {
    parsed = EMPTY;
  }
  cache.set(profileId, parsed);
  return parsed;
}

function commit(profileId: string, next: TvBundle): void {
  cache.set(profileId, next);
  try {
    localStorage.setItem(slot(profileId), JSON.stringify(next));
  } catch {}
  for (const fn of subs) fn();
}

function queue(wire: TvWire, profileId: string): void {
  if (!isSectionKey(wire)) return;
  markSectionDirty(wire, profileId);
  void pushConfigToPairedHarbors(load(profileId));
}

export function writeTvSettings(profileId: string, patch: TvDoc): void {
  const held = load(profileId);
  commit(profileId, { ...held, settings: { ...held.settings, ...patch } });
  queue("settings", profileId);
}

export function writeTvLayout(profileId: string, patch: TvDoc): void {
  const held = load(profileId);
  commit(profileId, { ...held, playerlayout: { ...held.playerlayout, ...patch } });
  queue("playerlayout", profileId);
}

export function writeTvTheme(profileId: string, theme: TvThemeDoc | null): void {
  const held = load(profileId);
  commit(profileId, { ...held, theme });
  queue("theme", profileId);
}

export function writeTvValue(
  profileId: string,
  wire: TvWire,
  key: string,
  value: TvValue,
): void {
  if (wire === "playerlayout") writeTvLayout(profileId, { [key]: value });
  else writeTvSettings(profileId, { [key]: value });
}

export function pushTvNow(): void {
  flushSyncNow();
}

export function pullTvNow(): void {
  requestSyncPull();
}

function subscribe(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function useTvBundle(profileId: string): TvBundle {
  return useSyncExternalStore(
    subscribe,
    () => load(profileId),
    () => EMPTY,
  );
}

function adapterFor(wire: TvWire) {
  return {
    read: (profileId: string): unknown => {
      const bundle = load(profileId);
      if (wire === "theme") return bundle.theme;
      return bundle[wire];
    },
    write: (profileId: string, value: unknown): boolean => {
      const held = load(profileId);
      if (wire === "theme") {
        const next = coerceTheme(value);
        if (!next) return false;
        cache.set(profileId, { ...held, theme: next });
      } else {
        const next = coerceDoc(value);
        if (Object.keys(next).length === 0) return false;
        cache.set(profileId, { ...held, [wire]: next });
      }
      try {
        localStorage.setItem(slot(profileId), JSON.stringify(cache.get(profileId)));
      } catch {}
      for (const fn of subs) fn();
      return true;
    },
  };
}

const health = new Map<TvWire, boolean>();

export function tvWiresBlocked(): TvWire[] {
  return TV_WIRES.filter((w) => health.get(w) !== true);
}

let registered = false;

export function registerTvSyncSections(): TvWire[] {
  if (registered) return tvWiresBlocked();
  registered = true;
  for (const wire of TV_WIRES) {
    health.set(wire, registerSection(wire, adapterFor(wire)));
  }
  const blocked = tvWiresBlocked();
  if (blocked.length > 0) {
    console.error(
      `[tv-panel] sync sections rejected: ${blocked.join(", ")}. ` +
        "Add them to PROFILE_SECTIONS in src/lib/profile-sync/types.ts. " +
        "Until then nothing on the TV Settings page reaches the TV.",
    );
  }
  return blocked;
}

registerTvSyncSections();
