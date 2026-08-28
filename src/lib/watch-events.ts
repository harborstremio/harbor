const KEY_PREFIX = "harbor.watchevents.v1.";
const LEGACY_KEY = "harbor.watchevents.v1";
const PROFILES_KEY = "harbor.profiles.v1";
const MAX = 40;
const subs = new Set<() => void>();

export type WatchEvent = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  season?: number;
  episode?: number;
  at: number;
};

function activeProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return "";
    const s = JSON.parse(raw) as {
      activeId?: string;
      profiles?: Array<{ id?: string; isPrimary?: boolean; shareStremioWith?: string | null }>;
    };
    const profiles = Array.isArray(s.profiles) ? s.profiles : [];
    const active = profiles.find((p) => p.id === s.activeId) ?? null;
    const own = active?.id ?? profiles.find((p) => p?.isPrimary)?.id ?? "";
    if (!own) return "";
    if (active && typeof active.shareStremioWith === "string" && active.shareStremioWith) {
      const shared = profiles.find((p) => p.id === active.shareStremioWith);
      if (shared?.id) return shared.id;
    }
    return own;
  } catch {
    return "";
  }
}

function primaryProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const s = raw
      ? (JSON.parse(raw) as { profiles?: Array<{ id?: string; isPrimary?: boolean }> })
      : null;
    const primary = s?.profiles?.find((p) => p?.isPrimary);
    return (primary && typeof primary.id === "string" && primary.id) || activeProfileId();
  } catch {
    return activeProfileId();
  }
}

function storeKey(): string {
  const id = activeProfileId();
  return id ? KEY_PREFIX + id : LEGACY_KEY;
}

function migrateLegacy(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const pid = primaryProfileId();
    if (!pid) return;
    const perKey = KEY_PREFIX + pid;
    if (!localStorage.getItem(perKey)) localStorage.setItem(perKey, legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* noop */
  }
}

function load(): WatchEvent[] {
  migrateLegacy();
  try {
    const raw = localStorage.getItem(storeKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WatchEvent[]) : [];
  } catch {
    return [];
  }
}

export function listWatchEvents(): WatchEvent[] {
  return load();
}

export function recordWatchEvent(e: WatchEvent): void {
  if (!e.id || !e.name) return;
  const key = `${e.id}|${e.season ?? ""}|${e.episode ?? ""}`;
  const next = [e, ...load().filter((p) => `${p.id}|${p.season ?? ""}|${p.episode ?? ""}` !== key)];
  try {
    localStorage.setItem(storeKey(), JSON.stringify(next.slice(0, MAX)));
  } catch {
    return;
  }
  subs.forEach((fn) => fn());
}

export function subscribeWatchEvents(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
