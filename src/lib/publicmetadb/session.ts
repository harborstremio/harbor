import { activeProfileId, activeProfileIsPrimary } from "@/lib/active-profile-id";
import { getSecret, setSecret } from "@/lib/secret-store";
import type { PmdbSession } from "./types";

const BASE_KEY = "harbor.publicmetadb.session.v1";

function keyFor(): string {
  return `${BASE_KEY}.${activeProfileId()}`;
}

const subscribers = new Set<() => void>();
let cached: PmdbSession | null = null;
let loaded = false;

function read(): PmdbSession | null {
  try {
    const key = keyFor();
    let raw = getSecret(key);
    if (!raw) {
      const legacy = getSecret(BASE_KEY);
      if (legacy && activeProfileIsPrimary()) {
        setSecret(key, legacy);
        setSecret(BASE_KEY, null);
        raw = legacy;
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PmdbSession;
    if (typeof parsed?.apiKey !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function write(session: PmdbSession | null): void {
  try {
    if (session) setSecret(keyFor(), JSON.stringify(session));
    else setSecret(keyFor(), null);
  } catch {
    return;
  }
}

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  cached = read();
}

export function resetForProfile(): void {
  loaded = false;
  cached = null;
  for (const fn of subscribers) fn();
}

export function getSession(): PmdbSession | null {
  ensureLoaded();
  return cached;
}

export function setSession(session: PmdbSession | null): void {
  ensureLoaded();
  cached = session;
  write(session);
  for (const fn of subscribers) fn();
}

export function subscribeSession(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function updateSessionUsername(username: string): void {
  const current = getSession();
  if (!current) return;
  const trimmed = username.trim();
  const updated: PmdbSession = {
    ...current,
    username: trimmed || undefined,
  };
  setSession(updated);
}

export function isAuthenticated(): boolean {
  return !!getSession()?.apiKey;
}

