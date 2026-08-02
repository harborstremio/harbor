import { safeFetch } from "@/lib/safe-fetch";
import { authToken, currentAuthor, refreshToken } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import type {
  ActivityItem,
  Badge,
  Comment,
  CommentPage,
  Friend,
  ProfileSettingsInput,
  ProfileSummary,
  SocialEntry,
} from "./profile-types";

const BASE = `${HARBOR_API_BASE}/themes/api/social`;

function authHeaders(): Record<string, string> {
  const t = authToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res = await safeFetch(`${BASE}${path}`, { headers: authHeaders(), signal });
  if (res.status === 401 && (await refreshToken())) {
    res = await safeFetch(`${BASE}${path}`, { headers: authHeaders(), signal });
  }
  if (res.status === 404) throw new ProfileNotFound();
  if (!res.ok) throw new ProfileApiError(res.status);
  return (await res.json()) as T;
}

export class ProfileNotFound extends Error {}

export class ProfileApiError extends Error {
  status: number;
  constructor(status: number) {
    super(`profile api ${status}`);
    this.status = status;
  }
}

function foldHandle(s: string): string {
  return s
    .replace(/[‎‏‪-‮⁦-⁩]/g, "")
    .trim()
    .toLowerCase();
}

function sameHandle(mine: string | null | undefined, viewing: string): boolean {
  return !!mine && foldHandle(mine) === foldHandle(viewing);
}

export async function fetchSummary(handle: string, signal?: AbortSignal) {
  const summary = await getJson<ProfileSummary>(`/u/${encodeURIComponent(handle)}`, signal);
  if (summary.isOwner) return summary;
  if (!authToken() || !sameHandle(currentAuthor()?.handle, handle)) return summary;
  if (!(await refreshToken())) return summary;
  try {
    return await getJson<ProfileSummary>(`/u/${encodeURIComponent(handle)}`, signal);
  } catch {
    return summary;
  }
}

export function fetchFriends(handle: string, signal?: AbortSignal) {
  return getJson<Friend[]>(`/u/${encodeURIComponent(handle)}/friends`, signal).catch(
    () => [],
  );
}

export function fetchBadges(handle: string, signal?: AbortSignal) {
  return getJson<Badge[]>(`/u/${encodeURIComponent(handle)}/badges`, signal).catch(() => []);
}

export function fetchActivity(handle: string, signal?: AbortSignal) {
  return getJson<ActivityItem[]>(
    `/u/${encodeURIComponent(handle)}/activity?limit=24`,
    signal,
  ).catch(() => []);
}

export function fetchComments(handle: string, cursor?: string, signal?: AbortSignal) {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return getJson<CommentPage>(`/u/${encodeURIComponent(handle)}/comments${q}`, signal);
}

export async function postComment(
  handle: string,
  body: string,
  parentId?: string,
): Promise<Comment> {
  const res = await safeFetch(`${BASE}/u/${encodeURIComponent(handle)}/comments`, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify(parentId ? { body, parentId } : { body }),
  });
  if (res.status === 429) throw new ProfileApiError(429);
  if (!res.ok) throw new ProfileApiError(res.status);
  return (await res.json()) as Comment;
}

export async function deleteComment(handle: string, id: string): Promise<void> {
  const res = await safeFetch(
    `${BASE}/u/${encodeURIComponent(handle)}/comments/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: authHeaders() },
  );
  if (!res.ok) throw new ProfileApiError(res.status);
}

export async function setCommentLike(
  handle: string,
  id: string,
  liked: boolean,
): Promise<{ likeCount: number; liked: boolean }> {
  const res = await safeFetch(
    `${BASE}/u/${encodeURIComponent(handle)}/comments/${encodeURIComponent(id)}/like`,
    { method: liked ? "POST" : "DELETE", headers: authHeaders() },
  );
  if (!res.ok) throw new ProfileApiError(res.status);
  return (await res.json()) as { likeCount: number; liked: boolean };
}

export async function saveSettings(input: ProfileSettingsInput): Promise<ProfileSummary> {
  const res = await safeFetch(`${BASE}/me/profile`, {
    method: "PATCH",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ProfileApiError(res.status);
  return (await res.json()) as ProfileSummary;
}

export async function saveSlogan(slogan: string): Promise<ProfileSummary> {
  const res = await safeFetch(`${BASE}/me/profile`, {
    method: "PATCH",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ slogan }),
  });
  if (!res.ok) throw new ProfileApiError(res.status);
  return (await res.json()) as ProfileSummary;
}

export async function saveSocials(socials: SocialEntry[]): Promise<ProfileSummary> {
  const res = await safeFetch(`${BASE}/me/profile`, {
    method: "PATCH",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ socials }),
  });
  if (!res.ok) throw new ProfileApiError(res.status);
  return (await res.json()) as ProfileSummary;
}
