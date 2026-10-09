import { useEffect, useMemo, useRef, useState } from "react";
import { useAnilist } from "@/lib/anilist/provider";
import { awardFranchiseKey } from "@/lib/anime-awards";
import { applyAnimeRowCustomization } from "@/lib/anime-customization";
import type { AnimeFilterOpts } from "@/lib/anime-filter";
import type { Meta } from "@/lib/cinemeta";
import { useMal } from "@/lib/mal/provider";
import { useCollectionRowsForPage } from "@/lib/page-collection-rows";
import { useSettings } from "@/lib/settings";
import type { LibraryItem } from "@/lib/stremio";
import { useAnilistAnimeRailsState } from "@/lib/use-anilist-anime-rails";
import { useAnilistTop, useAnilistTrending } from "@/lib/use-anilist-top";
import { useCrunchyrollAwardMetas } from "@/lib/use-crunchyroll-award-metas";
import { useMalAnimeRailsState } from "@/lib/use-mal-anime-rails";
import { useCwAdvance } from "@/views/home/hooks/use-cw-advance";
import { ROW_MAX_PAGES, ROW_MIN_VISIBLE, SPECS } from "@/views/anime/anime-rows";
import { useBpT } from "./bp-i18n";
import {
  buildBpAnimeGroups,
  dedupeAnimeAddonRows,
  filterSpecRows,
  mergeAwardWinners,
  type BpAnimeRow,
} from "./bp-anime-groups";
import { useBpAnimeCwBase } from "./use-bp-anime-cw";
import { useBpAnimeHero, useBpAnimeTopPicks } from "./use-bp-anime-hero";
import { useBpAnimeSpecs } from "./use-bp-anime-specs";
import { useBpAnimeWatched } from "./use-bp-anime-watched";

const EMPTY_TRAKT = new Set<string>();

const AUTO_FILL_BUDGET = 4;

export type { BpAnimeRow } from "./bp-anime-groups";

export type BpAnimeData = {
  rows: BpAnimeRow[];
  cwRow: BpAnimeRow | null;
  heroSlide: Meta | null;
  slides: Meta[];
  heroTrending: Record<string, string>;
  topPicks: Meta[];
  cwItems: LibraryItem[];
  loading: boolean;
  failed: boolean;
};

