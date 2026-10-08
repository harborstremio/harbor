import { useSyncExternalStore } from "react";

/**
 * JL Media Vision account sign-in against the JL Vision Supabase project, over Supabase's REST
 * endpoints. App data lives in that project's `media` schema. The anon key is public by design;
 * row-level security decides what a signed-in user can read and write.
 */
const SUPABASE_URL = ((import.meta.env.VITE_JL_SUPABASE_URL as string | undefined) || "").replace(/\/+$/, "");
const ANON_KEY = (import.meta.env.VITE_JL_SUPABASE_ANON_KEY as string | undefined) || "";
const SESSION_KEY = "jl.account.session.v1";
// Refresh a little before expiry so a request never goes out with a token about to lapse.
const REFRESH_EARLY_S = 60;

export type JlSession = {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  userId: string;
  email: string | null;
};

export const jlAccountsConfigured = () => !!SUPABASE_URL && !!ANON_KEY;

const listeners = new Set<() => void>();
let cache: { raw: string | null; session: JlSession | null } | null = null;

function readSession(): JlSession | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SESSION_KEY);
  } catch {
    raw = null;
  }
  if (cache && cache.raw === raw) return cache.session;
  let session: JlSession | null = null;
  try {
    const v = raw ? (JSON.parse(raw) as Partial<JlSession>) : null;
    if (v && typeof v.accessToken === "string" && typeof v.refreshToken === "string" && typeof v.userId === "string") {
      session = {
        accessToken: v.accessToken,
        refreshToken: v.refreshToken,
        expiresAt: Number(v.expiresAt) || 0,
        userId: v.userId,
        email: typeof v.email === "string" ? v.email : null,
      };
    }
  } catch {
    session = null;
  }
  cache = { raw, session };
  return session;
}

function writeSession(session: JlSession | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: the session lasts until the app closes */
  }
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useJlSession(): JlSession | null {
  return useSyncExternalStore(subscribe, readSession, () => null);
}

export function currentJlSession(): JlSession | null {
  return readSession();
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id?: string; email?: string };
  error_description?: string;
  msg?: string;
};

function toSession(body: TokenResponse): JlSession | null {
  if (!body.access_token || !body.refresh_token || !body.user?.id) return null;
  const expiresAt = body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600);
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt,
    userId: body.user.id,
    email: body.user.email ?? null,
  };
}

async function tokenRequest(grant: "password" | "refresh_token", payload: Record<string, string>): Promise<JlSession> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  const session = res.ok ? toSession(body) : null;
  if (!session) throw new Error(body.error_description || body.msg || `Sign-in failed (${res.status})`);
  return session;
}

export async function signInJl(email: string, password: string): Promise<JlSession> {
  if (!jlAccountsConfigured()) throw new Error("JL accounts are not configured in this build.");
  const session = await tokenRequest("password", { email: email.trim(), password });
  writeSession(session);
  return session;
}

type SignUpResponse = TokenResponse & { id?: string; email?: string };

/**
 * Creates an account. Returns the session when the project signs new accounts in straight away,
 * or null when it first sends a confirmation email.
 */
export async function signUpJl(email: string, password: string): Promise<JlSession | null> {
  if (!jlAccountsConfigured()) throw new Error("JL accounts are not configured in this build.");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const body = (await res.json().catch(() => ({}))) as SignUpResponse;
  if (!res.ok) throw new Error(body.error_description || body.msg || `Sign-up failed (${res.status})`);
  const session = toSession(body);
  if (session) writeSession(session);
  return session;
}

/** Emails a password-reset link. */
export async function resetJlPassword(email: string): Promise<void> {
  if (!jlAccountsConfigured()) throw new Error("JL accounts are not configured in this build.");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
  });
  if (!res.ok) throw new Error(`Couldn't send the reset email (${res.status})`);
}

export async function signOutJl(): Promise<void> {
  const session = readSession();
  writeSession(null);
  if (!session || !jlAccountsConfigured()) return;
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.accessToken}` },
  }).catch(() => {});
}

let refreshing: Promise<JlSession | null> | null = null;

/** A session whose access token is valid now, refreshing it once if needed. Null when signed out. */
export async function freshJlSession(): Promise<JlSession | null> {
  const session = readSession();
  if (!session) return null;
  if (session.expiresAt - REFRESH_EARLY_S > Date.now() / 1000) return session;
  refreshing ??= tokenRequest("refresh_token", { refresh_token: session.refreshToken })
    .then((next) => {
      writeSession(next);
      return next;
    })
    .catch((e: unknown) => {
      // A rejected refresh token means the account signed out elsewhere or was removed.
      if (e instanceof Error && /invalid|revoked|not found/i.test(e.message)) writeSession(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** A PostgREST request against the account's `media` schema, as the signed-in user. */
export async function jlRest(path: string, init: RequestInit = {}): Promise<Response> {
  const session = await freshJlSession();
  if (!session) throw new Error("Not signed in");
  const headers = new Headers(init.headers);
  headers.set("apikey", ANON_KEY);
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  headers.set("Accept-Profile", "media");
  headers.set("Content-Profile", "media");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

/** Calls a `media` schema function as the signed-in user. */
export async function jlRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await jlRest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`JL request failed (${res.status})`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
