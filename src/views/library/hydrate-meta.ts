import { type Meta } from "@/lib/cinemeta";
import { lruSet } from "@/lib/cache";
import { resolveMeta } from "@/lib/meta-resource";
import { readLocalEntries } from "@/lib/watchlist";
import { readActiveStremioAuthKey } from "@/lib/auth";
import { addonBasesForOrigin, fetchAddonMeta, gatherCatalogAddons } from "@/lib/addons";

const metaHydrateCache = new Map<string, Promise<Meta | null>>();

export async function hydrateLibraryMeta(
  id: string,
  type: "movie" | "series",
  tmdbKey: string | null,
  origin?: Meta["addonOrigin"],
): Promise<Meta | null> {
  const cacheKey = `${type}:${id}:${origin?.id ?? ""}`;
  const cached = metaHydrateCache.get(cacheKey);
  if (cached) return cached;
  const authKey = (() => {
    try {
      return readActiveStremioAuthKey();
    } catch {
      return null;
    }
  })();
  const p = (async () => {
    if (origin) {
      const addons = await gatherCatalogAddons(authKey).catch(() => []);
      const bases = addonBasesForOrigin(addons, origin);
      for (const base of bases) {
        try {
          const addonMeta = await fetchAddonMeta(base, type, id);
          if (addonMeta) return addonMeta;
        } catch {
          /* try the next matching addon instance */
        }
      }
    }
    if (id.startsWith("tmdb:") && tmdbKey) {
      const isTv = id.startsWith("tmdb:tv:") || id.startsWith("tmdb:series:");
      const tmdbType = isTv ? "tv" : "movie";
      const tmdbId = id.replace(/^tmdb:(movie|tv|series):/, "");
      try {
        const r = await fetch(
          `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${tmdbKey}`,
        );
        if (r.ok) {
          const j = await r.json();
          return {
            id,
            type,
            name: j.title || j.name || "",
            poster: j.poster_path ? `https://image.tmdb.org/t/p/w342${j.poster_path}` : undefined,
            background: j.backdrop_path
              ? `https://image.tmdb.org/t/p/w780${j.backdrop_path}`
              : undefined,
            releaseInfo: (j.release_date || j.first_air_date)?.slice(0, 4),
          } as Meta;
        }
      } catch {
        /* fall through to addon resolve */
      }
    }
    return (await resolveMeta(authKey, type, id).catch(() => null)) ?? null;
  })();
  lruSet(metaHydrateCache, cacheKey, p, 400);
  return p;
}

export function loadLocalIds(): Set<string> {
  try {
    return new Set(readLocalEntries().map((e) => e.id));
  } catch {
    return new Set();
  }
}
