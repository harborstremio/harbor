import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import { safeFetch } from "@/lib/safe-fetch";

const API = `${HARBOR_API_BASE}/themes/api`;
const ORIGIN = HARBOR_API_BASE;
const LEGACY_SESSION_KEY = "harbor.theme-session";
const SESSION_PREFIX = "harbor.theme-session.";
const PROFILES_KEY = "harbor.profiles.v1";
const REPAIR_FLAG = "harbor.theme-session.repaired.v2";

function readProfilesRaw(): {
  profiles?: Array<{ id?: string; isPrimary?: boolean }>;
  activeId?: string;
} | null {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function activeProfileId(): string {
  const s = readProfilesRaw();
  if (s && typeof s.activeId === "string" && s.activeId) return s.activeId;
  const primary = s?.profiles?.find((p) => p?.isPrimary);
  return (primary && typeof primary.id === "string" && primary.id) || "";
}
function primaryProfileId(): string {
  const s = readProfilesRaw();
  const primary = s?.profiles?.find((p) => p?.isPrimary);
  return (primary && typeof primary.id === "string" && primary.id) || activeProfileId();
}
function sessionKey(): string {
  const id = activeProfileId();
  return id ? SESSION_PREFIX + id : LEGACY_SESSION_KEY;
}
function migrateLegacyGlobal(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_SESSION_KEY);
    if (!legacy) return;
    const pid = primaryProfileId();
    if (!pid) return;
    const perKey = SESSION_PREFIX + pid;
    if (!localStorage.getItem(perKey)) localStorage.setItem(perKey, legacy);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export type AuthorBadge = {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  order?: number;
};

export type Author = {
  id: string;
  username: string;
  avatar?: string | null;
  handle?: string | null;
  handleAuto?: boolean;
  handleChangeAvailableAt?: string | null;
  verified?: boolean;
  stremioLinked?: boolean;
  discordLinkMethod?: string | null;
  discordUsername?: string | null;
  badges?: AuthorBadge[];
};

export type RawUser = Author;

type Session = { token: string; refresh?: string | null; user: Author; refreshedAt?: number };

const subs = new Set<() => void>();

function absAvatar(p: unknown): string | null {
  if (typeof p !== "string" || !p) return null;
  return p.startsWith("http") ? p : `${ORIGIN}${p}`;
}

function toAuthor(u: RawUser): Author {
  return {
    id: u.id,
    username: u.username,
    avatar: absAvatar(u.avatar),
    handle: typeof u.handle === "string" ? u.handle : null,
    handleAuto: u.handleAuto === true,
    handleChangeAvailableAt:
      typeof u.handleChangeAvailableAt === "string" ? u.handleChangeAvailableAt : null,
    verified: u.verified === true,
    stremioLinked: u.stremioLinked === true,
    discordLinkMethod: typeof u.discordLinkMethod === "string" ? u.discordLinkMethod : null,
    discordUsername: typeof u.discordUsername === "string" ? u.discordUsername : null,
    badges: Array.isArray(u.badges) ? u.badges : [],
  };
}

function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (
      typeof s?.token !== "string" ||
      typeof s?.user?.id !== "string" ||
      typeof s?.user?.username !== "string"
    )
      return null;
    return {
      token: s.token,
      refresh: typeof s.refresh === "string" ? s.refresh : null,
      refreshedAt:
        typeof s.refreshedAt === "number" && Number.isFinite(s.refreshedAt) && s.refreshedAt > 0
          ? s.refreshedAt
          : undefined,
      user: toAuthor(s.user),
    };
  } catch {
    return null;
  }
}

function readSession(): Session | null {
  try {
    return parseSession(localStorage.getItem(sessionKey()));
  } catch {
    return null;
  }
}

