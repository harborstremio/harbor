import { activeProfileId, activeProfileIsPrimary } from "@/lib/active-profile-id";
import { getSecret, setSecret } from "@/lib/secret-store";
import { clearPendingWatches } from "./pending-sync";
import type { SimklSession } from "./types";

const BASE_KEY = "harbor.simkl.session.v1";

function keyFor(): string {
  return `${BASE_KEY}.${activeProfileId()}`;
}

const subscribers = new Set<() => void>();
let cached: SimklSession | null = null;
let loaded = false;

function read(): SimklSession | null {
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
    const parsed = JSON.parse(raw) as SimklSession;
    if (typeof parsed?.accessToken !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function write(session: SimklSession | null): void {
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

export function getSession(): SimklSession | null {
  ensureLoaded();
  return cached;
}

export function setSession(session: SimklSession | null): void {
  ensureLoaded();
  if (!session || !cached || session.username !== cached.username) {
    clearPendingWatches();
  }
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

export function isAuthenticated(): boolean {
  return !!getSession();
}
