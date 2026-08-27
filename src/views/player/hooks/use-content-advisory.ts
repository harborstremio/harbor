import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { fetchCsmAdvisory, type CsmCategory } from "@/lib/providers/csm";
import { get } from "@/lib/providers/tmdb/tmdb-client";
import { tmdbIdFromImdb, tmdbImdbId } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { loadStoredSettings } from "@/lib/settings/load";
import { safeFetch } from "@/lib/safe-fetch";

export type { CsmCategory as ParentalCategory };

type AdvisoryData = {
  categories: CsmCategory[];
  mpaRating: string | null;
};

const EMPTY: AdvisoryData = { categories: [], mpaRating: null };

type CertResult = {
  iso_3166_1?: string;
  rating?: string;
  release_dates?: { certification?: string }[];
};

/**
 * Fallback to official TMDb certification if CSM review is unavailable.
 */
async function tmdbCertification(meta: Meta, tt: string | null): Promise<string | null> {
  const key = loadStoredSettings().tmdbKey;
  if (!key) return null;

  let tmdbMetaId = meta.id.startsWith("tmdb:") ? meta.id : null;
  if (!tmdbMetaId && tt) {
    tmdbMetaId = await tmdbIdFromImdb(key, tt, meta.type === "movie" ? "movie" : "series");
  }
  const m = tmdbMetaId?.match(/^tmdb:(movie|tv):(\d+)$/);
  if (!m) return null;

  const [, kind, id] = m;
  const data = await get<{
    release_dates?: { results?: CertResult[] };
    content_ratings?: { results?: CertResult[] };
  }>(key, `${kind}/${id}`, {
    append_to_response: kind === "movie" ? "release_dates" : "content_ratings",
  });

  const us = (
    kind === "movie" ? data?.release_dates?.results : data?.content_ratings?.results
  )?.find((r) => r.iso_3166_1 === "US");

  if (!us) return null;
  if (kind === "movie") {
    return us.release_dates?.find((d) => d.certification)?.certification ?? null;
  }
  return us.rating ?? null;
}

/**
 * Resolve title name and release year from meta or Cinemeta catalog.
 */
async function resolveTitleAndYear(
  meta: Meta,
  tt: string | null,
): Promise<{ title: string; year: string | null; isMovie: boolean }> {
  const isMovie = meta.type === "movie";
  let title = meta.name ? meta.name.trim() : "";
  let year = meta.releaseInfo ?? meta.releaseDate ?? null;

  // If title looks like an ID (e.g. tt1234567) or is empty, resolve from Cinemeta
  if ((!title || title.startsWith("tt")) && tt) {
    try {
      const type = isMovie ? "movie" : "series";
      const res = await safeFetch(`https://v3-cinemeta.strem.io/meta/${type}/${tt}.json`);
      if (res.ok) {
        const j = (await res.json()) as {
          meta?: { name?: string; releaseInfo?: string; releaseDate?: string };
        };
        if (j.meta?.name) {
          title = j.meta.name.trim();
          year = j.meta.releaseInfo ?? j.meta.releaseDate ?? year;
        }
      }
    } catch {
      /* network error — proceed with best available */
    }
  }

  return { title, year, isMovie };
}

export function useContentAdvisory(
  enabled: boolean,
  ready: boolean,
  imdbId: string | null,
  srcKey: string,
  meta?: Meta | null,
): { categories: CsmCategory[]; playKey: string; mpaRating: string | null } {
  const [data, setData] = useState<AdvisoryData>(EMPTY);

  useEffect(() => {
    setData(EMPTY);
    if (!enabled || !ready || !meta) return;
    let cancelled = false;

    const load = async () => {
      // 1. Resolve tt ID if available
      let tt = imdbId?.match(/tt\d+/)?.[0] ?? meta.id.match(/tt\d+/)?.[0] ?? null;
      if (!tt && meta.id.startsWith("tmdb:")) {
        tt = await tmdbImdbId(loadStoredSettings().tmdbKey, meta.id);
      }

      // 2. Resolve title and year
      const { title, year, isMovie } = await resolveTitleAndYear(meta, tt);
      if (cancelled || !title) return;

      // 3. Fetch directly from Common Sense Media (CSM)
      const csm = await fetchCsmAdvisory(title, year, isMovie);
      if (cancelled) return;

      if (csm && (csm.categories.length > 0 || csm.badgeRating)) {
        setData({
          categories: csm.categories,
          mpaRating: csm.badgeRating,
        });
        return;
      }

      // 4. Fallback to TMDb official certification if CSM has no review
      const cert = await tmdbCertification(meta, tt);
      if (!cancelled && cert) {
        setData({ categories: [], mpaRating: cert });
      }
    };

    // Advisory lookups may try several public pages. Keep them outside the startup and
    // subtitle-discovery critical path, then begin only after the player is otherwise idle.
    const timer = window.setTimeout(() => {
      if (!cancelled) void load();
    }, 1_200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, ready, imdbId, srcKey, meta]);

  return { categories: data.categories, playKey: srcKey, mpaRating: data.mpaRating };
}
