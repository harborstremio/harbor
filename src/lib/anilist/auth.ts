import {
  ANILIST_AUTHORIZE_URL,
  ANILIST_CLIENT_ID,
  ANILIST_CLIENT_SECRET,
  ANILIST_PIN_REDIRECT_URI,
  ANILIST_TOKEN_EXCHANGE_URL,
} from "./config";
import { fetchViewer } from "./queries";
import { setSession } from "./session";
import type { AnilistSession } from "./types";

const DEFAULT_TOKEN_TTL_SEC = 31536000;

export function buildAuthorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: ANILIST_CLIENT_ID,
    redirect_uri: ANILIST_PIN_REDIRECT_URI,
    response_type: "code",
  });
  return `${ANILIST_AUTHORIZE_URL}?${params.toString()}`;
}

export function extractAnilistCode(input: string): string {
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

export async function completeAuthorization(pastedCode: string): Promise<AnilistSession> {
  const code = extractAnilistCode(pastedCode);
  if (!code) throw new Error("Paste the code from AniList to continue");
  const accessToken = await exchangeCode(code);
  const viewer = await fetchViewer(accessToken);
  const now = Date.now();
  const session: AnilistSession = {
    accessToken,
    createdAt: now,
    expiresAt: now + DEFAULT_TOKEN_TTL_SEC * 1000,
    userId: viewer.id,
    userName: viewer.name,
    avatar: viewer.avatar,
  };
  setSession(session);
  return session;
}

async function exchangeCode(code: string): Promise<string> {
  const isTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
  const post = isTauri ? (await import("@tauri-apps/plugin-http")).fetch : fetch;
  const res = await post(ANILIST_TOKEN_EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: ANILIST_CLIENT_ID,
      client_secret: ANILIST_CLIENT_SECRET,
      redirect_uri: ANILIST_PIN_REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) throw new Error("AniList rejected that code. Authorize again and paste the newest one.");
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("AniList did not return a token. Try authorizing again.");
  return json.access_token;
}
