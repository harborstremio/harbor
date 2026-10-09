import { tmdbDefaultPoster } from "@/lib/providers/tmdb/tmdb-images";
import { loadStoredSettings } from "@/lib/settings/load";
import type { FeaturedList } from "./featured-lists";

async function defaultItemPoster(id: string, fallback: string, key: string): Promise<string> {
  if (!id.startsWith("tmdb:")) return fallback;
  const u = await tmdbDefaultPoster(key, id).catch(() => undefined);
  return u ?? fallback;
}

export async function bakeDefaultPosters(lists: FeaturedList[]): Promise<FeaturedList[]> {
  const key = loadStoredSettings().tmdbKey ?? "";
  if (!key) return lists;
  return Promise.all(
    lists.map(async (l) => ({
      ...l,
      items: await Promise.all(
        l.items.map(async (it) => ({ ...it, poster: await defaultItemPoster(it.id, it.poster, key) })),
      ),
    })),
  );
}
