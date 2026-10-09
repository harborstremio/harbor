import { useSyncExternalStore } from "react";
import type { SteamUpdateState } from "./installed";
import type { QuickGame } from "./quick-library";
import type { UnifiedState } from "./unified-library";

export const LIBRARY_BADGES = ["downloading", "paused", "validating", "repair", "majorUpdate", "updateQueued", "uninstalling", "needsSetup", "unavailable", "notInstalled"] as const;
export type LibraryBadge = typeof LIBRARY_BADGES[number];
export type LibraryBadgeTone = "active" | "pending" | "attention" | "quiet";
export type LibraryBadgeInfo = { badge: LibraryBadge; tone: LibraryBadgeTone; progress: number | null };

/** A download this size is worth naming before someone starts it on a metered line. */
export const MAJOR_UPDATE_BYTES = 2 * 1024 ** 3;

const TONES: Record<LibraryBadge, LibraryBadgeTone> = {
  downloading: "active", paused: "pending", validating: "active", repair: "attention",
  majorUpdate: "pending", updateQueued: "pending", uninstalling: "attention",
  needsSetup: "attention", unavailable: "attention", notInstalled: "quiet",
};
export const libraryBadgeTone = (badge: LibraryBadge) => TONES[badge];

export type LibraryBadgeInput = { state: UnifiedState; update?: SteamUpdateState; bytesToDownload?: number; bytesDownloaded?: number };

const remaining = (input: LibraryBadgeInput) => Math.max(0, (input.bytesToDownload ?? 0) - (input.bytesDownloaded ?? 0));
function share(input: LibraryBadgeInput): number | null {
  const total = input.bytesToDownload ?? 0;
  if (total <= 0) return null;
  return Math.min(1, Math.max(0, (input.bytesDownloaded ?? 0) / total));
}

/** Reports what the provider says, never a guess: an unreported lane produces no badge. */
export function libraryBadge(input: LibraryBadgeInput): LibraryBadgeInfo | null {
  const named = (badge: LibraryBadge, progress: number | null = null): LibraryBadgeInfo => ({ badge, tone: TONES[badge], progress });
  switch (input.update) {
    case "downloading": return named("downloading", share(input));
    case "paused": return named("paused", share(input));
    case "validating": return named("validating", share(input));
    case "repair": return named("repair");
    case "uninstalling": return named("uninstalling");
    case "queued": return named(remaining(input) >= MAJOR_UPDATE_BYTES ? "majorUpdate" : "updateQueued");
    default: break;
  }
  if (input.state === "updating") return named("downloading", share(input));
  if (input.state === "setup") return named("needsSetup");
  if (input.state === "unavailable") return named("unavailable");
  if (input.state === "notInstalled") return named("notInstalled");
  return null;
}

export type LibraryBadgeChoices = Record<LibraryBadge, boolean>;
// Most of a Steam library is simply not installed; saying so on every row is noise.
export const defaultLibraryBadges = (): LibraryBadgeChoices =>
  Object.fromEntries(LIBRARY_BADGES.map(badge => [badge, badge !== "notInstalled"])) as LibraryBadgeChoices;

const STORE = "harbor.games.library-badges.v1";
export const LIBRARY_BADGES_CHANGED = "harbor:library-badges-changed";

export function parseLibraryBadges(raw: string | null): LibraryBadgeChoices {
  const choices = defaultLibraryBadges();
  if (!raw) return choices;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return choices;
    for (const badge of LIBRARY_BADGES) {
      const saved = (value as Record<string, unknown>)[badge];
      if (typeof saved === "boolean") choices[badge] = saved;
    }
  } catch { /* A corrupt choice set falls back to the defaults. */ }
  return choices;
}

export function readLibraryBadges(): LibraryBadgeChoices {
  try { return parseLibraryBadges(localStorage.getItem(STORE)); } catch { return defaultLibraryBadges(); }
}

export function writeLibraryBadges(choices: LibraryBadgeChoices): void {
  try { localStorage.setItem(STORE, JSON.stringify(choices)); } catch { /* Storage may be full; the session keeps the choice. */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LIBRARY_BADGES_CHANGED));
}

/** The sidebar's lighter game shape, mapped onto the same lanes the unified view reports. */
export function quickGameBadge(game: QuickGame): LibraryBadgeInfo | null {
  if (game.source === "shortcut") return libraryBadge({ state: game.shortcut.state === "missing" ? "unavailable" : game.ready ? "ready" : "setup" });
  if (game.source === "steam") {
    const state: UnifiedState = game.install.state === "missing" ? "unavailable" : game.install.state === "updating" ? "updating" : "ready";
    return libraryBadge({ state, update: game.install.update, bytesToDownload: game.install.bytesToDownload, bytesDownloaded: game.install.bytesDownloaded });
  }
  if (game.source === "launcher") return libraryBadge({ state: game.install.state === "missing" ? "unavailable" : game.ready ? "ready" : "setup" });
  if (game.source === "retro") return libraryBadge({ state: game.local.available ? "ready" : "unavailable" });
  if (game.source === "custom") return libraryBadge({ state: game.ready ? "ready" : "setup" });
  return libraryBadge({ state: "notInstalled" });
}

let held: LibraryBadgeChoices | null = null;
const listeners = new Set<() => void>();
const snapshot = () => (held ??= readLibraryBadges());
export function setLibraryBadge(badge: LibraryBadge, shown: boolean): void {
  held = { ...snapshot(), [badge]: shown };
  writeLibraryBadges(held);
  for (const listener of listeners) listener();
}
export function useLibraryBadges(): LibraryBadgeChoices {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    const refresh = () => { held = readLibraryBadges(); listener(); };
    window.addEventListener(LIBRARY_BADGES_CHANGED, refresh);
    return () => { listeners.delete(listener); window.removeEventListener(LIBRARY_BADGES_CHANGED, refresh); };
  }, snapshot, defaultLibraryBadges);
}