function repairCopiedSessions(): void {
  try {
    if (localStorage.getItem(REPAIR_FLAG)) return;
    localStorage.setItem(REPAIR_FLAG, "1");
    const primary = primaryProfileId();
    if (!primary) return;
    const mine = parseSession(localStorage.getItem(SESSION_PREFIX + primary));
    if (!mine) return;
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(SESSION_PREFIX)) continue;
      if (k === SESSION_PREFIX + primary) continue;
      const other = parseSession(localStorage.getItem(k));
      if (other && other.user?.id && other.user.id === mine.user?.id) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

migrateLegacyGlobal();
repairCopiedSessions();
let loadedProfile = activeProfileId();
let session: Session | null = readSession();
let sessionGeneration = 0;

function setSession(next: Session | null): void {
  if (next?.user.id !== session?.user.id) sessionGeneration += 1;
  session = next;
  loadedProfile = activeProfileId();
  try {
    const key = sessionKey();
    if (next) localStorage.setItem(key, JSON.stringify(next));
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  for (const fn of subs) fn();
}

function reloadSession(): void {
  const id = activeProfileId();
  if (id === loadedProfile) return;
  sessionGeneration += 1;
  loadedProfile = id;
  migrateLegacyGlobal();
  session = readSession();
  for (const fn of subs) fn();
}

if (typeof window !== "undefined") {
  window.addEventListener("harbor:active-profile-changed", reloadSession);
  window.addEventListener("harbor:profiles-updated", reloadSession);
}

export function currentAuthor(): Author | null {
  return session ? session.user : null;
}

export function authToken(): string | null {
  return session ? session.token : null;
}

export function refreshTokenValue(): string | null {
  return session ? (session.refresh ?? null) : null;
}

export function applyAuthResult(d: {
  token: string;
  refresh?: string | null;
  user: RawUser;
}): void {
  sessionGeneration += 1;
  setSession({
    token: d.token,
    refresh:
      d.refresh ??
      (session?.token === d.token && session.user.id === d.user.id ? session.refresh : null),
    user: toAuthor(d.user),
    refreshedAt: Date.now(),
  });
}

export function applyServerUser(user: RawUser): void {
  if (!session || session.user.id !== user.id) return;
  setSession({ ...session, user: toAuthor(user) });
}

export function applyAvatarUrl(url: string | null): void {
  if (!session) return;
  setSession({ ...session, user: { ...session.user, avatar: url } });
}

// Token rotation preserves this scope; login, logout and profile switches invalidate it.
export function captureSessionScope(): () => boolean {
  reloadSession();
  const generation = sessionGeneration;
  const profile = loadedProfile;
  return () => generation === sessionGeneration && profile === activeProfileId();
}

const SESSION_REFRESH_MS = 6 * 60 * 60 * 1000;
type RefreshState = {
  refresh: string;
  promise?: Promise<boolean>;
  failures: number;
  retryAt: number;
  revokeOnComplete?: boolean;
};
const refreshes = new Map<string, RefreshState>();

export function sessionRefreshDelay(): number | null {
  reloadSession();
  if (!session?.refresh) return null;
  const state = refreshes.get(sessionKey());
  const retryAt = state?.refresh === session.refresh ? state.retryAt : 0;
  const due =
    state?.refresh === session.refresh && state.failures
      ? retryAt
      : session.refreshedAt
        ? session.refreshedAt + SESSION_REFRESH_MS
        : 0;
  return Math.min(SESSION_REFRESH_MS, Math.max(0, Math.max(due, retryAt) - Date.now()));
}

export async function refreshToken(rejectedToken?: string): Promise<boolean> {
  const isCurrent = captureSessionScope();
  const captured = session;
  if (!captured) return false;
  // Another request may already have renewed the token that received this 401.
  if (rejectedToken && captured.token !== rejectedToken) return true;
  const refresh = captured.refresh;
  if (!refresh) return false;
  const key = sessionKey();
  let state = refreshes.get(key);
  if (!state || state.refresh !== refresh) {
    state = { refresh, failures: 0, retryAt: 0 };
    refreshes.set(key, state);
  }
  if (state.promise) return (await state.promise) && isCurrent();
  if (Date.now() < state.retryAt) return false;
  const attempt = state;
  const matches = (value: Session | null) =>
    value?.user.id === captured.user.id &&
    value.token === captured.token &&
    value.refresh === refresh;
  const stored = () => {
    if (sessionKey() === key) return session;
    try {
      return parseSession(localStorage.getItem(key));
    } catch {
      return null;
    }
  };
  const save = (next: Session | null) => {
    if (sessionKey() === key) setSession(next);
    else {
      // Rotation consumes the old credential: retain it only in its unchanged origin profile.
      try {
        if (next) localStorage.setItem(key, JSON.stringify(next));
        else localStorage.removeItem(key);
      } catch {
        /* Storage may be unavailable. Never write into the active profile instead. */
      }
    }
  };
  attempt.promise = (async () => {
    try {
      const r = await safeFetch(`${API}/identity/api/token/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
        signal: AbortSignal.timeout(15_000),
      });
      const d = (await r.json().catch(() => null)) as {
        token?: unknown;
        refresh?: unknown;
        error?: unknown;
      } | null;
      if (attempt.revokeOnComplete) {
        if (r.ok && typeof d?.token === "string" && d.token) {
          await postAuth("logout", {}, d.token, AbortSignal.timeout(15_000)).catch(() => {});
        }
        return false;
      }
      const origin = stored();
      if (!matches(origin)) return false;
      // Only an explicit invalid-refresh response is evidence of an ended session.
      if (r.status === 401 && d?.error === "refresh_invalid") {
        save(null);
        return false;
      }
      if (
        !r.ok ||
        typeof d?.token !== "string" ||
        !d.token ||
        typeof d.refresh !== "string" ||
        !d.refresh
      )
        throw new Error("Refresh failed");
      save({ ...origin!, token: d.token, refresh: d.refresh, refreshedAt: Date.now() });
      return true;
    } catch {
      attempt.failures += 1;
      attempt.retryAt =
        Date.now() + Math.min(30_000 * 2 ** Math.min(attempt.failures - 1, 4), 300_000);
      return false;
    } finally {
      attempt.promise = undefined;
      // Requests can initiate refresh outside the background runner; reschedule its backoff too.
      for (const fn of subs) fn();
    }
  })();
  return (await attempt.promise) && isCurrent();
}

export function subscribeAuthor(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

async function postAuth(
  path: string,
  body: Record<string, unknown>,
  bearer?: string,
  signal?: AbortSignal,
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const r = await safeFetch(`${API}/auth/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}

export async function registerAuthor(
  username: string,
  password: string,
): Promise<{ recoveryCode: string }> {
  const isCurrent = captureSessionScope();
  const d = await postAuth("register", { username, password });
  if (!isCurrent()) throw new Error("Account changed");
  applyAuthResult(d);
  return { recoveryCode: d.recoveryCode };
}

export async function loginAuthor(username: string, password: string): Promise<void> {
  const isCurrent = captureSessionScope();
  const d = await postAuth("login", { username, password });
  if (!isCurrent()) throw new Error("Account changed");
  applyAuthResult(d);
}

export async function logoutAuthor(): Promise<void> {
  reloadSession();
  const token = authToken();
  const pending = refreshes.get(sessionKey());
  if (pending && pending.refresh === session?.refresh) pending.revokeOnComplete = true;
  refreshes.delete(sessionKey());
  sessionGeneration += 1;
  setSession(null);
  if (token) await postAuth("logout", {}, token, AbortSignal.timeout(15_000)).catch(() => {});
}

export async function recoverAuthor(
  username: string,
  recoveryCode: string,
  newPassword: string,
): Promise<{ recoveryCode: string }> {
  const isCurrent = captureSessionScope();
  const d = await postAuth("recover", { username, recoveryCode, newPassword });
  if (!isCurrent()) throw new Error("Account changed");
  applyAuthResult(d);
  return { recoveryCode: d.recoveryCode };
}

export async function changeAuthorPassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const token = authToken();
  if (!token) throw new Error("Sign in first.");
  await postAuth("change-password", { oldPassword, newPassword }, token);
}

export async function checkUsernameAvailable(
  username: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const r = await safeFetch(`${API}/auth/username-available?u=${encodeURIComponent(username)}`, {
    signal,
  });
  if (!r.ok) throw new Error("check failed");
  const d = await r.json();
  return d.available === true;
}
