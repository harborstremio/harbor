import { fetchSummary, ProfileNotFound } from "@/views/profile/profile-api";
import { socialGet } from "./client";

export type UserHit = {
  handle: string;
  alias: string;
  avatarUrl?: string;
  verified?: boolean;
  online?: boolean;
};

type SearchResponse = { users?: UserHit[] } | UserHit[];

let endpointLive = true;

export async function searchUsers(query: string, signal?: AbortSignal): Promise<UserHit[]> {
  const q = query.trim();
  if (!q) return [];
  if (endpointLive) {
    try {
      const d = await socialGet<SearchResponse>(`/social/users/search?q=${encodeURIComponent(q)}`, signal);
      const hits = Array.isArray(d) ? d : d.users ?? [];
      return hits.map(normalize);
    } catch (err) {
      if (signal?.aborted) throw err;
      const status = (err as { status?: number }).status;
      if (status === 404 || status === 405) endpointLive = false;
    }
  }
  return resolveByHandle(q, signal);
}

async function resolveByHandle(q: string, signal?: AbortSignal): Promise<UserHit[]> {
  const handle = q.replace(/^@/, "").trim().toLowerCase();
  if (!handle) return [];
  try {
    const s = await fetchSummary(handle, signal);
    return [{ handle: s.handle, alias: s.alias, avatarUrl: s.avatarUrl, verified: s.verified, online: s.online }];
  } catch (err) {
    if (err instanceof ProfileNotFound) return [];
    throw err;
  }
}

function normalize(h: UserHit): UserHit {
  return {
    handle: h.handle,
    alias: h.alias || h.handle,
    avatarUrl: h.avatarUrl,
    verified: h.verified,
    online: h.online,
  };
}
