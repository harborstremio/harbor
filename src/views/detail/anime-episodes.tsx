import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Meta } from "@/lib/cinemeta";
import { scrollToDataEp } from "@/lib/episode-scroll";
import { type FranchiseEntry } from "@/lib/providers/anime-detail";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useSettings } from "@/lib/settings";
import { effectiveOrderProvider, tvdbPanelEnabled } from "@/lib/settings/episode-order";
import { useView } from "@/lib/view";
import { fetchWatchedKeySet } from "@/lib/trakt/history";
import { useTrakt } from "@/lib/trakt/provider";
import { useAnilistWatched } from "@/lib/anilist/use-anilist-watched";
import { useMalWatched } from "@/lib/mal/use-mal-watched";
import { EpisodeWatchedMenu, type WatchedMenuTarget } from "@/components/episode-watched-menu";
import { manualWatchedVersion, subscribeManualWatched } from "@/lib/manual-watched";
import { useT } from "@/lib/i18n";
import { AnimeEpisodeRow } from "./anime-episodes/episode-row";
import { AnimeSeasonPicker } from "./anime-episodes/anime-season-picker";
import { mapSeasonToEntry } from "./anime-episodes/anime-season-art";
import { MovieEntryCard } from "./anime-episodes/movie-entry-card";
import { useAnimeOrder } from "./anime-episodes/use-anime-order";
import { SeasonArcPicker } from "./series-episodes/season-arc-picker";
import { AnimeEpisodeStrip } from "./anime-episode-strip";
import { EpisodeGridControls } from "./episode-grid-controls";
import { EpisodeLayoutToggle } from "./episode-layout-toggle";
import { EpisodeDownloadsMenu } from "./episode-downloads-menu";
import { EpisodeSearch } from "./episode-search";
import { AnimeRandomButton } from "./anime-random-button";
import { EpisodeSearchToggle } from "./series-episodes/episode-search-controls";
import { AnimeAiBar } from "./anime-episodes/anime-ai-bar";
import { useAnimeAiSearch } from "./anime-episodes/use-anime-ai-search";
import { useAnimeProgressMap } from "./anime-episodes/use-anime-progress-map";
import { useAnimePreferredSeason } from "./anime-episodes/use-anime-preferred-season";
import { useAnimeTvdbPanel } from "./anime-episodes/use-anime-tvdb-panel";

import { useFranchiseEpisodes } from "./anime-episodes/use-franchise-episodes";
import { useAnimeWatchedRouting } from "./anime-episodes/use-anime-watched-routing";
import { useAnimeFranchiseNav } from "./anime-episodes/use-anime-franchise-nav";
import { useTvdbProxyImages } from "./anime-episodes/use-tvdb-proxy-images";
import { pickTvdbImage } from "@/lib/providers/tvdb-proxy";
import { TvdbOrderPanel } from "./series-episodes/tvdb-order-panel";
import { parseKitsuId } from "@/lib/providers/kitsu";
import { aiIsGroq, aiKey, providerForModel } from "@/lib/ai-models";

const WINDOW_STEP = 60;

