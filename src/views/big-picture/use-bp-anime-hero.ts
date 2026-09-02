import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animeFiltered, enrichAnimeCountry, type AnimeFilterOpts } from "@/lib/anime-filter";
import { fetchHostedHero, peekHostedHero, type HostedHeroItem } from "@/lib/anime-hosted-hero";
import type { Meta } from "@/lib/cinemeta";
import { fetchMalHeroList, type MalHeroItem } from "@/lib/mal-hero";
import { animeFranchiseKey } from "@/lib/providers/jikan";
import {
  ensureStaticHeroArt,
  peekStaticHeroArt,
  staticHeroPool,
} from "@/lib/providers/anime-hero-art-static";
import { useSettings } from "@/lib/settings";
import type { LibraryItem } from "@/lib/stremio";
import { useAnilistTrending } from "@/lib/use-anilist-top";
import { useAnimeTopPicks } from "@/lib/use-anime-top-picks";
import { useWatchHistoryRecommendations } from "@/lib/use-watch-history-recs";
import type { RowState } from "@/views/anime/anime-rows";
import { SPECS } from "@/views/anime/anime-rows";
import {
  buildHeroSelection,
  buildHostedHero,
  cacheHero,
  heroSourceLabel,
  isHeroCacheFresh,
  readCachedHero,
  resolveHeroSlides,
  upgradeHeroArtFromStatic,
  type HeroBuilt,
} from "@/views/anime/hero-build";

const PICKS_FALLBACK = 20;
const HERO_TRENDING = 30;
const MAL_DEFER_MS = 10000;

export type BpAnimeHero = {
  metas: Meta[];
  slides: Meta[];
  trending: Record<string, string>;
  hosted: HostedHeroItem[] | null;
  anilistTrending: Meta[];
};

function frontSlides(metas: Meta[], opts: AnimeFilterOpts): Meta[] {
  const isWatched = opts.isWatched;
  if (!opts.hideWatched || !isWatched) return metas;
  const unwatched = metas.filter((m) => !isWatched(m.id));
  return unwatched.length > 0 ? unwatched : metas;
}

function malHeroMeta(it: MalHeroItem): Meta | null {
  const art = peekStaticHeroArt(it.id);
  if (!art?.bg) return null;
  return {
    id: it.id,
    type: it.format === "MOVIE" ? "movie" : "series",
    name: it.name,
    description: it.description,
    background: art.bg,
    logo: art.logo ?? undefined,
    poster: it.poster,
    releaseInfo: it.year,
    imdbRating: it.rating,
    animeFormat: it.format,
    source: "MyAnimeList",
  } as Meta;
}

// MAL titles are spread through the static pool rather than appended, so the
// rotation does not open with a long unbroken run from one source.
function interleave(bulk: Meta[], mal: Meta[]): Meta[] {
  if (mal.length === 0) return bulk;
  const step = Math.max(3, Math.floor(bulk.length / mal.length));
  const out: Meta[] = [];
  let at = 0;
  for (let i = 0; i < bulk.length; i += 1) {
    out.push(bulk[i]);
    if (at < mal.length && (i + 1) % step === 0) out.push(mal[at++]);
  }
  while (at < mal.length) out.push(mal[at++]);
  return out;
}

