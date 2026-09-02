import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import { EpisodeJumper } from "@/components/episode-jumper";
import { providerForModel } from "@/lib/ai-models";
import { CrossSeasonResults } from "./series-episodes/cross-season-results";
import { CinemetaFallback } from "./series-episodes/cinemeta-fallback";
import { EpisodeAiMode } from "./series-episodes/episode-ai-mode";
import { EpisodeSearchBar, EpisodeSearchToggle } from "./series-episodes/episode-search-controls";
import { EpisodeWatchedMenu, type WatchedMenuTarget } from "@/components/episode-watched-menu";
import { manualEpisodeKeys, manualWatchedVersion, subscribeManualWatched } from "@/lib/manual-watched";
import { useHiddenEpisodes } from "@/lib/hidden-episodes";
import type { Meta } from "@/lib/cinemeta";
import { getEpisodeProgress, resumeDefaultSeason } from "@/lib/episode-progress";
import { scrollToDataEp } from "@/lib/episode-scroll";
import { tmdbSeasonEpisodes, type Episode, type Season } from "@/lib/providers/tmdb";
import { tmdbLanguageIso } from "@/lib/providers/tmdb/tmdb-client";
import type { OrderedEpisode } from "@/lib/providers/tvdb-order";
import { pickLocalizedText } from "@/lib/localized-text";
import {
  PREFERRED_TEXT_SCORE,
  preferredVideoName,
  preferredVideoOverview,
} from "@/lib/meta-resource";
import { useSettings } from "@/lib/settings";
import { effectiveOrderProvider, tvdbPanelEnabled } from "@/lib/settings/episode-order";
import { useTrakt } from "@/lib/trakt/provider";
import { useSimkl } from "@/lib/simkl/provider";
import { useT } from "@/lib/i18n";
import { EpisodeGridControls } from "./episode-grid-controls";
import { EpisodeLayoutToggle } from "./episode-layout-toggle";
import { EpisodeRow } from "./series-episode-row";
import { EpisodeGridSkeleton } from "./episode-grid-skeleton";
import { EpisodeStrip } from "./episode-strip";
import { RandomEpisodeButton } from "./random-episode-button";
import { EpisodeDownloadsMenu } from "./episode-downloads-menu";
import { SeasonArcPicker } from "./series-episodes/season-arc-picker";
import { useSeasonArcPicker } from "./series-episodes/use-season-arc-picker";
import { useMarkSeason } from "./series-episodes/use-mark-season";
import { useArcGroups } from "./series-episodes/use-arc-groups";
import { OrderedEpisodes } from "./series-episodes/ordered-episodes";
import { useEpisodeOrder } from "./series-episodes/use-episode-order";
import { useEpisodeEnrich } from "./series-episodes/use-episode-enrich";
import { useWatchedSets } from "./series-episodes/use-watched-sets";
import { useEpisodeProgressMap } from "./series-episodes/use-episode-progress-map";
import { useTvdbSeasonTypes } from "./series-episodes/use-tvdb-season-types";
import { useSeriesTvdbStills } from "./series-episodes/use-series-tvdb-stills";
import { TvdbOrderPanel } from "./series-episodes/tvdb-order-panel";

