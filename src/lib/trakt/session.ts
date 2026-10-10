import { activeProfileId, activeProfileIsPrimary } from "@/lib/active-profile-id";
import { getSecret, setSecret } from "@/lib/secret-store";
import { clearPendingStops } from "./pending-sync";
import { REFRESH_THRESHOLD_SEC } from "./config";
import type { TraktSession } from "./types";

const BASE_KEY = "harbor.trakt.session.v1";

function keyFor(): string {
  return `${BASE_KEY}.${activeProfileId()}`;
}

const subscribers = new Set<() => void>();
let cached: TraktSession | null = null;
let loaded = false;

function read(): TraktSession | null {
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
    if (raw) {
      const parsed = JSON.parse(raw) as TraktSession;
      if (
        typeof parsed?.accessToken === "string" &&
        typeof parsed?.refreshToken === "string" &&
        typeof parsed?.createdAt === "number" &&
        typeof parsed?.expiresIn === "number"
      ) {
        return parsed;
      }
    }
    const settingsRaw = activeProfileIsPrimary() ? localStorage.getItem("harbor.settings") : null;
    if (settingsRaw) {
      const s = JSON.parse(settingsRaw);
      if (
        typeof s?.traktAccessToken === "string" &&
        typeof s?.traktRefreshToken === "string" &&
        typeof s?.traktExpiresAt === "number"
      ) {
        const now = Date.now();
        const expiresInSec = Math.floor((s.traktExpiresAt - now) / 1000);
        const session: TraktSession = {
          accessToken: s.traktAccessToken,
          refreshToken: s.traktRefreshToken,
          createdAt: Math.floor(now / 1000),
          expiresIn: Math.max(0, expiresInSec),
          username: s.traktUsername ?? null,
        };
        if (session.expiresIn > 0) {
          write(session);
          return session;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function write(session: TraktSession | null): void {
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

export function getSession(): TraktSession | null {
  ensureLoaded();
  return cached;
}

export function setSession(session: TraktSession | null): void {
  ensureLoaded();
  if (!session || !cached || session.username !== cached.username) {
    clearPendingStops();
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
  const s = getSession();
  if (!s) return false;
  return Date.now() / 1000 < s.createdAt + s.expiresIn + REFRESH_THRESHOLD_SEC;
}

export function shouldRefresh(): boolean {
  const s = getSession();
  if (!s) return false;
  const expiresAt = s.createdAt + s.expiresIn;
  const now = Date.now() / 1000;
  return now > expiresAt - REFRESH_THRESHOLD_SEC;
}

export function isAccessTokenStillValid(): boolean {
  const s = getSession();
  if (!s) return false;
  return Date.now() / 1000 < s.createdAt + s.expiresIn;
}
