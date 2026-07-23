import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EpisodeJumper } from "@/components/episode-jumper";
import { providerForModel } from "@/lib/ai-models";
import { CrossSeasonResults } from "./series-episodes/cross-season-results";
import { CinemetaFallback } from "./series-episodes/cinemeta-fallback";
import { EpisodeAiMode } from "./series-episodes/episode-ai-mode";
import { EpisodeSearchBar, EpisodeSearchToggle } from "./series-episodes/episode-search-controls";
import { EpisodeWatchedMenu, type WatchedMenuTarget } from "@/components/episode-watched-menu";
import { manualWatchedVersion, subscribeManualWatched } from "@/lib/manual-watched";
import type { Meta } from "@/lib/cinemeta";
import { getEpisodeProgress, resumeDefaultSeason } from "@/lib/episode-progress";
import { scrollToDataEp } from "@/lib/episode-scroll";
import { tmdbSeasonEpisodes, type Episode, type Season } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useTrakt } from "@/lib/trakt/provider";
import { useSimkl } from "@/lib/simkl/provider";
import { useT } from "@/lib/i18n";
import { EpisodeGridControls } from "./episode-grid-controls";
import { EpisodeLayoutToggle } from "./episode-layout-toggle";
import { EpisodeRow } from "./series-episode-row";
import { EpisodeGridSkeleton } from "./episode-grid-skeleton";
import { EpisodeStrip } from "./episode-strip";
import { RandomEpisodeButton } from "./random-episode-button";
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
    return s;
  }, [stremioWatched, simklWatched, traktWatched]);
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
      console.debug(
        `[season-default] ${meta.id} pick=${def} hint=${resumeSeason} [${counts.join(", ")}]`,
      );
    }
    setActive(def);
  }, [meta.id, seasons, combinedWatched, resumeSeason]);

  useEffect(() => {
    let cancelled = false;
    const cached = cache.current.get(active);
    if (cached) {
      setEpisodes(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    tmdbSeasonEpisodes(settings.tmdbKey, tvId, active).then((eps) => {
      if (cancelled) return;
      if (eps.length > 0) {
        const m = cache.current;
        m.delete(active);
        m.set(active, eps);
        while (m.size > 2) {
          const oldest = m.keys().next().value;
          if (oldest === undefined) break;
          m.delete(oldest);
        }
      }
      setEpisodes(eps);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tvId, active, settings.tmdbKey]);

  const enrichedBase = useEpisodeEnrich({
    episodes,
    active,
    imdbId,
    tvdbKey: settings.tvdbKey,
    omdbKey: settings.omdbKey,
  });
  const tvdbStills = useSeriesTvdbStills(imdbId, enrichedBase.length, settings.tvdbSeasonType);
  const enrichedEpisodes = useMemo(() => {
    if (Object.keys(tvdbStills).length === 0) return enrichedBase;
    return enrichedBase.map((ep) => {
      if (ep.stillPath || ep.stillUrl) return ep;
      const img =
        tvdbStills[`s${ep.seasonNumber}e${ep.episodeNumber}`] ??
        tvdbStills[`abs${ep.episodeNumber}`];
      return img ? { ...ep, stillUrl: img } : ep;
    });
  }, [enrichedBase, tvdbStills]);

  const [mode, setMode] = useState<"seasons" | "arcs">("seasons");
  const arc = useArcGroups({ tvId, tmdbKey: settings.tmdbKey, enabled: settings.episodeArcGroups });
  const arcActive = settings.episodeArcGroups && arc.hasArcs && mode === "arcs";
  const orderProvider = settings.tvdbOrderPanel ? "tvdb" : settings.episodeOrderProvider;
  const ordering = useEpisodeOrder(
    imdbId,
    meta.id,
    orderProvider,
    settings.tvdbSeasonType,
    settings.tvdbKey,
  );
  const orderTypes = useTvdbSeasonTypes(
    imdbId,
    meta.id,
    settings.tvdbKey,
    settings.tvdbOrderPanel && ordering != null,
  );
  const [orderSeason, setOrderSeason] = useState<number>(-1);
  useEffect(() => {
    setOrderSeason(-1);
  }, [meta.id]);
  const orderActive = !arcActive && ordering != null;
  const panelActive = settings.tvdbOrderPanel && orderActive;
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
  const orderedEps = arcActive
    ? arc.episodes
    : ordering
      ? (ordering.bySeason.get(orderSeasonEff) ?? [])
      : [];
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

  return (
    <div data-episodes className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="shrink-0 text-[22px] font-medium tracking-tight text-ink">
            {t("Episodes")}
          </h3>
          {panelActive ? (
            <TvdbOrderPanel
              items={picker.items}
              activeKey={picker.activeKey}
              onSelect={picker.onSelect}
              orderTypes={orderTypes}
              activeType={settings.tvdbSeasonType}
              onSelectType={(v) => update({ tvdbSeasonType: v })}
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
        <div className="flex items-center gap-2.5">
          <RandomEpisodeButton meta={meta} seasons={seasons} />
          <EpisodeLayoutToggle
            value={settings.episodeLayout}
            onChange={(v) => update({ episodeLayout: v })}
          />
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
            aiEnabled={!!settings.aiSearchKey.trim()}
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
        </div>
      </div>

      {!aiMode && searchOpen && <EpisodeSearchBar value={epSearch} onChange={setEpSearch} />}

      {aiMode ? (
        <EpisodeAiMode
          meta={meta}
          videos={cinemetaVideos}
          imdbId={imdbId}
          onExit={() => setAiMode(false)}
        />
      ) : searching ? (
        <CrossSeasonResults meta={meta} videos={cinemetaVideos} query={epSearch} imdbId={imdbId} />
      ) : (
        <>
          {altActive && (
            <OrderedEpisodes
              meta={meta}
              episodes={orderedEps}
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

          {!altActive &&
            activeSeason &&
            (activeSeason.airDate || activeSeason.episodeCount > 0) && (
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
                  episodes={enrichedEpisodes}
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
                  {enrichedEpisodes.map((ep) => (
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
            <EpisodeJumper scrollRef={scrollRef} totalEpisodes={enrichedEpisodes.length} />
          )}
        </>
      )}
      {watchedMenu && (
        <EpisodeWatchedMenu
          metaId={meta.id}
          meta={{
            type: "series",
            name: meta.name,
            poster: meta.poster,
            background: meta.background,
          }}
          target={watchedMenu}
          onClose={() => setWatchedMenu(null)}
        />
      )}
    </div>
  );
}
