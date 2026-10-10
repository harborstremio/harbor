import { tmdbImdbCached, tmdbImdbId } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { loadStoredSettings } from "@/lib/settings/load";
import { ANIME_CLOUD_ID } from "@/lib/stremio";

export type CloudReach = "ok" | "anime-local-only" | "unresolved";

function tmdbKey(): string {
  try {
    return loadStoredSettings().tmdbKey ?? "";
  } catch {
    return "";
  }
}

export async function watchlistImdbId(
  id: string,
  hint?: string | null,
): Promise<string | null> {
  if (id.startsWith("tt")) return id;
  if (hint && hint.startsWith("tt")) return hint;
  if (ANIME_CLOUD_ID.test(id)) return null;
  if (!id.startsWith("tmdb:")) return null;
  const cached = tmdbImdbCached(id);
  if (cached !== undefined) return cached;
  const key = tmdbKey();
  if (!key) return null;
  return tmdbImdbId(key, id).catch(() => null);
}

export function cloudReachOf(id: string, writeId: string | null): CloudReach {
  if (writeId && writeId.startsWith("tt")) return "ok";
  if (ANIME_CLOUD_ID.test(id)) return "anime-local-only";
  return "unresolved";
}
