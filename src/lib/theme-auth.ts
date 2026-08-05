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
  badges?: AuthorBadge[];
};

export type RawUser = Author;

type Session = { token: string; refresh?: string | null; user: Author };

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

function setSession(next: Session | null): void {
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
  setSession({
    token: d.token,
    refresh: d.refresh ?? (session ? session.refresh : null),
    user: toAuthor(d.user),
  });
}

export function applyServerUser(user: RawUser): void {
  if (!session) return;
  setSession({ ...session, user: toAuthor(user) });
}

export function applyAvatarUrl(url: string | null): void {
  if (!session) return;
  setSession({ ...session, user: { ...session.user, avatar: url } });
}

export function applyTokens(token: string, refresh?: string | null): void {
  if (!session) return;
  setSession({ ...session, token, refresh: refresh ?? session.refresh });
}

let refreshing: Promise<boolean> | null = null;
export function refreshToken(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refresh = session?.refresh ?? null;
  if (!refresh) return Promise.resolve(false);
  refreshing = (async () => {
    try {
      const r = await safeFetch(`${API}/identity/api/token/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!r.ok) return false;
      const d = (await r.json().catch(() => null)) as { token?: unknown; refresh?: unknown } | null;
      if (d && typeof d.token === "string") {
        applyTokens(d.token, typeof d.refresh === "string" ? d.refresh : undefined);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export function subscribeAuthor(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

async function postAuth(path: string, body: Record<string, unknown>, bearer?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const r = await safeFetch(`${API}/auth/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}

export async function registerAuthor(
  username: string,
  password: string,
): Promise<{ recoveryCode: string }> {
  const d = await postAuth("register", { username, password });
  setSession({ token: d.token, user: toAuthor(d.user) });
  return { recoveryCode: d.recoveryCode };
}

export async function loginAuthor(username: string, password: string): Promise<void> {
  const d = await postAuth("login", { username, password });
  setSession({ token: d.token, user: toAuthor(d.user) });
}

export async function logoutAuthor(): Promise<void> {
  const token = authToken();
  if (token) await postAuth("logout", {}, token).catch(() => {});
  setSession(null);
}

export async function recoverAuthor(
  username: string,
  recoveryCode: string,
  newPassword: string,
): Promise<{ recoveryCode: string }> {
  const d = await postAuth("recover", { username, recoveryCode, newPassword });
  setSession({ token: d.token, user: toAuthor(d.user) });
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
