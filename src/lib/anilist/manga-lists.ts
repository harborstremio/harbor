import { AnilistApiError, anilistRequest } from "./client";
import type { AnilistListGroup, AnilistMediaEntry, MediaListStatus } from "./types";
import { validateAnilistSession } from "./validate";

const COLLECTION_QUERY = `query ($userId: Int) {
  MediaListCollection(userId: $userId, type: MANGA) {
    lists {
      status
      isCustomList
      entries {
        id
        status
        progress
        score
        media {
          id
          idMal
          title { romaji english native userPreferred }
          coverImage { extraLarge large medium }
          bannerImage
          format
          chapters
          averageScore
          seasonYear
        }
      }
    }
  }
}`;

type RawGroup = {
  status: MediaListStatus | null;
  isCustomList: boolean;
  entries: AnilistMediaEntry[];
};

type CollectionResponse = { MediaListCollection: { lists: RawGroup[] } | null };

const CACHE_PREFIX = "harbor.anilist.mangacollection.v1.";
const memCache = new Map<number, AnilistListGroup[]>();
const inflight = new Map<number, Promise<AnilistListGroup[]>>();

export function resetMangaForProfile() {
  memCache.clear();
  inflight.clear();
}

function cacheKey(userId: number): string {
  return CACHE_PREFIX + userId;
}

export function readCachedMangaCollection(userId: number): AnilistListGroup[] | null {
  const mem = memCache.get(userId);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { groups?: AnilistListGroup[] };
    if (!parsed || !Array.isArray(parsed.groups)) return null;
    memCache.set(userId, parsed.groups);
    return parsed.groups;
  } catch {
    return null;
  }
}

function writeCachedMangaCollection(userId: number, groups: AnilistListGroup[]): void {
  memCache.set(userId, groups);
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify({ at: Date.now(), groups }));
  } catch {}
}

function buildGroups(lists: RawGroup[]): AnilistListGroup[] {
  const byStatus = new Map<MediaListStatus, AnilistMediaEntry[]>();
  const seen = new Set<number>();
  for (const group of lists) {
    if (group.isCustomList || !group.status) continue;
    const bucket = byStatus.get(group.status) ?? [];
    for (const entry of group.entries) {
      if (seen.has(entry.media.id)) continue;
      seen.add(entry.media.id);
      bucket.push(entry);
    }
    byStatus.set(group.status, bucket);
  }
  return Array.from(byStatus.entries()).map(([status, entries]) => ({ status, entries }));
}

export async function fetchMangaListCollection(userId: number): Promise<AnilistListGroup[]> {
  const existing = inflight.get(userId);
  if (existing) return existing;
  const run = (async () => {
    const data = await anilistRequest<CollectionResponse>(COLLECTION_QUERY, { userId }).catch(
      (e) => {
        if (e instanceof AnilistApiError && e.status === 401) void validateAnilistSession();
        return null;
      },
    );
    if (data == null) {
      const cached = readCachedMangaCollection(userId);
      return cached ?? [];
    }
    const groups = buildGroups(data.MediaListCollection?.lists ?? []);
    writeCachedMangaCollection(userId, groups);
    return groups;
  })();
  inflight.set(userId, run);
  try {
    return await run;
  } finally {
    inflight.delete(userId);
  }
}
