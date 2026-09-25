import { activeProfileId } from "@/lib/active-profile-id";

function storageKey(): string {
  return `harbor.trakt.watched.v1.${activeProfileId()}`;
}

// Synchronous starting point for the first paint. The async pull still runs and replaces
// this, so a stale copy can only delay a card, never leave it permanently wrong.
export function peekTraktWatched(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey()) ?? "null");
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.filter((k): k is string => typeof k === "string"));
  } catch {
    return new Set();
  }
}

export function rememberTraktWatched(keys: Set<string>): void {
  // An empty result is a failed or not-yet-loaded pull, not "you watched nothing";
  // writing it would wipe a good cache and silently disable the peek.
  if (keys.size === 0) return;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify([...keys]));
  } catch {
    /* ignore quota */
  }
}
