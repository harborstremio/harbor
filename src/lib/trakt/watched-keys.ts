import { getSession } from "./session";
import { activeProfileId } from "@/lib/active-profile-id";

function storageKey(): string {
  return `harbor.trakt.watched.v1.${activeProfileId()}`;
}

// Synchronous starting point for the first paint. The async pull still runs and replaces
// this, so a stale copy can only delay a card, never leave it permanently wrong.
export function peekTraktWatched(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  if (!getSession()) return new Set();
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey()) ?? "null");
    const saved = raw as { account?: string; at?: number; keys?: unknown } | null;
    if (
      !saved ||
      saved.account !== getSession()?.username ||
      !saved.account ||
      typeof saved.at !== "number" ||
      Date.now() - saved.at > 86400000 ||
      !Array.isArray(saved.keys)
    )
      return new Set();
    return new Set(saved.keys.filter((k): k is string => typeof k === "string"));
  } catch {
    return new Set();
  }
}

export function rememberTraktWatched(keys: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify({ account: getSession()?.username, at: Date.now(), keys: [...keys] }),
    );
  } catch {
    /* ignore quota */
  }
}
