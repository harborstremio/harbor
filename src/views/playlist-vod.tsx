import { Film, Search, Tv } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { normalizeArabic } from "@/lib/iptv/rtl";
import { getCachedPlaylist } from "@/lib/iptv/store";
import type { IptvPlaylistSource } from "@/lib/iptv/types";
import { buildVodLibrary, type VodEpisode, type VodMovie, type VodSeries } from "@/lib/iptv/vod";
import { credsFromServer } from "@/lib/iptv/xtream";
import { fetchXtreamSeriesEpisodes } from "@/lib/iptv/xtream-vod";
import { useSettings } from "@/lib/settings";
import { useScrollMemory, useView } from "@/lib/view";
import { SourcePicker } from "./live/source-picker";
import { PlaylistEmpty } from "./live/playlist-empty";
import { useIptvPlaylist } from "./live/hooks/use-iptv-playlist";
import { SeriesDetail } from "./playlist-vod/series-detail";
import { useXtreamVodLibrary } from "./playlist-vod/use-xtream-vod-library";
import { useVodSources } from "./playlist-vod/use-vod-sources";
import { VodCard } from "./playlist-vod/vod-card";

type Tab = "movies" | "series";

const PAGE_SIZE = 60;
const SCROLL_SETTLE_DELAY_MS = 250;

