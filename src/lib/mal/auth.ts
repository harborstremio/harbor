import { MAL_AUTHORIZE_URL, MAL_CLIENT_ID, MAL_TOKEN_PROXY } from "./config";
import { getSession, setSession } from "./session";
import type { MalSession } from "./types";

function generateVerifier(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  let result = "";
  for (let i = 0; i < 64; i++) result += chars[array[i] % chars.length];
  return result;
}

let storedVerifier: string | null = null;

export function buildAuthorizeUrl(): string {
  if (!MAL_CLIENT_ID)
    throw new Error(
      "MAL_CLIENT_ID not configured. Set VITE_MAL_CLIENT_ID in your .env or register an app at https://myanimelist.net/apiconfig.",
    );
  const verifier = generateVerifier();
  storedVerifier = verifier;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: MAL_CLIENT_ID,
    code_challenge: verifier,
    code_challenge_method: "plain",
  });
  return `${MAL_AUTHORIZE_URL}?${params.toString()}`;
}

export function extractMalCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const fromUrl = /[?&#]code=([^&\s#]+)/.exec(trimmed);
  if (fromUrl) {
    try {
      return decodeURIComponent(fromUrl[1]).trim();
    } catch {
      return fromUrl[1].trim();
    }
  }
  return trimmed.replace(/^["'\s]+|["'\s]+$/g, "");
}

async function tauriFetch(input: string, init?: RequestInit): Promise<Response> {
  if ("__TAURI_INTERNALS__" in window) {
    const { fetch: tauriFetchFn } = await import("@tauri-apps/plugin-http");
    return tauriFetchFn(input, init as Record<string, unknown>) as unknown as Response;
  }
  return fetch(input, init);
}

export async function completeAuthorization(pastedCode: string): Promise<MalSession> {
  const code = extractMalCode(pastedCode);
  if (!code) throw new Error("Paste the code from MyAnimeList to continue");
  if (!storedVerifier) throw new Error("Session expired. Start over and authorize again.");
  const tokenData = await exchangeCode(code, storedVerifier);
  storedVerifier = null;

  const userName = await fetchUserName(tokenData.access_token);

  const now = Date.now();
  const session: MalSession = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    createdAt: now,
    expiresAt: now + tokenData.expires_in * 1000,
    userName,
  };
  setSession(session);
  return session;
}

async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await tauriFetch(MAL_TOKEN_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MAL rejected that code (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error("MAL did not return a token. Try authorizing again.");
  return json;
}

export async function refreshAccessToken(): Promise<MalSession | null> {
  const current = getSession();
  if (!current?.refreshToken) return null;
  try {
    const res = await tauriFetch(MAL_TOKEN_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: current.refreshToken,
      }),
    });
    if (!res.ok) {
      setSession(null);
      return null;
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    const now = Date.now();
    const next: MalSession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      createdAt: now,
      expiresAt: now + data.expires_in * 1000,
      userName: current.userName,
    };
    setSession(next);
    return next;
  } catch {
    if (!navigator.onLine) return null;
    setSession(null);
    return null;
  }
}

let inflightRefresh: Promise<MalSession | null> | null = null;

export function ensureRefreshed(): Promise<MalSession | null> {
  if (!inflightRefresh) {
    inflightRefresh = refreshAccessToken().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

async function fetchUserName(accessToken: string): Promise<string> {
  const res = await tauriFetch("https://api.myanimelist.net/v2/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "unknown";
  const json = await res.json();
  return json.name ?? "unknown";
}
