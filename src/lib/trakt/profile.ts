import { traktRequest } from "./client";

type TraktProfile = {
  username?: string;
  name?: string | null;
  images?: {
    avatar?: { full?: string | null };
  };
};

export function normalizeAvatarUrl(raw: string | null | undefined): string | null {
  const url = raw?.trim();
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  if (url.startsWith("https://") || url.startsWith("data:image/")) return url;
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(url)) return `https://${url}`;
  return null;
}

export async function fetchTraktAvatar(): Promise<string | null> {
  try {
    const profile = await traktRequest<TraktProfile>("/users/me?extended=full");
    return normalizeAvatarUrl(profile.images?.avatar?.full);
  } catch {
    return null;
  }
}