export function useBpAnimeHero(
  rowsByKey: Record<string, RowState>,
  filterOpts: AnimeFilterOpts,
): BpAnimeHero {
  const { settings } = useSettings();
  const filterSig = `${settings.animeExcludeOrigins.join(",")}|${settings.animeHideWatchedPicks}`;
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const [hero, setHero] = useState<HeroBuilt>(
    () => readCachedHero(filterSig) ?? { metas: [], trending: {} },
  );
  const [hosted, setHosted] = useState<HostedHeroItem[] | null>(() => peekHostedHero());
  const anilistTrendingAll = useAnilistTrending();
  const anilistTrending = useMemo(
    () => anilistTrendingAll.slice(0, HERO_TRENDING),
    [anilistTrendingAll],
  );
  const [malExtra, setMalExtra] = useState<MalHeroItem[]>([]);
  const [poolVersion, setPoolVersion] = useState(0);
  const buildRef = useRef(0);
  const resolvedRef = useRef(false);
  const buildingRef = useRef(false);
  const filterInitRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    fetchHostedHero()
      .then((h) => {
        if (!cancelled && h) setHosted(h);
      })
      .catch(() => {});
    void ensureStaticHeroArt().then(() => {
      if (!cancelled) setPoolVersion((n) => n + 1);
    });
    // MAL only fills slides past the first and costs 11 bridged jikan pages with a sleep after
    // each, so it waits out first paint. Deferred, never dropped: removing it changes the mix.
    const malTimer = window.setTimeout(() => {
      void fetchMalHeroList()
        .then((items) => {
          if (!cancelled && items.length > 0) setMalExtra(items);
        })
        .catch(() => {});
    }, MAL_DEFER_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(malTimer);
    };
  }, []);

  useEffect(() => {
    if (filterInitRef.current) {
      filterInitRef.current = false;
      return;
    }
    resolvedRef.current = false;
    setSeed(Math.floor(Math.random() * 0x7fffffff));
    setHero({ metas: [], trending: {} });
  }, [filterSig]);

  const buildHosted = useCallback(
    (at: number): boolean => {
      if (!hosted || hosted.length < 3) return false;
      const built = buildHostedHero(hosted, at, filterOpts);
      if (built.metas.length < 3) return false;
      resolvedRef.current = true;
      const buildId = ++buildRef.current;
      setHero(built);
      cacheHero(built, filterSig);
      void upgradeHeroArtFromStatic(built).then((up) => {
        if (buildRef.current === buildId) {
          setHero(up);
          cacheHero(up, filterSig);
        }
      });
      return true;
    },
    [hosted, filterOpts, filterSig],
  );

  useEffect(() => {
    if (hero.metas.length === 0 && buildHosted(seed)) return;
    if (resolvedRef.current) return;
    if (hero.metas.length > 0 && isHeroCacheFresh(filterSig)) {
      resolvedRef.current = true;
      return;
    }
    if (buildHosted(seed)) return;
    const ready = SPECS.filter((s) => rowsByKey[s.key]?.ready).length;
    if (ready < 2 && anilistTrending.length === 0) return;
    if (buildingRef.current) return;
    const built = buildHeroSelection(rowsByKey, seed, filterOpts, anilistTrending);
    if (built.metas.length < 3) return;
    buildingRef.current = true;
    const buildId = ++buildRef.current;
    void resolveHeroSlides(settings.tmdbKey, built, filterOpts, (resolved) => {
      if (buildRef.current === buildId && resolved.metas.length >= 1) {
        resolvedRef.current = true;
        setHero(resolved);
        cacheHero(resolved, filterSig);
      }
    })
      .catch(() => {})
      .finally(() => {
        buildingRef.current = false;
      });
  }, [rowsByKey, seed, hero.metas.length, anilistTrending, settings.tmdbKey, filterSig, buildHosted, filterOpts]);

  const slides = useMemo(() => {
    void poolVersion;
    const front = frontSlides(hero.metas, filterOpts);
    if (front.length === 0) return front;
    const seenBg = new Set(front.map((m) => m.background));
    const seenFr = new Set(front.filter((m) => m.name).map((m) => animeFranchiseKey(m.name)));
    const consider = (m: Meta): boolean => {
      if (seenBg.has(m.background) || animeFiltered(m, filterOpts)) return false;
      const fr = m.name ? animeFranchiseKey(m.name) : "";
      if (fr && seenFr.has(fr)) return false;
      seenBg.add(m.background);
      if (fr) seenFr.add(fr);
      return true;
    };
    const malPool: Meta[] = [];
    for (const m of peekHostedHero() ?? [])
      if (m.source === "MyAnimeList" && consider(m)) malPool.push(m);
    for (const it of malExtra) {
      const m = malHeroMeta(it);
      if (m && consider(m)) malPool.push(m);
    }
    const bulk: Meta[] = [];
    for (const m of staticHeroPool()) if (consider(m)) bulk.push(m);
    return [...front, ...interleave(bulk, malPool)];
  }, [hero.metas, filterOpts, malExtra, poolVersion]);

  const trending = useMemo(() => {
    const out: Record<string, string> = { ...hero.trending };
    for (const s of slides)
      if (!(s.id in out)) out[s.id] = heroSourceLabel((s as { source?: string }).source);
    return out;
  }, [hero.trending, slides]);

  return { metas: hero.metas, slides, trending, hosted, anilistTrending };
}

export function useBpAnimeTopPicks(params: {
  libItems: LibraryItem[];
  continueWatching: LibraryItem[];
  heroMetas: Meta[];
  hosted: HostedHeroItem[] | null;
  filterOpts: AnimeFilterOpts;
}): Meta[] {
  const { libItems, continueWatching, heroMetas, hosted, filterOpts } = params;
  const { settings } = useSettings();
  const watchHistoryRecs = useWatchHistoryRecommendations(continueWatching);
  const raw = useAnimeTopPicks({
    libItems,
    continueWatching,
    heroMetas,
    watchHistoryRecs,
    favoriteGenres: settings.animeFavoriteGenres,
  });
  const [enriched, setEnriched] = useState<Meta[]>([]);

  useEffect(() => {
    let cancelled = false;
    void enrichAnimeCountry(raw).then((e) => {
      if (!cancelled) setEnriched(e);
    });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  return useMemo(() => {
    const base = enriched.length > 0 ? enriched : raw;
    const filtered = base.filter((m) => !animeFiltered(m, filterOpts));
    if (filtered.length > 0) return filtered;
    if (hosted && hosted.length > 0) {
      const heroIds = new Set(heroMetas.map((m) => m.id));
      return hosted
        .filter((m) => !heroIds.has(m.id) && !animeFiltered(m, filterOpts))
        .slice(0, PICKS_FALLBACK);
    }
    return filtered;
  }, [enriched, raw, filterOpts, hosted, heroMetas]);
}
