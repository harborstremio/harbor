import type { Meta } from "@/lib/cinemeta";
import { externalToKitsu } from "@/lib/providers/anime-mapping";
import { kitsuAnime } from "@/lib/providers/kitsu";
import { hydrateTraktItems } from "@/lib/trakt/hydrate";
import type { TraktItem } from "@/lib/trakt/types";

import { getLocalCache, type SimklCacheItem } from "../activities";
import { groupAnimeByFranchise, type AnimeFranchise } from "../anime-grouping";
import { simklRequest } from "../client";
import type { SimklItem } from "../types";

function toHydratable(items: SimklItem[]): TraktItem[] {
  return items.map((it) => ({
    type: it.type,
    title: it.title,
    year: it.year,
    ids: {
      imdb: it.ids.imdb,
      tmdb: typeof it.ids.tmdb === "number" ? it.ids.tmdb : undefined,
    },
  }));
}

function isAnimeItem(it: SimklItem): boolean {
  return it.ids.mal != null || it.ids.anidb != null;
}

async function hydrateSimklAnime(it: SimklItem): Promise<Meta | null> {
  const source = it.ids.mal != null ? "myanimelist" : "anidb";
  const ext = it.ids.mal ?? it.ids.anidb;
  if (ext == null) return null;
  const kitsuId = await externalToKitsu(source, ext).catch(() => null);
  if (kitsuId == null) return null;
  const d = await kitsuAnime(kitsuId).catch(() => null);
  if (!d || !d.poster) return null;
  return {
    id: `kitsu:${d.id}`,
    type: d.subtype === "movie" ? "movie" : "series",
    name: d.title,
    poster: d.poster,
    background: d.backdrop,
    description: d.synopsis,
    releaseInfo: d.year,
    imdbRating: d.rating,
  };
}

export async function hydrateSimklItems(items: SimklItem[], tmdbKey: string): Promise<Meta[]> {
  const metas = await Promise.all(
    items.map((it) =>
      isAnimeItem(it)
        ? hydrateSimklAnime(it).catch(() => null)
        : hydrateTraktItems(toHydratable([it]), tmdbKey)
            .then((r) => r[0] ?? null)
            .catch(() => null),
    ),
  );
  return metas.filter((m): m is Meta => !!m && !!m.poster);
}

export function groupSimklItemsByFranchise(items: SimklItem[]): AnimeFranchise[] {
  const cache = getLocalCache();
  const cacheLikeItems: SimklCacheItem[] = items.map((it): SimklCacheItem => {
    const simklId = it.ids.simkl;
    const cached = cache && simklId ? cache.items[String(simklId)] : null;
    return {
      simklId: simklId ?? 0,
      type: cached?.type ?? (it.type === "movie" ? "movie" : "anime"),
      title: it.title,
      year: it.year,
      status: cached?.status ?? "watching",
      userRating: cached?.userRating ?? null,
      watchedAt: cached?.watchedAt ?? null,
      watchedEpisodes: cached?.watchedEpisodes ?? [],
      poster: cached?.poster ?? null,
    };
  });
  return groupAnimeByFranchise(cacheLikeItems);
}

export async function hydrateSimklItemsFranchise(franchises: AnimeFranchise[]): Promise<Meta[]> {
  const metas = await Promise.all(
    franchises.map(async (f) => {
      const representative = (() => {
        const watching = f.items.filter((it) => it.status === "watching");
        if (watching.length > 0) {
          watching.sort((a, b) => {
            const tA = a.watchedAt ? new Date(a.watchedAt).getTime() : 0;
            const tB = b.watchedAt ? new Date(b.watchedAt).getTime() : 0;
            return tB - tA;
          });
          return watching[0];
        }
        return f.items[0];
      })();

      if (!representative || !representative.simklId) return null;

      let posterUrl: string | undefined = undefined;

      if (representative.poster) {
        posterUrl = `https://simkl.in/posters/${representative.poster}_m.jpg`;
      }

      if (!posterUrl) {
        const fallbackItem = f.items.find((it) => it.poster);
        if (fallbackItem?.poster) {
          posterUrl = `https://simkl.in/posters/${fallbackItem.poster}_m.jpg`;
        }
      }

      if (!posterUrl) {
        try {
          const detail = await simklRequest<{ title?: string; poster?: string; year?: number }>(
            `/anime/${representative.simklId}`,
            { method: "GET", authed: false },
          );
          if (detail?.poster) {
            posterUrl = `https://simkl.in/posters/${detail.poster}_m.jpg`;
          }
        } catch {}
      }

      if (!posterUrl && representative !== f.items[0] && f.items[0]?.simklId) {
        try {
          const detail = await simklRequest<{ title?: string; poster?: string; year?: number }>(
            `/anime/${f.items[0].simklId}`,
            { method: "GET", authed: false },
          );
          if (detail?.poster) {
            posterUrl = `https://simkl.in/posters/${detail.poster}_m.jpg`;
          }
        } catch {}
      }

      if (!posterUrl) return null;

      return {
        id: `simkl:${representative.simklId}`,
        type: "series" as const,
        name: f.name,
        poster: posterUrl,
        releaseInfo: f.yearStart ? String(f.yearStart) : undefined,
      } as Meta;
    }),
  );
  return metas.filter((m): m is Meta => !!m && !!m.poster);
}
