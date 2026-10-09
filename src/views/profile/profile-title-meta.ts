import { lruSet } from "@/lib/cache";
import { get } from "@/lib/providers/tmdb/tmdb-client";
import { tmdbIdFromImdb } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { tmdbLocalizedPoster } from "@/lib/providers/tmdb/tmdb-images";

type TitleMetadata = {
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  original_language?: string;
};

const metadata = new Map<string, TitleMetadata>();

export function profileTitleId(id?: string, mediaType?: string): string | undefined {
  if (mediaType && !["movie", "series", "tv", "anime"].includes(mediaType)) return;
  const tmdb = id?.match(/^tmdb:(movie|tv|series):(\d+)$/);
  if (tmdb) return `tmdb:${tmdb[1] === "series" ? "tv" : tmdb[1]}:${tmdb[2]}`;
  // Episode activity can carry an IMDb video ID; localize the parent title.
  return id?.match(/^(?:imdb:)?(tt\d+)(?::\d+:\d+)?$/)?.[1];
}

export async function profileTitleMeta(
  key: string,
  id: string,
  language: string,
  translateTitles: boolean,
): Promise<{ title?: string; poster?: string }> {
  const tmdbId = id.startsWith("tmdb:") ? id : await tmdbIdFromImdb(key, id);
  const match = tmdbId?.match(/^tmdb:(movie|tv):(\d+)$/);
  if (!tmdbId || !match) return {};
  const cacheKey = `${key}|${tmdbId}|${language}`;
  let raw = metadata.get(cacheKey);
  if (!raw) {
    raw = (await get<TitleMetadata>(key, `${match[1]}/${match[2]}`, { language })) ?? undefined;
    if (raw) lruSet(metadata, cacheKey, raw, 300);
  }
  const title = translateTitles
    ? raw?.title || raw?.name
    : raw?.original_title || raw?.original_name || raw?.title || raw?.name;
  const poster = await tmdbLocalizedPoster(key, tmdbId, raw?.original_language).catch(() => undefined);
  return { title: title?.trim() || undefined, poster };
}
