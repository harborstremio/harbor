import { safeFetch } from "@/lib/safe-fetch";
import { authToken } from "@/lib/theme-auth";
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

export async function pushNameToProfileAlias(name: string): Promise<void> {
  const alias = name.trim().slice(0, 32);
  if (!alias) return;
  const token = authToken();
  if (!token) return;
  try {
    await safeFetch(PROFILE_ENDPOINT, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ alias }),
    });
  } catch {
    void 0;
  }
}

export async function fetchProfileAlias(handle: string): Promise<string | null> {
  const token = authToken();
  if (!token || !handle) return null;
  try {
    const res = await safeFetch(`${SOCIAL_BASE}/u/${encodeURIComponent(handle)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { alias?: string };
    const alias = typeof d.alias === "string" ? d.alias.trim() : "";
    return alias || null;
  } catch {
    return null;
  }
}
