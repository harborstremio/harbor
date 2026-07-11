import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { getCachedPlaylist } from "@/lib/iptv/store";
import type { IptvPlaylistSource } from "@/lib/iptv/types";
import { buildVodLibrary, type VodEpisode, type VodMovie, type VodSeries } from "@/lib/iptv/vod";
import { useSettings } from "@/lib/settings";
import { useScrollMemory, useView } from "@/lib/view";
import { Film, Search, Tv } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIptvPlaylist } from "./live/hooks/use-iptv-playlist";
import { PlaylistEmpty } from "./live/playlist-empty";
import { SourcePicker } from "./live/source-picker";
import { SeriesDetail } from "./playlist-vod/series-detail";
import { useVodSources } from "./playlist-vod/use-vod-sources";
import { VodCard } from "./playlist-vod/vod-card";

type Tab = "movies" | "series";

const RENDER_CAP = 500;

export function PlaylistVodView({ active }: { active: boolean }) {
  const t = useT();
  const { settings } = useSettings();
  const { openPlayer } = useView();
  const { sources, activeId, selectId, addPlaylist, editPlaylist, removePlaylist } = useVodSources();

  const activeSource = useMemo<IptvPlaylistSource | null>(
    () => sources.find((s) => s.id === activeId) ?? null,
    [sources, activeId],
  );

  const { state, refresh } = useIptvPlaylist(active ? activeSource : null);
  const playlist = state.kind === "ready" ? state.playlist : getCachedPlaylist(activeSource?.id ?? "");

  const names = useMemo(() => new Map(sources.map((s) => [s.id, s.name] as const)), [sources]);
  const library = useMemo(
    () => (playlist ? buildVodLibrary([playlist], names) : { movies: [], series: [] }),
    [playlist, names],
  );

  const [tab, setTab] = useState<Tab>("movies");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<VodSeries | null>(null);

  const chooseTab = useCallback((t: Tab) => {
    setTab(t);
    setSelected(null);
  }, []);

  useEffect(() => {
    setSelected(null);
  }, [activeId]);

  const q = query.trim().toLowerCase();
  const movies = useMemo(
    () => (q ? library.movies.filter((m) => m.title.toLowerCase().includes(q)) : library.movies),
    [library.movies, q],
  );
  const series = useMemo(
    () => (q ? library.series.filter((s) => s.title.toLowerCase().includes(q)) : library.series),
    [library.series, q],
  );

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

  return (
    <main data-rail-flush className="relative flex min-h-0 flex-1 flex-col pt-20">
      <header className="relative z-[40] flex shrink-0 flex-wrap items-center gap-2.5 border-b border-edge-soft/40 bg-surface px-6 py-2.5">
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
          fetchedAt={playlist?.fetchedAt ?? null}
          channelCount={null}
          loading={state.kind === "loading"}
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-6 pb-16">
        {state.kind === "error" ? (
          <Notice text={state.message} onRetry={refresh} />
        ) : state.kind === "loading" && !playlist ? (
          <Notice text={t("Loading playlist...")} />
        ) : selected ? (
          <SeriesDetail series={selected} onBack={() => setSelected(null)} onPlay={(ep) => playEpisode(selected, ep)} />
        ) : tab === "movies" ? (
          movies.length === 0 ? (
            <Notice text={emptyMoviesText(t, library.movies.length, q)} />
          ) : (
            <>
              <CapNote shown={Math.min(movies.length, RENDER_CAP)} total={movies.length} kind="movies" />
              <div className="grid gap-x-4 gap-y-6" style={gridStyle}>
                {movies.slice(0, RENDER_CAP).map((m) => (
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
            <CapNote shown={Math.min(series.length, RENDER_CAP)} total={series.length} kind="shows" />
            <div className="grid gap-x-4 gap-y-6" style={gridStyle}>
              {series.slice(0, RENDER_CAP).map((s) => (
                <VodCard
                  key={s.id}
                  kind="series"
                  title={s.title}
                  year={null}
                  logo={s.logo}
                  seed={s.title}
                  subtitle={
                    s.episodes.length === 1 ? t("{n} episode", { n: 1 }) : t("{n} episodes", { n: s.episodes.length })
                  }
                  onClick={() => setSelected(s)}
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

function vodMeta(id: string, type: "movie" | "series", name: string, logo: string | null, year: number | null): Meta {
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

function CapNote({ shown, total, kind }: { shown: number; total: number; kind: "movies" | "shows" }) {
  const t = useT();
  if (total <= shown) return null;
  const text =
    kind === "movies"
      ? t("Showing {shown} of {total} movies. Search to find the rest.", {
          shown: shown.toLocaleString(),
          total: total.toLocaleString(),
        })
      : t("Showing {shown} of {total} shows. Search to find the rest.", {
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