export function PlaylistVodView({ active }: { active: boolean }) {
  const t = useT();
  const { settings } = useSettings();
  const { openPlayer } = useView();
  const { sources, activeId, selectId, addPlaylist, editPlaylist, removePlaylist } =
    useVodSources();

  const activeSource = useMemo<IptvPlaylistSource | null>(
    () => sources.find((s) => s.id === activeId) ?? null,
    [sources, activeId],
  );

  const isXtream = activeSource?.kind === "xtream";
  const { state, refresh: refreshPlaylist } = useIptvPlaylist(
    active && !isXtream ? activeSource : null,
  );
  const xtream = useXtreamVodLibrary(active && isXtream ? activeSource : null);
  const refresh = isXtream ? xtream.refresh : refreshPlaylist;
  const playlist =
    state.kind === "ready" ? state.playlist : getCachedPlaylist(activeSource?.id ?? "");

  const names = useMemo(() => new Map(sources.map((s) => [s.id, s.name] as const)), [sources]);
  const library = useMemo(() => {
    if (isXtream) return xtream.library;
    return playlist ? buildVodLibrary([playlist], names) : { movies: [], series: [] };
  }, [isXtream, names, playlist, xtream.library]);
  const loading = isXtream ? xtream.loading : state.kind === "loading";
  const error = isXtream ? xtream.error : state.kind === "error" ? state.message : null;
  const fetchedAt = isXtream ? xtream.fetchedAt : (playlist?.fetchedAt ?? null);

  const [tab, setTab] = useState<Tab>("movies");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<VodSeries | null>(null);
  const [loadingSeriesId, setLoadingSeriesId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreTimer = useRef<number | null>(null);

  const chooseTab = useCallback((t: Tab) => {
    setTab(t);
    setSelected(null);
  }, []);
  const viewError = isXtream
    ? tab === "movies"
      ? xtream.movieError
      : xtream.seriesError
    : error;
  const tabLoading = isXtream
    ? tab === "movies"
      ? xtream.moviesLoading
      : xtream.seriesLoading
    : loading;
  const providerTotal = isXtream
    ? tab === "movies"
      ? xtream.movieTotal
      : xtream.seriesTotal
    : null;
  const tabItemCount = tab === "movies" ? library.movies.length : library.series.length;

  useEffect(() => {
    setSelected(null);
    setVisibleCount(PAGE_SIZE);
  }, [activeId]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, tab]);

  useEffect(
    () => () => {
      if (loadMoreTimer.current != null) window.clearTimeout(loadMoreTimer.current);
    },
    [],
  );

  const deferredQuery = useDeferredValue(query);
  const q = useMemo(() => normalizeArabic(deferredQuery), [deferredQuery]);
  const movieIndex = useMemo(
    () => library.movies.map((m) => normalizeArabic(m.title)),
    [library.movies],
  );
  const seriesIndex = useMemo(
    () => library.series.map((s) => normalizeArabic(s.title)),
    [library.series],
  );
  const movies = useMemo(
    () => (q ? library.movies.filter((_, i) => movieIndex[i].includes(q)) : library.movies),
    [library.movies, movieIndex, q],
  );
  const series = useMemo(
    () => (q ? library.series.filter((_, i) => seriesIndex[i].includes(q)) : library.series),
    [library.series, seriesIndex, q],
  );
  const visibleMovies = movies.slice(0, visibleCount);
  const visibleSeries = series.slice(0, visibleCount);

  const playMovie = useCallback(
    (m: VodMovie) => {
      openPlayer({
        meta: vodMeta(m.id, "movie", m.title, m.logo, m.year),
        url: m.url,
        title: m.title,
        subtitle: m.year ? String(m.year) : m.playlistName,
        notWebReady: true,
      });
    },
    [openPlayer],
  );

  const playEpisode = useCallback(
    (s: VodSeries, ep: VodEpisode) => {
      openPlayer({
        meta: vodMeta(s.id, "series", s.title, s.logo, null),
        episode: { season: ep.season, episode: ep.episode, name: ep.title },
        url: ep.url,
        title: ep.title,
        subtitle: `${s.title} · S${ep.season} · E${ep.episode}`,
        notWebReady: true,
      });
    },
    [openPlayer],
  );

  const openSeries = useCallback(
    (series: VodSeries) => {
      setSelected(series);
      if (!series.xtreamSeriesId || activeSource?.kind !== "xtream" || !activeSource.xtream) return;
      const creds = credsFromServer(
        activeSource.xtream.server,
        activeSource.xtream.username,
        activeSource.xtream.password,
      );
      if (!creds) return;

      setLoadingSeriesId(series.id);
      void fetchXtreamSeriesEpisodes(creds, activeSource.id, {
        series_id: Number(series.xtreamSeriesId),
        name: series.title,
        cover: series.logo ?? undefined,
        category_id: series.group ?? undefined,
      })
        .then((channels) => {
          const episodes = channels.map((channel) => {
            const match = /S(\d+)E(\d+)$/i.exec(channel.name);
            return {
              season: Number(match?.[1]) || 1,
              episode: Number(match?.[2]) || 0,
              title: channel.attrs["episode-title"] || channel.name,
              url: channel.url,
              logo: channel.logo,
              durationSec: channel.durationSec,
              plot: channel.attrs["episode-plot"] || null,
            };
          });
          const seasons = [...new Set(episodes.map((episode) => episode.season))].sort(
            (a, b) => a - b,
          );
          setSelected((current) =>
            current?.id === series.id ? { ...current, episodes, seasons } : current,
          );
        })
        .catch(() => {})
        .finally(() => setLoadingSeriesId((current) => (current === series.id ? null : current)));
    },
    [activeSource],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollMemory("vod", scrollRef, active);

  if (sources.length === 0) {
    return (
      <main data-rail-flush className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pt-20">
        <PlaylistEmpty onSave={addPlaylist} />
      </main>
    );
  }

  const gridStyle = {
    gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(150 * (settings.posterScale ?? 1))}px, 1fr))`,
  };
  const total = tab === "movies" ? movies.length : series.length;
  const loadMore = () => setVisibleCount((count) => Math.min(count + PAGE_SIZE, total));
  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight >= 420) return;
    if (loadMoreTimer.current != null) window.clearTimeout(loadMoreTimer.current);
    loadMoreTimer.current = window.setTimeout(() => {
      loadMoreTimer.current = null;
      loadMore();
    }, SCROLL_SETTLE_DELAY_MS);
  };

  return (
    <main data-rail-flush className="relative flex min-h-0 flex-1 flex-col pt-20">
      <header className="relative z-40 flex shrink-0 flex-wrap items-center gap-2.5 border-b border-edge-soft/40 bg-surface px-6 py-2.5">
        <SourcePicker
          sources={sources}
          activeId={activeId}
          exportEnabled={false}
          onSelect={selectId}
          onAdd={addPlaylist}
          onEdit={editPlaylist}
          onRemove={removePlaylist}
          onRefresh={refresh}
          onExport={() => {}}
          fetchedAt={fetchedAt}
          channelCount={null}
          loading={loading}
        />
        <div className="flex h-11 items-center gap-0.5 rounded-xl border border-edge-soft/55 bg-elevated p-1">
          <TabButton
            active={tab === "movies"}
            onClick={() => chooseTab("movies")}
            icon={<Film size={14} strokeWidth={2} />}
            label={t("Movies")}
            count={library.movies.length}
          />
          <TabButton
            active={tab === "series"}
            onClick={() => chooseTab("series")}
            icon={<Tv size={14} strokeWidth={2} />}
            label={t("Shows")}
            count={library.series.length}
          />
        </div>
        <div className="flex h-11 flex-1 min-w-[220px] items-center gap-2.5 rounded-xl border border-edge-soft/55 bg-elevated px-3.5">
          <Search size={15} strokeWidth={2} className="text-ink-subtle" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "movies" ? t("Search movies") : t("Search shows")}
            className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              {t("Clear")}
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-6 pt-6 pb-16">
        {viewError && tabItemCount === 0 ? (
          <Notice text={viewError} onRetry={refresh} />
        ) : tabLoading && (tab === "movies" ? movies.length === 0 : series.length === 0) ? (
          <Notice text={t("Loading playlist...")} />
        ) : selected ? (
          <SeriesDetail
            key={`${selected.id}:${selected.seasons.join(",")}`}
            series={selected}
            loading={loadingSeriesId === selected.id}
            onBack={() => setSelected(null)}
            onPlay={(ep) => playEpisode(selected, ep)}
          />
        ) : tab === "movies" ? (
          movies.length === 0 ? (
            <Notice text={emptyMoviesText(t, library.movies.length, q)} />
          ) : (
            <>
              {viewError && <CatalogWarning text={viewError} onRetry={refresh} />}
              <CatalogProgress
                loading={tabLoading}
                loaded={library.movies.length}
                total={providerTotal}
                kind="movies"
              />
              <CapNote shown={visibleMovies.length} total={movies.length} kind="movies" />
              <div className="grid gap-x-4 gap-y-6" style={gridStyle}>
                {visibleMovies.map((m) => (
                  <VodCard
                    key={m.id}
                    kind="movie"
                    title={m.title}
                    year={m.year}
                    logo={m.logo}
                    seed={m.title}
                    onClick={() => playMovie(m)}
                  />
                ))}
              </div>
            </>
          )
        ) : series.length === 0 ? (
          <Notice text={emptyShowsText(t, library.series.length, q)} />
        ) : (
          <>
            {viewError && <CatalogWarning text={viewError} onRetry={refresh} />}
            <CatalogProgress
              loading={tabLoading}
              loaded={library.series.length}
              total={providerTotal}
              kind="shows"
            />
            <CapNote shown={visibleSeries.length} total={series.length} kind="shows" />
            <div className="grid gap-x-4 gap-y-6" style={gridStyle}>
              {visibleSeries.map((s) => (
                <VodCard
                  key={s.id}
                  kind="series"
                  title={s.title}
                  year={null}
                  logo={s.logo}
                  seed={s.title}
                  subtitle={
                    s.xtreamSeriesId
                      ? (s.group ?? t("Open to load episodes"))
                      : s.episodes.length === 1
                        ? t("{n} episode", { n: 1 })
                        : t("{n} episodes", { n: s.episodes.length })
                  }
                  onClick={() => openSeries(s)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function emptyMoviesText(t: Translate, total: number, query: string): string {
  if (query) return t('No movies match "{query}".', { query });
  if (total === 0)
    return t(
      "This playlist has no movies. It may be live channels only, or an Xtream login that exposes movies separately.",
    );
  return t("No movies here.");
}

function emptyShowsText(t: Translate, total: number, query: string): string {
  if (query) return t('No shows match "{query}".', { query });
  if (total === 0)
    return t(
      "This playlist has no shows. It may be live channels only, or an Xtream login that exposes shows separately.",
    );
  return t("No shows here.");
}

function vodMeta(
  id: string,
  type: "movie" | "series",
  name: string,
  logo: string | null,
  year: number | null,
): Meta {
  return {
    id,
    type,
    name,
    poster: logo ?? undefined,
    background: logo ?? undefined,
    releaseInfo: year ? String(year) : undefined,
  };
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-full items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors ${
        active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span
          className={`rounded-full px-1.5 text-[10.5px] tabular-nums ${active ? "bg-canvas/25" : "bg-canvas/70 text-ink-subtle"}`}
        >
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}

function CatalogProgress({
  loading,
  loaded,
  total,
  kind,
}: {
  loading: boolean;
  loaded: number;
  total: number | null;
  kind: "movies" | "shows";
}) {
  const t = useT();
  if (!loading) return null;
  const label =
    total == null
      ? kind === "movies"
        ? t("Loading movies...")
        : t("Loading shows...")
      : kind === "movies"
        ? t("Loaded {loaded} of {total} movies...", {
            loaded: loaded.toLocaleString(),
            total: Math.max(total, loaded).toLocaleString(),
          })
        : t("Loaded {loaded} of {total} shows...", {
            loaded: loaded.toLocaleString(),
            total: Math.max(total, loaded).toLocaleString(),
          });
  return <p className="mb-4 text-[12.5px] tabular-nums text-ink-subtle">{label}</p>;
}

function CatalogWarning({ text, onRetry }: { text: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-elevated px-4 py-3">
      <p className="min-w-0 text-[12.5px] text-ink-muted">{text}</p>
      <button
        onClick={onRetry}
        className="shrink-0 text-[12.5px] font-semibold text-ink transition-colors hover:text-accent"
      >
        {t("Try again")}
      </button>
    </div>
  );
}

function CapNote({
  shown,
  total,
  kind,
}: {
  shown: number;
  total: number;
  kind: "movies" | "shows";
}) {
  const t = useT();
  if (total <= shown) return null;
  const text =
    kind === "movies"
      ? t("Showing {shown} of {total} movies. Scroll to load more.", {
          shown: shown.toLocaleString(),
          total: total.toLocaleString(),
        })
      : t("Showing {shown} of {total} shows. Scroll to load more.", {
          shown: shown.toLocaleString(),
          total: total.toLocaleString(),
        });
  return <p className="mb-4 text-[12.5px] text-ink-subtle">{text}</p>;
}

function Notice({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-edge px-6 py-16 text-center">
      <p className="max-w-[520px] text-[14.5px] leading-relaxed text-ink-muted">{text}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="h-9 rounded-lg bg-elevated px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-raised"
        >
          {t("Try again")}
        </button>
      )}
    </div>
  );
}
