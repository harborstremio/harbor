import type { LocalProfileLike, RosterApply, RosterStore } from "./types";

const PROFILES_KEY = "harbor.profiles.v1";

/**
 * Reading harbor.profiles.v1 raw is the same idiom theme-auth.ts and active-profile-id.ts
 * already use and is harmless. WRITING it from outside ProfilesProvider is not: the
 * provider persists its own state on every change and never reads the key back, so an
 * external write is silently clobbered on the next render. The apply path is therefore
 * injected by profiles.tsx and stays inert until that one line lands. rosterWired() is
 * false until then, and the engine reports it rather than pretending the roster synced.
 */
let store: RosterStore | null = null;

export function configureRosterStore(next: RosterStore | null): void {
  store = next;
}

export function rosterWired(): boolean {
  return store != null;
}

export function readLocalRoster(): LocalProfileLike[] {
  if (store) return store.read();
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { profiles?: unknown };
    if (!Array.isArray(parsed.profiles)) return [];
    const out: LocalProfileLike[] = [];
    for (const entry of parsed.profiles) {
      const p = entry as Record<string, unknown>;
      if (typeof p?.id !== "string" || typeof p?.name !== "string") continue;
      out.push({
        id: p.id,
        name: p.name,
        avatar: typeof p.avatar === "string" ? p.avatar : null,
        color: typeof p.color === "string" ? p.color : "",
        isPrimary: p.isPrimary === true,
        kid: readKid(p.kid),
        hideContent: p.hideContent ?? null,
        lockedTabs: p.lockedTabs ?? null,
        settingsLinked: p.settingsLinked !== false,
        createdAt: typeof p.createdAt === "number" ? p.createdAt : 0,
        bootstrap: typeof p.bootstrap === "boolean" ? p.bootstrap : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function readKid(raw: unknown): LocalProfileLike["kid"] {
  if (!raw || typeof raw !== "object") return null;
  const k = raw as Record<string, unknown>;
  return {
    age: typeof k.age === "number" ? k.age : 7,
    curfewMinutes: typeof k.curfewMinutes === "number" ? k.curfewMinutes : null,
    parentPinHash: typeof k.parentPinHash === "string" ? k.parentPinHash : null,
  };
}

export function applyRoster(apply: RosterApply): boolean {
  if (!store) return false;
  store.apply(apply);
  return true;
}