export function useBpAnime(): BpAnimeData {
  const t = useBpT();
  const { settings } = useSettings();
  const specs = useBpAnimeSpecs();
  const cwBase = useBpAnimeCwBase();
  const mal = useMal();
  const anilist = useAnilist();
  const malRails = useMalAnimeRailsState();
  const anilistRails = useAnilistAnimeRailsState();
  const anilistTrending = useAnilistTrending();
  const anilistTop = useAnilistTop();
  const awardEntries = useCrunchyrollAwardMetas(true);
  const collections = useCollectionRowsForPage("anime");

  // The AniList watched map is fetched per id, so it has to cover everything the
  // filters run over, not just continue watching. Hero and picks only exist
  // further down the render, so their ids land here on the next pass.
  const lateRef = useRef<Set<string>>(new Set());
  const [lateIds, setLateIds] = useState<string[]>([]);
  const watchedIds = useMemo(
    () => [...cwBase.raw.map((i) => i._id), ...lateIds],
    [cwBase.raw, lateIds],
  );
  const watched = useBpAnimeWatched(watchedIds);

  const filterOpts = useMemo<AnimeFilterOpts>(
    () => ({
      excludeOrigins: settings.animeExcludeOrigins,
      hideWatched: settings.animeHideWatchedPicks,
      isWatched: watched.isAnimeWatched,
    }),
    [settings.animeExcludeOrigins, settings.animeHideWatchedPicks, watched.isAnimeWatched],
  );

  const hero = useBpAnimeHero(specs.rowsByKey, filterOpts);
  const topPicks = useBpAnimeTopPicks({
    libItems: cwBase.libItems,
    continueWatching: cwBase.raw,
    heroMetas: hero.metas,
    hosted: hero.hosted,
    filterOpts,
  });

  // The accumulator is a ref because lateIds feeds watchedIds, which feeds the
  // filters, which rebuild hero and picks. Listing lateIds here as well made
  // this effect its own trigger, and every extra pass rewalked the whole
  // AniList watched map over a longer id list.
  useEffect(() => {
    const acc = lateRef.current;
    const before = acc.size;
    for (const m of topPicks) acc.add(m.id);
    for (const m of hero.metas) acc.add(m.id);
    for (const m of hero.anilistTrending) acc.add(m.id);
    for (const m of hero.hosted ?? []) acc.add(m.id);
    if (acc.size === before) return;
    setLateIds([...acc]);
  }, [topPicks, hero.metas, hero.anilistTrending, hero.hosted]);

  const cwItems = useCwAdvance(
    cwBase.raw,
    settings.tmdbKey,
    settings.cwAdvanceNext,
    cwBase.resurfaceLibrary,
    "only",
    cwBase.manualWatchedVer,
    EMPTY_TRAKT,
    watched.simklWatched,
    watched.anilistWatched,
    watched.simklStatus,
    cwBase.animeDetectVer,
    settings.episodeHiding,
    settings.animeCwEnd,
  );

  const specRows = useMemo(
    () => filterSpecRows(specs.rowsByKey, topPicks),
    [specs.rowsByKey, topPicks],
  );

  const filledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (filledRef.current.size >= AUTO_FILL_BUDGET) return;
    for (const spec of SPECS) {
      const raw = specs.rowsByKey[spec.key];
      if (!raw?.ready || !raw.hasMore || raw.page >= ROW_MAX_PAGES) continue;
      const shown = specRows[spec.key];
      if (!shown || shown.metas.length >= ROW_MIN_VISIBLE) continue;
      if (filledRef.current.has(spec.key)) continue;
      filledRef.current.add(spec.key);
      specs.loadMore(spec.key);
      if (filledRef.current.size >= AUTO_FILL_BUDGET) return;
    }
  }, [specs.rowsByKey, specRows, specs.loadMore]);

  // A winner resolved from the bundled id map carries an id and no art, and
  // mergeAwardWinners reads `resolved.get(fk) ?? m`, so the entry always beats
  // the row meta. Two things follow. It may not shadow an fk a row already
  // covers, or it blanks a card that had a poster and sends it off to hydrate
  // art it did not need. And it may not join before every row has reported, or
  // the award row paints ahead of the rows that supply most of its posters.
  const awards = useMemo(() => {
    const covered = new Set<string>();
    let ready = 0;
    for (const spec of SPECS) {
      const r = specs.rowsByKey[spec.key];
      if (!r?.ready) continue;
      ready += 1;
      for (const m of r.metas) covered.add(awardFranchiseKey(m.name));
    }
    const settled = ready === SPECS.length;
    const entries = awardEntries.filter(
      (e) => e.meta.poster || (settled && !covered.has(awardFranchiseKey(e.meta.name))),
    );
    return mergeAwardWinners(specs.rowsByKey, entries);
  }, [specs.rowsByKey, awardEntries]);

  const addonRows = useMemo(
    () => dedupeAnimeAddonRows(cwBase.addonRows, settings.hideContent.adult),
    [cwBase.addonRows, settings.hideContent.adult],
  );

  const groups = useMemo(
    () =>
      buildBpAnimeGroups({
        t,
        renamed: settings.animeRows.renamed,
        cwItems,
        cwReady: cwBase.ready,
        cwPending: !cwBase.ready && cwBase.raw.length > 0,
        malConnected: mal.isConnected,
        malRails: malRails.rails,
        malState: malRails,
        anilistConnected: anilist.isConnected,
        anilistRails: anilistRails.rails,
        anilistState: anilistRails,
        anilistTrending,
        anilistTop,
        awards,
        specRows,
        addonRows,
        collections,
      }),
    [
      t,
      settings.animeRows.renamed,
      cwItems,
      cwBase.ready,
      cwBase.raw.length,
      mal.isConnected,
      malRails,
      anilist.isConnected,
      anilistRails,
      anilistTrending,
      anilistTop,
      awards,
      specRows,
      addonRows,
      collections,
    ],
  );

  const allRows = useMemo(
    () =>
      applyAnimeRowCustomization(groups, settings.animeRows)
        .flatMap((g) => g.rows)
        .filter((r) => !(r.notice && r.id.endsWith(":offline"))),
    [groups, settings.animeRows],
  );

  const cwRow = useMemo(() => allRows.find((r) => r.cwItems) ?? null, [allRows]);
  const rows = useMemo(() => allRows.filter((r) => !r.cwItems), [allRows]);

  const heroSlide = useMemo(() => {
    const hosted = hero.hosted ?? [];
    return (
      hosted.find((m) => m.background && m.logo) ??
      hosted.find((m) => m.background) ??
      hero.slides.find((m) => m.background && m.logo) ??
      hero.slides.find((m) => m.background) ??
      null
    );
  }, [hero.hosted, hero.slides]);

  const hasContent = allRows.some((r) => r.metas.length > 0 || (r.cwItems?.length ?? 0) > 0);
  const settled =
    specs.readyCount === SPECS.length &&
    cwBase.ready &&
    (!mal.isConnected || !malRails.loading) &&
    (!anilist.isConnected || !anilistRails.loading);
  const loading = !settled;
  const failed = settled && !hasContent && specs.itemCount === 0;

  return {
    rows,
    cwRow,
    heroSlide,
    slides: hero.slides,
    heroTrending: hero.trending,
    topPicks,
    cwItems,
    loading,
    failed,
  };
}
