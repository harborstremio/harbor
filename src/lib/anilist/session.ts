import { activeProfileId, activeProfileIsPrimary } from "@/lib/active-profile-id";

import type { AnilistSession } from "./types";

const BASE_KEY = "harbor.anilist.session.v1";

function keyFor(): string {
  return `${BASE_KEY}.${activeProfileId()}`;
}

const subscribers = new Set<() => void>();
let cached: AnilistSession | null = null;
let loaded = false;

function read(): AnilistSession | null {
  try {
    const key = keyFor();
    let raw = localStorage.getItem(key);
    if (!raw) {
      const legacy = localStorage.getItem(BASE_KEY);
      if (legacy && activeProfileIsPrimary()) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(BASE_KEY);
        raw = legacy;
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnilistSession;
    if (
      typeof parsed?.accessToken !== "string" ||
      typeof parsed?.createdAt !== "number" ||
      typeof parsed?.expiresAt !== "number" ||
      typeof parsed?.userId !== "number" ||
      typeof parsed?.userName !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function write(session: AnilistSession | null): void {
  try {
    if (session) localStorage.setItem(keyFor(), JSON.stringify(session));
    else localStorage.removeItem(keyFor());
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

export function getSession(): AnilistSession | null {
  ensureLoaded();
  return cached;
}

export function setSession(session: AnilistSession | null): void {
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
