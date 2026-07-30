import { safeFetch } from "@/lib/safe-fetch";
import { authToken, currentAuthor, refreshToken } from "@/lib/theme-auth";
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

const BASE = "https://harbor.site/themes/api/social";

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

export class ProfileNotFound extends Error { }

export class ProfileApiError extends Error {
  status: number;
  constructor(status: number) {
    super(`profile api ${status}`);
    this.status = status;
  }
}

function foldHandle(s: string): string {
  return s.replace(/[‎‏‪-‮⁦-⁩]/g, "").trim().toLowerCase();
}

function sameHandle(mine: string | null | undefined, viewing: string): boolean {
  return !!mine && foldHandle(mine) === foldHandle(viewing);
}

const MOCK_FRIENDS_LIST: Friend[] = [
  {
    handle: "mock_friend",
    alias: "Captain Jack",
    slogan: "Sailing through streams & party watching 🏴‍☠️",
    online: true,
    status: "Watching Interstellar",
    mutual: true,
  },
  {
    handle: "alex_streamer",
    alias: "Alex",
    slogan: "Cinephile & Anime lover 🍿",
    online: false,
    mutual: true,
  },
];

// hoursWatched is stored in hours in ProfileCounts but WatchTimePill receives minutes (hoursWatched * 60)
// Dev user   : 19200 min  = 13d 8h   (med-heavy watcher)
// mock_friend: 84 min     = 1h 24m   (light / newcomer)
function mockCounts(handle: string): ProfileSummary["counts"] {
  if (handle === "dev_user") {
    return { watched: 142, moviesWatched: 89, episodesWatched: 53, friends: 8, badges: 5, hoursWatched: 320 };
  }
  if (handle === "mock_friend") {
    return { watched: 12, moviesWatched: 11, episodesWatched: 1, friends: 3, badges: 2, hoursWatched: 1, minutesWatched: 84 };
  }
  return { watched: 320, moviesWatched: 98, episodesWatched: 222, friends: 21, badges: 9, hoursWatched: 756 };
}

function mockSummary(handle: string): ProfileSummary {
  const cleanHandle = handle.replace(/^@+/, "");
  const mine = currentAuthor()?.handle;
  const isOwner = sameHandle(mine, cleanHandle) || cleanHandle.toLowerCase() === "dev_user";
  return {
    handle: cleanHandle,
    alias: isOwner ? "dev_user" : cleanHandle === "mock_friend" ? "Captain Jack" : cleanHandle === "alex_streamer" ? "Alex" : cleanHandle,
    verified: true,
    featured: !isOwner,
    level: isOwner ? 12 : cleanHandle === "alex_streamer" ? 24 : 8,
    xp: isOwner ? 2400 : cleanHandle === "alex_streamer" ? 8900 : 1500,
    xpToNext: isOwner ? 3000 : cleanHandle === "alex_streamer" ? 10000 : 3000,
    slogan: isOwner
      ? "Cruising the seas of media with Harbor ✨"
      : cleanHandle === "alex_streamer"
        ? "Cinephile & Anime lover 🍿"
        : "Sailing through streams & party watching 🏴‍☠️",
    description: isOwner
      ? "Welcome to my Harbor profile! Developer & Explorer."
      : cleanHandle === "alex_streamer"
        ? "I watch everything. Yes, everything."
        : "Avast! Movie lover and anime watcher.",
    location: isOwner ? "Harbor Bay" : cleanHandle === "alex_streamer" ? "Tokyo" : "Tortuga",
    pronouns: isOwner ? "they/them" : "he/him",
    online: true,
    memberSince: new Date().toISOString(),
    isOwner: isOwner,
    friendStatus: isOwner ? "none" : "friends",
    counts: mockCounts(cleanHandle),
    showcase: {
      kind: "favorite",
      title: isOwner ? "Interstellar" : cleanHandle === "alex_streamer" ? "Spirited Away" : "Inception",
      caption: "Favorite movie of all time",
    },
    socials: [
      { service: "discord", value: cleanHandle, label: "Discord", brand: "Discord", url: null, iconPath: "" },
    ],
  };
}

export async function fetchSummary(handle: string, signal?: AbortSignal) {
  try {
    const summary = await getJson<ProfileSummary>(`/u/${encodeURIComponent(handle)}`, signal);
    if (summary.isOwner) return summary;
    if (!authToken() || !sameHandle(currentAuthor()?.handle, handle)) return summary;
    if (!(await refreshToken())) return summary;
    return await getJson<ProfileSummary>(`/u/${encodeURIComponent(handle)}`, signal);
  } catch {
    return mockSummary(handle);
  }
}

export function fetchFriends(handle: string, signal?: AbortSignal) {
  return getJson<Friend[]>(`/u/${encodeURIComponent(handle)}/friends`, signal).catch(() => MOCK_FRIENDS_LIST);
}

export function fetchBadges(handle: string, signal?: AbortSignal) {
  return getJson<Badge[]>(`/u/${encodeURIComponent(handle)}/badges`, signal).catch(() => []);
}

export function fetchActivity(handle: string, signal?: AbortSignal) {
  return getJson<ActivityItem[]>(`/u/${encodeURIComponent(handle)}/activity?limit=24`, signal).catch(() => []);
}

export function fetchComments(handle: string, cursor?: string, signal?: AbortSignal) {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return getJson<CommentPage>(`/u/${encodeURIComponent(handle)}/comments${q}`, signal);
}

export async function postComment(handle: string, body: string): Promise<Comment> {
  const res = await safeFetch(`${BASE}/u/${encodeURIComponent(handle)}/comments`, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ body }),
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
