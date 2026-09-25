import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { resolveHeroArt } from "@/lib/anime-backdrop";
import type { Meta } from "@/lib/cinemeta";
import { resolveLogo } from "@/lib/logo";
import { resolveMeta } from "@/lib/meta-resource";
import { peekAnimeArt } from "@/lib/providers/anime-art-cache";
import { tmdbIdFromImdb, tmdbImdbId, type Season } from "@/lib/providers/tmdb";
import { get, effectiveTmdbLanguage } from "@/lib/providers/tmdb/tmdb-client";
import { tmdbBackdropUrl } from "@/lib/providers/tmdb/tmdb-image-rungs";
import { isAnimeId } from "@/lib/series-episodes";
import { useSettings } from "@/lib/settings";
import { useTitleBackdrop } from "@/lib/title-backdrop";
import { useTitleLogo } from "@/lib/title-logo";
import { useStableAsset } from "@/lib/use-stable-asset";

type TitleHeader = {
  name?: string;
  title?: string;
  original_language?: string;
  backdrop_path?: string;
  seasons?: Array<{
    id: number;
    season_number: number;
    name: string;
    episode_count: number;
    air_date?: string;
  }>;
};
type Resolved = { meta: Meta; tmdbId?: string; imdbId: string | null; seasons?: Season[] };

/** Same artwork resolvers/overrides as title surfaces, without credits, trailers or recommendations. */
export function useDownloadTitle(meta: Meta, isCurrent: () => boolean) {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const guard = useRef(isCurrent);
  guard.current = isCurrent;
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [loadedLogo, setLoadedLogo] = useState<string>();
  const [loadedBackdrop, setLoadedBackdrop] = useState<string>();
  const [pending, setPending] = useState(true);
  const pinnedLogo = useTitleLogo(meta.id);
  const pinnedBackdrop = useTitleBackdrop(meta.id);
  const anime = isAnimeId(meta.id);

  useEffect(() => {
    let cancelled = false;
    const valid = () => !cancelled && guard.current();
    setPending(true);
    setResolved(null);
    void (async () => {
      const full = await resolveMeta(
        authKey,
        meta.type === "movie" ? "movie" : "series",
        meta.id,
      ).catch(() => null);
      if (!valid()) return;
      let display = { ...meta, ...full, id: meta.id, type: meta.type };
      let tmdbId: string | undefined;
      let imdbId = meta.id.startsWith("tt") ? meta.id : null;
      let seasons: Season[] | undefined;
      if (settings.tmdbKey && !anime) {
        tmdbId = meta.id.startsWith("tmdb:")
          ? meta.id
          : meta.id.startsWith("tt")
            ? ((await tmdbIdFromImdb(
                settings.tmdbKey,
                meta.id,
                meta.type === "movie" ? "movie" : "series",
              )) ?? undefined)
            : undefined;
        if (!valid()) return;
        const match = tmdbId?.match(/^tmdb:(movie|tv):(\d+)$/);
        if (match) {
          const header = await get<TitleHeader>(settings.tmdbKey, `${match[1]}/${match[2]}`, {
            language: effectiveTmdbLanguage() || "en",
          }).catch(() => null);
          if (!valid()) return;
          if (header) {
            display = {
              ...display,
              name: header.title || header.name || display.name,
              originalLanguage: header.original_language || display.originalLanguage,
              background: display.background || tmdbBackdropUrl(header.backdrop_path),
            };
            seasons = header.seasons?.map((s) => ({
              id: s.id,
              seasonNumber: s.season_number,
              name: s.name,
              episodeCount: s.episode_count,
              airDate: s.air_date ?? null,
              overview: "",
              posterPath: null,
            }));
          }
          if (!imdbId) imdbId = await tmdbImdbId(settings.tmdbKey, tmdbId!).catch(() => null);
        }
      }
      if (!valid()) return;
      setResolved({ meta: display, tmdbId, imdbId, seasons });
      setPending(false);
    })().catch(() => {
      if (valid()) {
        setResolved({ meta, imdbId: meta.id.startsWith("tt") ? meta.id : null });
        setPending(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    meta,
    authKey,
    settings.tmdbKey,
    settings.tmdbLanguage,
    settings.preferCustomMetaAddon,
    anime,
  ]);

  const display = resolved?.meta ?? meta;
  useEffect(() => {
    let cancelled = false;
    void resolveLogo(settings.tmdbKey, display, { preferOwn: anime })
      .then((url) => {
        if (!cancelled && guard.current()) setLoadedLogo(url);
      })
      .catch(() => {});
    if (anime)
      void resolveHeroArt(settings.tmdbKey, display)
        .then((art) => {
          if (!cancelled && guard.current()) setLoadedBackdrop(art.background);
        })
        .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [display, settings.tmdbKey, settings.tmdbImageLangs, settings.tmdbLanguage, anime]);
  const cachedAnime = anime ? peekAnimeArt(meta.id) : undefined;
  const stableLogo = useStableAsset([loadedLogo, display.logo], meta.id);
  const stableBackdrop = useStableAsset(
    [cachedAnime?.bg, loadedBackdrop, display.background],
    meta.id,
  );
  return {
    meta: display,
    tmdbId: resolved?.tmdbId,
    imdbId: resolved?.imdbId ?? null,
    seasons: resolved?.seasons,
    pending,
    logo: pinnedLogo || loadedLogo || stableLogo,
    backdrop: pinnedBackdrop || stableBackdrop,
  };
}
