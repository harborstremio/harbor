import { authenticatedFetch } from "./authenticated-fetch";
import { authToken, currentAuthor } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const SOCIAL_BASE = `${HARBOR_API_BASE}/themes/api/social`;
const PROFILE_ENDPOINT = `${SOCIAL_BASE}/me/profile`;

export function nameEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim() === (b ?? "").trim();
}

export function isPlaceholderName(name: string | null | undefined): boolean {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return true;
  return /^Guest \d+$/.test(trimmed);
}

async function profileRequest(
  url: string,
  init: RequestInit,
  accountId?: string,
): Promise<Response> {
  const send = () => {
    // A queued save or token refresh must never write into a different account.
    if (accountId && currentAuthor()?.id !== accountId) throw new Error("Account changed");
    const token = authToken();
    if (!token) throw new Error("Sign in required");
    return authenticatedFetch(url, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: { ...init.headers, authorization: `Bearer ${token}` },
    });
  };
  const response = await send();
  if (!response.ok) throw new Error(`Profile request failed (${response.status})`);
  return response;
}

export async function pushNameToProfileAlias(name: string, accountId?: string): Promise<void> {
  const alias = name.trim().slice(0, 32);
  if (!alias) return;
  await profileRequest(
    PROFILE_ENDPOINT,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias }),
    },
    accountId,
  );
}

export async function fetchProfileAlias(
  handle: string,
  accountId?: string,
): Promise<string | null> {
  if (!handle) return null;
  const res = await profileRequest(`${SOCIAL_BASE}/u/${encodeURIComponent(handle)}`, {}, accountId);
  const d = (await res.json()) as { alias?: string };
  const alias = typeof d.alias === "string" ? d.alias.trim() : "";
  return alias || null;
}
