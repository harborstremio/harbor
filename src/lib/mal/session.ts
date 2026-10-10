import { activeProfileId, activeProfileIsPrimary } from "@/lib/active-profile-id";
import { getSecret, setSecret } from "@/lib/secret-store";
import type { MalSession } from "./types";

const BASE_KEY = "harbor.mal.session.v1";

function keyFor(): string {
  return `${BASE_KEY}.${activeProfileId()}`;
}

const subscribers = new Set<() => void>();
let cached: MalSession | null = null;
let loaded = false;

function read(): MalSession | null {
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
    const parsed = JSON.parse(raw) as MalSession;
    if (
      typeof parsed?.accessToken !== "string" ||
      typeof parsed?.refreshToken !== "string" ||
      typeof parsed?.createdAt !== "number" ||
      typeof parsed?.expiresAt !== "number" ||
      typeof parsed?.userName !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function write(session: MalSession | null): void {
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

export function getSession(): MalSession | null {
  ensureLoaded();
  return cached;
}

export function setSession(session: MalSession | null): void {
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

export function isAuthenticated(): boolean {
  const s = getSession();
  if (!s) return false;
  return Date.now() < s.expiresAt;
}