export function AnimeEpisodes({
  meta,
  episodes,
  franchise,
  currentId,
  scrollRef,
  trackId,
  imdbId,
  episodeHint,
  localizedOverview,
  seasonOverviews,
  onSeasonArt,
}: {
  meta: Meta;
  episodes: KitsuEpisode[];
  franchise: FranchiseEntry[];
  currentId: string;
  scrollRef: React.RefObject<HTMLElement | null>;
  trackId?: string;
  imdbId?: string | null;
  episodeHint?: { season: number; episode: number };
  localizedOverview?: string;
  seasonOverviews?: Record<number, string>;
  onSeasonArt?: (
    sel:
      | { background?: string; description?: string; logo?: string; name?: string; entryId: string }
      | null,
  ) => void;
}) {
  const t = useT();
  const { isConnected: traktConnected } = useTrakt();
  const [traktWatched, setTraktWatched] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!traktConnected) {
      setTraktWatched(new Set());
      return;
    }
    let cancelled = false;
    fetchWatchedKeySet()
      .then((set) => {
        if (!cancelled) setTraktWatched(set);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [traktConnected]);

  const { watchedKeys: anilistWatched, completed: anilistCompleted } = useAnilistWatched(
    trackId ?? meta.id,
    episodes,
  );
  const { watchedKeys: malWatched, completed: malCompleted } = useMalWatched(
    trackId ?? meta.id,
    episodes,
  );
  const franchiseEpisodes = useFranchiseEpisodes(
    franchise,
    currentId,
    episodes,
    franchise.length > 1,
  );
  const panelPool = franchiseEpisodes !== episodes ? franchiseEpisodes : undefined;
  const mwVersion = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const preferredSeasonKey = useAnimePreferredSeason({
    episodes: panelPool ?? episodes,
    metaId: meta.id,
    trackId,
    traktWatched,
    anilistWatched,
    malWatched,
    mwVersion,
  });
  const intentSeasonKey = useMemo(() => {
    const counts = new Map<number, number>();
    for (const ep of episodes) {
      if (ep.sourceMetaId != null) continue;
      const s = ep.imdbSeason;
      if (s == null || s < 1) continue;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    let best: number | null = null;
    let bestN = 0;
    if (counts.size <= 1) {
      for (const [s, n] of counts) {
        if (n > bestN) {
          best = s;
          bestN = n;
        }
      }
    }
    if (best != null && best >= 2) return String(best);
    if (episodeHint && episodeHint.season >= 2) return String(episodeHint.season);
    return null;
  }, [episodes, episodeHint]);
  const { settings, update } = useSettings();
  const order = useAnimeOrder(
    imdbId ?? null,
    meta.id,
    episodes,
    effectiveOrderProvider(settings),
    settings.tvdbSeasonType,
    settings.tvdbKey,
    preferredSeasonKey ?? undefined,
    intentSeasonKey ?? undefined,
  );
  const routing = useAnimeWatchedRouting(meta, franchise, trackId);
  const { openMeta } = useView();
  const [activeEntryId, setActiveEntryId] = useState(currentId);
  useEffect(() => {
    setActiveEntryId(currentId);
  }, [currentId, meta.id]);
  const activeIsAnchor = activeEntryId === currentId;
  const onSelectEntry = useCallback(
    (entryId: string) => {
      if (entryId === currentId) {
        setActiveEntryId(currentId);
        return;
      }
      const entry = franchise.find((f) => f.meta.id === entryId);
      if (!entry) return;
      const inPool =
        parseKitsuId(entry.meta.id) != null &&
        franchiseEpisodes.some((ep) => ep.sourceMetaId === entryId);
      if (inPool) setActiveEntryId(entryId);
      else openMeta(entry.meta, { exact: true });
    },
    [currentId, franchise, franchiseEpisodes, openMeta],
  );
  const entryEpisodes = useMemo(
    () => (activeIsAnchor ? episodes : franchiseEpisodes.filter((ep) => ep.sourceMetaId === activeEntryId)),
    [activeIsAnchor, franchiseEpisodes, activeEntryId, episodes],
  );
  const tvdbPanel = useAnimeTvdbPanel(
    parseKitsuId(meta.id),
    imdbId ?? null,
    episodes,
    settings.tvdbSeasonType,
    settings.tvdbKey,
    tvdbPanelEnabled(settings),
    panelPool,
    preferredSeasonKey ?? undefined,
    intentSeasonKey ?? undefined,
    franchise,
  );

  const onSeasonArtRef = useRef(onSeasonArt);
  onSeasonArtRef.current = onSeasonArt;
  const tvdbActiveSeason = tvdbPanel.panel
    ? tvdbPanel.panel.items.find((i) => i.key === tvdbPanel.panel!.activeKey)
    : undefined;
  const seasonEntry = useMemo(
    () => mapSeasonToEntry(tvdbActiveSeason, franchise, currentId),
    [tvdbActiveSeason, franchise, currentId],
  );
  // The matched franchise entry's episodes carry their TMDB season number (AniZip), which selects
  // the right localized per-season overview so the hero changes per season instead of staying static.
  const seasonOverview = useMemo(() => {
    if (!seasonEntry || !seasonOverviews) return undefined;
    const counts = new Map<number, number>();
    for (const ep of franchiseEpisodes) {
      if (ep.sourceMetaId !== seasonEntry.meta.id || ep.imdbSeason == null) continue;
      counts.set(ep.imdbSeason, (counts.get(ep.imdbSeason) ?? 0) + 1);
    }
    let best: number | null = null;
    let bestN = 0;
    for (const [s, n] of counts) {
      if (n > bestN) {
        best = s;
        bestN = n;
      }
    }
    return best != null ? seasonOverviews[best] : undefined;
  }, [seasonEntry, seasonOverviews, franchiseEpisodes]);
  useEffect(() => {
    onSeasonArtRef.current?.(
      seasonEntry
        ? {
            background: seasonEntry.meta.background,
            // Prefer the localized per-season TMDB overview, then the localized series overview,
            // over the franchise entry's Kitsu synopsis (localized* is only set when localization is active).
            description: seasonOverview ?? localizedOverview ?? seasonEntry.meta.description,
            logo: seasonEntry.meta.logo,
            name: seasonEntry.meta.name,
            entryId: seasonEntry.meta.id,
          }
        : null,
    );
  }, [seasonEntry, localizedOverview, seasonOverview]);
  useEffect(() => () => onSeasonArtRef.current?.(null), []);
  const proxyImages = useTvdbProxyImages(
    parseKitsuId(meta.id),
    imdbId ?? null,
    episodes.length,
    settings.tvdbSeasonType,
  );
  const baseDisplay = tvdbPanel.panel
    ? tvdbPanel.panel.visibleEpisodes
    : !activeIsAnchor
      ? entryEpisodes
      : order
        ? order.visibleEpisodes
        : episodes;
  const displayEpisodes = useMemo(() => {
    if (Object.keys(proxyImages).length === 0) return baseDisplay;
    return baseDisplay.map((ep) => {
      const img = pickTvdbImage(proxyImages, ep);
      return img ? { ...ep, thumbnail: img } : ep;
    });
  }, [baseDisplay, proxyImages]);
  const displaySourceId = useMemo(() => {
    const ids = new Set<string>();
    for (const e of displayEpisodes) if (e.sourceMetaId != null) ids.add(e.sourceMetaId);
    return ids.size === 1 ? [...ids][0] : null;
  }, [displayEpisodes]);
  const entryPoolEpisodes = useMemo(
    () =>
      displaySourceId ? franchiseEpisodes.filter((e) => e.sourceMetaId === displaySourceId) : [],
    [displaySourceId, franchiseEpisodes],
  );
  const { watchedKeys: entryAnilistWatched } = useAnilistWatched(
    displaySourceId ?? "",
    entryPoolEpisodes,
  );
  const { watchedKeys: entryMalWatched } = useMalWatched(displaySourceId ?? "", entryPoolEpisodes);
  const showSeason = useMemo(
    () => new Set(displayEpisodes.map((e) => e.imdbSeason ?? e.seasonNumber ?? 1)).size > 1,
    [displayEpisodes],
  );
  const { pickerItems, selectPickerItem, franchiseActiveKey } = useAnimeFranchiseNav(
    order,
    franchise,
    currentId,
    activeEntryId,
    onSelectEntry,
  );
  const [watchedMenu, setWatchedMenu] = useState<WatchedMenuTarget | null>(null);
  const openWatchedMenu = (
    e: React.MouseEvent,
    season: number,
    episode: number,
    watched: boolean,
    sourceMetaId?: string,
  ) => {
    e.preventDefault();
    setWatchedMenu({ x: e.clientX, y: e.clientY, season, episode, watched, metaId: sourceMetaId });
  };

  const { progressFor, nextUpNum, nextUpId, spoilerFor, allWatched } = useAnimeProgressMap({
    episodes,
    displayEpisodes,
    metaId: meta.id,
    trackId,
    traktWatched,
    anilistWatched,
    malWatched,
    entrySourceId: displaySourceId,
    entryAnilistWatched,
    entryMalWatched,
    mwVersion,
    settings,
  });
  const markSeason = (watched: boolean) => routing.markMany(displayEpisodes, watched);

  const orderedEpisodes = useMemo(
    () => (settings.episodeSort === "newest" ? displayEpisodes.slice().reverse() : displayEpisodes),
    [displayEpisodes, settings.episodeSort],
  );
  const windowed = settings.episodeLayout === "list" || settings.episodeLayout === "strip";
  const [renderCount, setRenderCount] = useState(WINDOW_STEP);
  useEffect(() => {
    setRenderCount(WINDOW_STEP);
  }, [meta.id, settings.episodeLayout, settings.episodeSort, order?.activeKey, activeEntryId]);
  const grow = useCallback(
    () =>
      setRenderCount((c) =>
        c >= orderedEpisodes.length ? c : Math.min(orderedEpisodes.length, c + WINDOW_STEP),
      ),
    [orderedEpisodes.length],
  );
  const reveal = useCallback(
    (n: number, epId?: number | null) => {
      const byId = epId != null ? orderedEpisodes.findIndex((e) => e.id === epId) : -1;
      const idx = byId >= 0 ? byId : orderedEpisodes.findIndex((e) => e.number === n);
      const target = idx >= 0 ? idx : n;
      setRenderCount((c) => Math.max(c, Math.min(orderedEpisodes.length, target + 20)));
    },
    [orderedEpisodes],
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listEpisodes = windowed ? orderedEpisodes.slice(0, renderCount) : orderedEpisodes;

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const aiProvider = providerForModel(settings.aiSearchModel);
  const ai = useAnimeAiSearch(
    meta.name,
    displayEpisodes,
    aiKey(settings),
    settings.aiSearchModel,
    aiIsGroq(settings),
  );
  const filteredEpisodes = useMemo(() => {
    if (aiMode && ai.matched) return displayEpisodes.filter((e) => ai.matched!.has(e.number));
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return displayEpisodes.filter(
      (e) => String(e.number).includes(q) || (e.title ?? "").toLowerCase().includes(q),
    );
  }, [query, displayEpisodes, aiMode, ai.matched]);
  const gridEpisodes = filteredEpisodes ?? displayEpisodes;
  const windowEpisodes = filteredEpisodes
    ? settings.episodeSort === "newest"
      ? filteredEpisodes.slice().reverse()
      : filteredEpisodes
    : listEpisodes;
  const hasMore = windowed && renderCount < orderedEpisodes.length;
  useEffect(() => {
    if (settings.episodeLayout !== "list" || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) grow();
      },
      { root: scrollRef.current ?? null, rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [settings.episodeLayout, hasMore, grow, scrollRef]);

  const didJumpRef = useRef("");
  useEffect(() => {
    if (order || tvdbPanel.panel) return;
    if (nextUpNum == null || didJumpRef.current === meta.id) return;
    const idx = episodes.findIndex((ep) => ep.id === nextUpId);
    if (idx < 12) return;
    didJumpRef.current = meta.id;
    if ((scrollRef.current?.scrollTop ?? 0) > 240) return;
    reveal(nextUpNum, nextUpId);
    scrollToDataEp(scrollRef.current, nextUpNum, { behavior: "auto", center: true, epId: nextUpId });
  }, [nextUpNum, nextUpId, episodes, meta.id, reveal, scrollRef]);

  const isOneOff = meta.type === "movie" || episodes.length <= 1;
  const downloadEpisodes = useMemo(
    () =>
      displayEpisodes.map((e) => ({
        season: e.seasonNumber || 1,
        episode: e.number,
        name: e.title || undefined,
        kitsuStreamId: e.streamId,
        imdbId: e.imdbId,
        imdbSeason: e.imdbSeason,
        imdbEpisode: e.imdbEpisode,
        tvdbEpisodeId: e.tvdbEpisodeId,
      })),
    [displayEpisodes],
  );
  return (
    <div data-anime-episodes className="flex flex-col gap-6 scroll-mt-24">
      <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="shrink-0 pt-1 text-[22px] font-medium tracking-tight text-ink">
          {isOneOff ? t("Movie") : t("Episodes")}
        </h3>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 xl:gap-3">
          {!isOneOff && (
            <p className="hidden text-[13px] text-ink-subtle 2xl:block">
              {displayEpisodes.length === 1
                ? t("{n} episode", { n: displayEpisodes.length })
                : t("{n} episodes", { n: displayEpisodes.length })}
            </p>
          )}
          {!isOneOff && <EpisodeDownloadsMenu meta={meta} episodes={downloadEpisodes} />}
          {!isOneOff && <AnimeRandomButton episodes={displayEpisodes} metaForEp={routing.metaForEp} />}
          {!isOneOff && (
            <EpisodeLayoutToggle
              value={settings.episodeLayout}
              onChange={(v) => update({ episodeLayout: v })}
            />
          )}
          {!isOneOff && (
            <EpisodeGridControls
              sort={settings.episodeSort}
              onSort={(s) => update({ episodeSort: s })}
              allWatched={allWatched}
              onMarkSeason={markSeason}
            />
          )}
          {!isOneOff && (
            <EpisodeSearchToggle
              searchActive={searchOpen || query.trim().length > 0}
              aiMode={aiMode}
              aiEnabled={!!(settings.aiSearchKey.trim() || settings.aiGroqKey.trim())}
              aiProvider={aiProvider}
              onSearch={() => {
                setSearchOpen((v) => !v);
                setAiMode(false);
                ai.reset();
              }}
              onAskAi={() => {
                setAiMode(true);
                setSearchOpen(false);
                setQuery("");
              }}
            />
          )}
          {isOneOff ? (
            franchise.length > 1 ? (
              <AnimeSeasonPicker
                franchise={franchise}
                activeEntryId={activeEntryId}
                onSelectEntry={onSelectEntry}
              />
            ) : null
          ) : tvdbPanel.panel ? (
            <TvdbOrderPanel
              items={tvdbPanel.panel.items}
              activeKey={tvdbPanel.panel.activeKey}
              onSelect={tvdbPanel.panel.onSelect}
              orderTypes={tvdbPanel.panel.orderTypes}
              activeType={tvdbPanel.panel.activeType}
              onSelectType={(v) => update({ tvdbSeasonType: v as typeof settings.tvdbSeasonType })}
            />
          ) : tvdbPanel.active ? (
            <div
              aria-hidden
              className="h-10 w-44 animate-pulse rounded-full border border-edge-soft/50 bg-elevated/40"
            />
          ) : order ? (
            <SeasonArcPicker
              items={pickerItems}
              activeKey={franchiseActiveKey ?? order.activeKey}
              onSelect={selectPickerItem}
            />
          ) : franchise.length > 1 ? (
            <AnimeSeasonPicker
              franchise={franchise}
              activeEntryId={activeEntryId}
              onSelectEntry={onSelectEntry}
            />
          ) : null}
        </div>
      </div>
      {!isOneOff && aiMode && (
        <AnimeAiBar
          provider={aiProvider}
          loading={ai.status === "loading"}
          onSubmit={ai.run}
          onExit={() => {
            setAiMode(false);
            ai.reset();
          }}
        />
      )}
      {!isOneOff && !aiMode && searchOpen && (
        <EpisodeSearch query={query} onQuery={setQuery} matched={filteredEpisodes?.length ?? null} />
      )}
      </div>
      {isOneOff ? (
        <MovieEntryCard meta={meta} ep={episodes[0]} watched={anilistCompleted || malCompleted} />
      ) : (
        <div key={settings.episodeLayout} className="animate-fade-in">
          {filteredEpisodes && filteredEpisodes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center">
              <p className="text-[14px] text-ink-muted">{t("No episodes match your search")}</p>
              <button
                onClick={() => setQuery("")}
                className="text-[13px] font-medium text-accent transition-opacity hover:opacity-80"
              >
                {t("Clear search")}
              </button>
            </div>
          ) : settings.episodeLayout === "list" ? (
            <div className="flex flex-col gap-1">
              {windowEpisodes.map((ep) => (
                <AnimeEpisodeRow
                  key={ep.id}
                  meta={meta}
                  ep={ep}
                  progress={progressFor(ep)}
                  spoiler={spoilerFor(ep)}
                  onContextMenu={openWatchedMenu}
                  metaForEp={routing.metaForEp}
                  showSeason={showSeason}
                />
              ))}
              {hasMore && !filteredEpisodes && (
                <div ref={sentinelRef} aria-hidden className="h-px w-full" />
              )}
            </div>
          ) : (
            <AnimeEpisodeStrip
              layout={settings.episodeLayout === "grid" ? "grid" : "strip"}
              meta={meta}
              episodes={settings.episodeLayout === "grid" ? gridEpisodes : windowEpisodes}
              progressFor={progressFor}
              spoilerFor={spoilerFor}
              onContextMenu={openWatchedMenu}
              onReachEnd={settings.episodeLayout === "grid" ? undefined : grow}
              metaForEp={routing.metaForEp}
              showSeason={showSeason}
            />
          )}
        </div>
      )}
      {watchedMenu && (
        <EpisodeWatchedMenu
          metaId={watchedMenu.metaId ?? meta.id}
          meta={
            watchedMenu.metaId
              ? routing.manualMetaFor(watchedMenu.metaId)
              : { type: "series", name: meta.name, poster: meta.poster, background: meta.background }
          }
          target={watchedMenu}
          allEpisodes={entryEpisodes
            .filter((ep) => (ep.sourceMetaId ?? meta.id) === (watchedMenu.metaId ?? meta.id))
            .map((ep) => ({
              season: ep.seasonNumber ?? 1,
              episode: ep.number,
              released: ep.airdate ?? null,
            }))}
          onClose={() => setWatchedMenu(null)}
        />
      )}
    </div>
  );
}