export function SeriesEpisodes({
  meta,
  tvId,
  imdbId,
  seasons,
  lastEpisodeAir,
  scrollRef,
  cinemetaVideos,
  stremioWatched,
  resumeSeason,
  resumeEpisode,
}: {
  meta: Meta;
  tvId: number;
  imdbId: string | null;
  seasons: Season[];
  lastEpisodeAir?: { seasonNumber: number; airDate: string | null };
  scrollRef: React.RefObject<HTMLElement | null>;
  cinemetaVideos?: NonNullable<Meta["videos"]>;
  stremioWatched?: Set<string>;
  resumeSeason?: number;
  resumeEpisode?: number;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: simklConnected } = useSimkl();
  const mwVersion = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const [watchedMenu, setWatchedMenu] = useState<WatchedMenuTarget | null>(null);
  const [epSearch, setEpSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const aiProvider = providerForModel(settings.aiSearchModel);
  const searching = epSearch.trim().length > 0;
  const openWatchedMenu = (
    e: React.MouseEvent,
    season: number,
    episode: number,
    watched: boolean,
  ) => {
    e.preventDefault();
    setWatchedMenu({ x: e.clientX, y: e.clientY, season, episode, watched });
  };
  const userPickedRef = useRef(false);
  const scrolledRef = useRef(false);
  const [active, setActive] = useState<number>(() =>
    resumeDefaultSeason(meta.id, seasons, stremioWatched, resumeSeason),
  );
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const { traktWatched, simklWatched } = useWatchedSets({
    traktConnected,
    simklConnected,
    imdbId,
    metaId: meta.id,
  });
  const combinedWatched = useMemo(() => {
    const s = new Set<string>(stremioWatched ?? []);
    for (const k of simklWatched) s.add(k);
    for (const k of traktWatched) {
      const e = k.lastIndexOf(":");
      const se = e > 0 ? k.lastIndexOf(":", e - 1) : -1;
      if (se >= 0) s.add(k.slice(se + 1));
    }
    const manual = manualEpisodeKeys(meta.id);
    for (const k of manual.watched) s.add(k);
    for (const k of manual.unwatched) s.delete(k);
    return s;
  }, [stremioWatched, simklWatched, traktWatched, meta.id, mwVersion]);
  const cache = useRef<Map<number, Episode[]>>(new Map());

  const traktKey = imdbId ?? meta.id;

  useEffect(() => {
    userPickedRef.current = false;
    scrolledRef.current = false;
  }, [meta.id]);

  useEffect(() => {
    if (userPickedRef.current) return;
    const def = resumeDefaultSeason(meta.id, seasons, combinedWatched, resumeSeason);
    if (import.meta.env.DEV) {
      const counts = seasons
        .filter((s) => s.seasonNumber >= 1)
        .map((s) => {
          let n = 0;
          for (const k of combinedWatched) if (k.startsWith(`${s.seasonNumber}:`)) n += 1;
          return `S${s.seasonNumber} ${n}/${s.episodeCount}`;
        });
      console.debug(`[season-default] ${meta.id} pick=${def} hint=${resumeSeason} [${counts.join(", ")}]`);
    }
    setActive(def);
  }, [meta.id, seasons, combinedWatched, resumeSeason]);

  const { episodes: enrichedBase, imdbRatings, preferredVideos } = useEpisodeEnrich({
    episodes,
    active,
    imdbId,
    tvdbKey: settings.tvdbKey,
    omdbKey: settings.omdbKey,
    metaId: meta.id,
    preferCustomMeta: settings.preferCustomMetaAddon,
  });
  const tvdbStills = useSeriesTvdbStills(imdbId, enrichedBase.length, settings.tvdbSeasonType);
  const enrichedEpisodes = useMemo(() => {
    if (Object.keys(tvdbStills).length === 0) return enrichedBase;
    return enrichedBase.map((ep) => {
      if (ep.stillPath || ep.stillUrl) return ep;
      const img = tvdbStills[`s${ep.seasonNumber}e${ep.episodeNumber}`] ?? tvdbStills[`abs${ep.episodeNumber}`];
      return img ? { ...ep, stillUrl: img } : ep;
    });
  }, [enrichedBase, tvdbStills]);

  const hiddenSet = useHiddenEpisodes(meta.id);
  const hideActive = settings.episodeHiding && !showHidden;
  const visibleEpisodes = useMemo(
    () =>
      hideActive && hiddenSet.size > 0
        ? enrichedEpisodes.filter((ep) => !hiddenSet.has(`${ep.seasonNumber}:${ep.episodeNumber}`))
        : enrichedEpisodes,
    [enrichedEpisodes, hideActive, hiddenSet],
  );

  const [mode, setMode] = useState<"seasons" | "arcs">("seasons");
  const arc = useArcGroups({ tvId, tmdbKey: settings.tmdbKey, enabled: settings.episodeArcGroups });
  const arcActive = settings.episodeArcGroups && arc.hasArcs && mode === "arcs";
  const orderProvider = effectiveOrderProvider(settings);
  const ordering = useEpisodeOrder(
    imdbId,
    meta.id,
    orderProvider,
    settings.tvdbSeasonType,
    settings.tvdbKey,
  );
  const orderTypes = useTvdbSeasonTypes(imdbId, meta.id, settings.tvdbKey, tvdbPanelEnabled(settings));
  const orderTypesEff =
    settings.tmdbKey && orderTypes.length > 0
      ? [...orderTypes, { value: "tmdb", label: "TMDB" }]
      : orderTypes;
  const [orderSeason, setOrderSeason] = useState<number>(-1);
  useEffect(() => {
    setOrderSeason(-1);
  }, [meta.id]);
  const orderActive = !arcActive && ordering != null;
  const panelActive = tvdbPanelEnabled(settings) && (orderActive || orderTypes.length > 0);
  const altActive = arcActive || orderActive;
  const orderSeasonEff =
    ordering && !ordering.seasons.some((s) => s.seasonNumber === orderSeason)
      ? resumeDefaultSeason(meta.id, ordering.seasons, combinedWatched, resumeSeason)
      : orderSeason;
  const source = arcActive ? "arcs" : orderActive ? "order" : "default";
  const arcAvailable = settings.episodeArcGroups && arc.hasArcs;
  const picker = useSeasonArcPicker({
    source,
    arc,
    ordering,
    orderSeasonEff,
    seasons,
    active,
    lastEpisodeAir,
    metaId: meta.id,
    setActive,
    setOrderSeason,
    userPickedRef,
  });
  useEffect(() => {
    let cancelled = false;
    const load = (season: number): Promise<Episode[]> =>
      tmdbSeasonEpisodes(settings.tmdbKey, tvId, season).then((eps) => {
        if (cancelled || eps.length === 0) return [];
        const m = cache.current;
        m.delete(season);
        m.set(season, eps);
        while (m.size > 2) {
          const oldest = m.keys().next().value;
          if (oldest === undefined) break;
          m.delete(oldest);
        }
        return eps;
      });
    const cached = cache.current.get(active);
    if (cached) {
      setEpisodes(cached);
      setLoading(false);
    } else {
      setLoading(true);
      void load(active).then((eps) => {
        if (cancelled) return;
        setEpisodes(eps);
        setLoading(false);
      });
    }
    if (orderActive && orderSeasonEff !== active && !cache.current.has(orderSeasonEff)) {
      void load(orderSeasonEff);
    }
    return () => {
      cancelled = true;
    };
  }, [tvId, active, settings.tmdbKey, orderActive, orderSeasonEff]);
  const orderedEpsRaw: OrderedEpisode[] = arcActive
    ? arc.episodes
    : ordering
      ? ordering.bySeason.get(orderSeasonEff) ?? []
      : [];
  const orderedEps = useMemo(() => {
    // pickLocalizedText keys script tests by ISO-1 ("ko"), not TVDB codes ("kor").
    const lang = tmdbLanguageIso();
    const airedLike =
      orderActive && (settings.tvdbSeasonType === "aired" || settings.tvdbSeasonType === "official");
    const tmdbByKey = new Map<string, Episode>();
    if (airedLike) {
      for (const e of cache.current.get(orderSeasonEff) ?? []) {
        tmdbByKey.set(`${e.seasonNumber}:${e.episodeNumber}`, e);
      }
    }
    return orderedEpsRaw.map((ep) => {
      const tmdbEp = airedLike ? tmdbByKey.get(`${ep.seasonNumber}:${ep.episodeNumber}`) : undefined;
      const pref = preferredVideos.get(`${ep.seasonNumber}:${ep.episodeNumber}`);
      const name =
        pickLocalizedText(
          [
            { text: preferredVideoName(pref), score: PREFERRED_TEXT_SCORE },
            { text: ep.name },
            { text: ep.nameEn ?? "" },
            { text: tmdbEp?.name ?? "" },
          ],
          { forName: true, lang },
        ) ?? ep.name;
      const overview =
        pickLocalizedText(
          [
            { text: preferredVideoOverview(pref), score: PREFERRED_TEXT_SCORE },
            { text: ep.overview },
            { text: ep.overviewEn ?? "" },
            { text: tmdbEp?.overview ?? "" },
          ],
          { lang },
        ) ?? ep.overview;
      let next = { ...ep, name, overview };
      if (ep.imdbRating == null) {
        const r = imdbRatings.get(`${ep.seasonNumber}:${ep.episodeNumber}`);
        if (r != null && r > 0) next = { ...next, imdbRating: r };
      }
      return next;
    });
  }, [
    orderedEpsRaw,
    imdbRatings,
    orderActive,
    orderSeasonEff,
    settings.tvdbSeasonType,
    preferredVideos,
  ]);
  const visibleOrderedEps = useMemo(
    () =>
      hideActive && hiddenSet.size > 0
        ? orderedEps.filter((ep) => !hiddenSet.has(`${ep.seasonNumber}:${ep.episodeNumber}`))
        : orderedEps,
    [orderedEps, hideActive, hiddenSet],
  );
  const orderedLoading = arcActive && arc.loading;

  const activeSeason = seasons.find((s) => s.seasonNumber === active);

  useEffect(() => {
    if (scrolledRef.current) return;
    if (resumeEpisode == null || resumeSeason == null || active !== resumeSeason) return;
    if (loading || enrichedEpisodes.length === 0) return;
    scrolledRef.current = true;
    scrollToDataEp(scrollRef.current, resumeEpisode, { center: true });
  }, [resumeEpisode, resumeSeason, active, loading, enrichedEpisodes.length, scrollRef]);

  const { progressByEp, spoilerFor, allWatched } = useEpisodeProgressMap({
    episodes: enrichedEpisodes,
    metaId: meta.id,
    traktKey,
    traktWatched,
    stremioWatched,
    simklWatched,
    mwVersion,
    settings,
  });
  const markSeason = useMarkSeason({ meta, active, enrichedEpisodes, simklConnected });
  const downloadEpisodes = useMemo(
    () =>
      enrichedEpisodes.map((ep) => ({
        season: ep.seasonNumber,
        episode: ep.episodeNumber,
        name: ep.name || undefined,
        runtime: ep.runtime ?? undefined,
      })),
    [enrichedEpisodes],
  );

  return (
    <div data-episodes className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className="shrink-0 pt-1 text-[22px] font-medium tracking-tight text-ink">{t("Episodes")}</h3>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 xl:gap-2.5">
          <EpisodeDownloadsMenu meta={meta} episodes={downloadEpisodes} />
          <RandomEpisodeButton meta={meta} seasons={seasons} />
          <EpisodeLayoutToggle
            value={settings.episodeLayout}
            onChange={(v) => update({ episodeLayout: v })}
          />
          {settings.episodeHiding && hiddenSet.size > 0 && (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              aria-pressed={showHidden}
              title={showHidden ? t("Hide hidden episodes") : t("Show hidden episodes")}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold tabular-nums transition-colors ${
                showHidden
                  ? "bg-ink text-canvas"
                  : "bg-white/[0.06] text-ink-muted hover:bg-white/[0.10] hover:text-ink"
              }`}
            >
              {showHidden ? <Eye size={14} strokeWidth={2.2} /> : <EyeOff size={14} strokeWidth={2.2} />}
              {hiddenSet.size}
            </button>
          )}
          {!altActive && (
            <EpisodeGridControls
              sort={settings.episodeSort}
              onSort={(s) => update({ episodeSort: s })}
              allWatched={allWatched}
              onMarkSeason={markSeason}
            />
          )}
          <EpisodeSearchToggle
            searchActive={searchOpen || searching}
            aiMode={aiMode}
            aiEnabled={!!(settings.aiSearchKey.trim() || settings.aiGroqKey.trim())}
            aiProvider={aiProvider}
            onSearch={() => {
              setSearchOpen((v) => !v);
              setAiMode(false);
            }}
            onAskAi={() => {
              setAiMode(true);
              setSearchOpen(false);
            }}
          />
          {panelActive ? (
            <TvdbOrderPanel
              items={picker.items}
              activeKey={picker.activeKey}
              onSelect={picker.onSelect}
              orderTypes={orderTypesEff}
              activeType={settings.tvdbSeasonType}
              onSelectType={(v) => update({ tvdbSeasonType: v as typeof settings.tvdbSeasonType })}
            />
          ) : (
            (picker.items.length > 1 || arcAvailable) && (
              <SeasonArcPicker
                items={picker.items}
                activeKey={picker.activeKey}
                onSelect={picker.onSelect}
                mode={arcAvailable ? mode : undefined}
                onModeChange={arcAvailable ? setMode : undefined}
              />
            )
          )}
        </div>
      </div>

      {!aiMode && searchOpen && <EpisodeSearchBar value={epSearch} onChange={setEpSearch} />}

      {aiMode ? (
        <EpisodeAiMode meta={meta} videos={cinemetaVideos} imdbId={imdbId} onExit={() => setAiMode(false)} />
      ) : searching ? (
        <CrossSeasonResults meta={meta} videos={cinemetaVideos} query={epSearch} imdbId={imdbId} />
      ) : (
      <>

      {altActive && (
        <OrderedEpisodes
          meta={meta}
          episodes={visibleOrderedEps}
          loading={orderedLoading}
          traktKey={traktKey}
          traktWatched={traktWatched}
          stremioWatched={stremioWatched}
          simklWatched={simklWatched}
          cinemetaVideos={cinemetaVideos}
          seriesImdbId={imdbId}
          onContextMenu={openWatchedMenu}
        />
      )}

      {!altActive && activeSeason && (activeSeason.airDate || activeSeason.episodeCount > 0) && (
        <p className="text-[13px] text-ink-subtle">
          {activeSeason.episodeCount === 1
            ? t("{n} episode", { n: activeSeason.episodeCount })
            : t("{n} episodes", { n: activeSeason.episodeCount })}
          {activeSeason.airDate && ` · ${activeSeason.airDate.slice(0, 4)}`}
        </p>
      )}

      {!altActive && loading && <EpisodeGridSkeleton />}

      {!altActive && !loading && enrichedEpisodes.length === 0 && (
        <CinemetaFallback meta={meta} videos={cinemetaVideos} season={active} />
      )}

      {!altActive && !loading && enrichedEpisodes.length > 0 && (
        <div key={settings.episodeLayout} className="animate-fade-in">
          {settings.episodeLayout !== "list" ? (
            <EpisodeStrip
              layout={settings.episodeLayout === "grid" ? "grid" : "strip"}
              meta={meta}
              seriesImdbId={imdbId}
              cinemetaVideos={cinemetaVideos}
              episodes={visibleEpisodes}
              progressFor={(ep) =>
                getEpisodeProgress(
                  meta.id,
                  ep.seasonNumber,
                  ep.episodeNumber,
                  ep.runtime,
                  traktKey,
                  traktWatched,
                  stremioWatched,
                  undefined,
                  simklWatched,
                )
              }
              thumbnailFor={(ep) =>
                cinemetaVideos?.find(
                  (v) => v.season === ep.seasonNumber && v.episode === ep.episodeNumber,
                )?.thumbnail
              }
              spoilerFor={(ep) => spoilerFor(ep.episodeNumber)}
              onContextMenu={openWatchedMenu}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {visibleEpisodes.map((ep) => (
                <EpisodeRow
                  key={ep.id}
                  meta={meta}
                  ep={ep}
                  cinemetaThumbnail={
                    cinemetaVideos?.find(
                      (v) => v.season === ep.seasonNumber && v.episode === ep.episodeNumber,
                    )?.thumbnail
                  }
                  cinemetaVideos={cinemetaVideos}
                  seriesImdbId={imdbId}
                  progress={progressByEp.get(ep.episodeNumber)!}
                  spoiler={spoilerFor(ep.episodeNumber)}
                  onContextMenu={openWatchedMenu}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {!altActive && settings.episodeLayout === "list" && (
        <EpisodeJumper scrollRef={scrollRef} totalEpisodes={visibleEpisodes.length} />
      )}
      </>
      )}
      {watchedMenu && (
        <EpisodeWatchedMenu
          metaId={meta.id}
          meta={{ type: "series", name: meta.name, poster: meta.poster, background: meta.background }}
          target={watchedMenu}
          allEpisodes={enrichedEpisodes.map((ep) => ({
            season: ep.seasonNumber,
            episode: ep.episodeNumber,
            released: ep.airDate ?? null,
          }))}
          onClose={() => setWatchedMenu(null)}
        />
      )}
    </div>
  );
}

