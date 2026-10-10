import { Check, ChevronDown } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Meta } from "@/lib/cinemeta";
import { EpisodeWatchedMenu, type WatchedMenuTarget } from "@/components/episode-watched-menu";
import {
  manualEpisodeKeys,
  manualWatchedState,
  manualWatchedVersion,
  subscribeManualWatched,
} from "@/lib/manual-watched";
import { Poster } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { useLocalAwareSeriesPlay } from "@/lib/local-library/use-series-play";
import { useT } from "@/lib/i18n";
import { EpisodeDownloadButton } from "./episode-download-button";
import { resumeDefaultSeason } from "@/lib/episode-progress";
import { DragStrip } from "@/components/drag-strip";
import { EpisodeGrid } from "./episode-grid";
import { EpisodeGridCard } from "./episode-grid-card";
import type { GridEpisode, Progress } from "./episode-grid-types";
import { EpisodeLayoutToggle } from "./episode-layout-toggle";
import { isUpcomingDate } from "./helpers";
import { SeasonStepper } from "./season-stepper";
import { useEpisodeAutoScroll, type AutoScrollTarget } from "./use-episode-auto-scroll";
import {
  episodeNumber,
  episodeSeason,
  groupEpisodes,
  NO_SEASON,
  type CinemetaVideo,
} from "./episode-groups";

type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function CinemetaEpisodes({
  meta,
  videos,
  stremioWatched,
  resumeSeason,
  scrollRef,
}: {
  meta: Meta;
  videos: NonNullable<Meta["videos"]>;
  stremioWatched?: Set<string>;
  resumeSeason?: number;
  scrollRef: React.RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const playLocalAware = useLocalAwareSeriesPlay();
  const mwVersion = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const [watchedMenu, setWatchedMenu] = useState<WatchedMenuTarget | null>(null);
  const openWatchedMenu = (
    e: React.MouseEvent,
    season: number,
    episode: number,
    watched: boolean,
  ) => {
    e.preventDefault();
    setWatchedMenu({ x: e.clientX, y: e.clientY, season, episode, watched });
  };
  const grouped = useMemo(() => groupEpisodes(videos), [videos]);
  const combinedWatched = useMemo(() => {
    const watched = new Set(stremioWatched ?? []);
    const manual = manualEpisodeKeys(meta.id);

    for (const key of manual.watched) watched.add(key);
    for (const key of manual.unwatched) watched.delete(key);

    return watched;
  }, [meta.id, stremioWatched, mwVersion]);
  const seasonStats = useMemo(
    () =>
      grouped.map((group) => ({
        seasonNumber: group.seasonNumber,
        episodeCount: group.episodes.length,
      })),
    [grouped],
  );

  const allEpisodesOrdered = useMemo(
    () =>
      grouped.flatMap((g) =>
        g.episodes.map((ep, i) => ({
          season: ep.season ?? 0,
          episode: ep.episode ?? ep.number ?? (ep.season == null ? i + 1 : 1),
          released: ep.released ?? null,
        })),
      ),
    [grouped],
  );

  const [active, setActive] = useState<number>(() =>
    resumeDefaultSeason(meta.id, seasonStats, combinedWatched, resumeSeason),
  );
  const userPickedRef = useRef(false);

  useEffect(() => {
    userPickedRef.current = false;
  }, [meta.id]);

  useEffect(() => {
    if (userPickedRef.current) return;
    setActive(resumeDefaultSeason(meta.id, seasonStats, combinedWatched, resumeSeason));
  }, [meta.id, seasonStats, combinedWatched, resumeSeason]);

  const activeEps = grouped.find((g) => g.seasonNumber === active)?.episodes ?? [];

  const watchedAt = (season: number, number: number): boolean => {
    const st = manualWatchedState(meta.id, season, number);
    return st === true || (st === undefined && (stremioWatched?.has(`${season}:${number}`) ?? false));
  };

  const autoScrollTarget = useMemo<AutoScrollTarget>(() => {
    const idx = activeEps.findIndex(
      (ep, i) => !watchedAt(episodeSeason(ep), episodeNumber(ep, i)),
    );
    if (idx < 0) return null;
    return { episode: episodeNumber(activeEps[idx], idx), first: idx === 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEps, meta.id, stremioWatched, mwVersion]);
  const markPicked = useEpisodeAutoScroll({
    scrollRef,
    scopeKey: meta.id,
    seasonKey: String(active),
    target: autoScrollTarget,
    ready: activeEps.length > 0,
  });
  const selectSeason = (n: number) => {
    markPicked();
    userPickedRef.current = true;
    setActive(n);
  };
  const seasonNumbers = grouped.map((g) => g.seasonNumber);

  const progressFor = (g: GridEpisode): Progress => ({
    ratio: 0,
    watched: watchedAt(g.season, g.number),
    startedAt: 0,
  });

  // The grid and the strip read the same model; only the list walks the raw videos, because it
  // shows a description the card layouts would clip away.
  const gridEpisodes = useMemo<GridEpisode[]>(
    () =>
      activeEps.map((ep, i) => {
        const season = episodeSeason(ep);
        const number = episodeNumber(ep, i);
        const stills = ep.thumbnail ? [ep.thumbnail] : [];
        const overview = ep.overview ?? ep.description;
        const airDate = ep.released ?? null;
        const runtime = ep.runtime ?? null;
        return {
          key: `${meta.id}:${season}:${number}`,
          number,
          season,
          title: ep.name || ep.title || t("Episode {n}", { n: number }),
          stills,
          runtime,
          airDate,
          overview,
          upcoming: isUpcomingDate(airDate),
          play: (opts) =>
            playLocalAware({
              meta,
              episode: {
                season,
                episode: number,
                videoId: ep.id || undefined,
                runtime: runtime ?? undefined,
                name: ep.name || ep.title || undefined,
                still: stills[0],
                overview,
              },
              opts: {
                autoPlay: settings.instantPlay || settings.seasonSourceLock,
                resume: opts?.resume,
              },
            }),
        };
      }),
    [
      activeEps,
      meta,
      t,
      playLocalAware,
      settings.instantPlay,
      settings.seasonSourceLock,
    ],
  );

  if (grouped.length === 0) return null;

  return (
    <div data-episodes className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex items-end justify-between gap-6">
        <h3 className="text-[22px] font-medium tracking-tight text-ink">{t("Episodes")}</h3>
        <div className="flex items-center gap-3">
          {grouped.length > 1 && (
            <SeasonStepper
              keys={seasonNumbers.filter((n) => n > 0).map(String)}
              activeKey={String(active)}
              onSelect={(k) => selectSeason(Number(k))}
            >
              <SeasonDropdown seasons={seasonNumbers} active={active} onChange={selectSeason} />
            </SeasonStepper>
          )}
          <EpisodeLayoutToggle
            value={settings.episodeLayout}
            onChange={(v) => update({ episodeLayout: v })}
          />
        </div>
      </div>
      <p className="text-[13px] text-ink-subtle">
        {activeEps.length === 1
          ? t("{n} episode", { n: activeEps.length })
          : t("{n} episodes", { n: activeEps.length })}
      </p>
      <div key={settings.episodeLayout} className="animate-fade-in">
        {settings.episodeLayout === "grid" ? (
          <EpisodeGrid
            meta={meta}
            episodes={gridEpisodes}
            progressFor={progressFor}
            onContextMenu={openWatchedMenu}
          />
        ) : settings.episodeLayout === "strip" ? (
          <DragStrip itemCount={gridEpisodes.length}>
            {gridEpisodes.map((g) => (
              <div
                key={g.key}
                className="shrink-0"
                style={{ width: Math.round(244 * (settings.episodeCardScale || 1)) }}
              >
                <EpisodeGridCard
                  meta={meta}
                  g={g}
                  progress={progressFor(g)}
                  onContextMenu={openWatchedMenu}
                />
              </div>
            ))}
          </DragStrip>
        ) : (
          <div className="flex flex-col gap-1">
            {activeEps.map((ep, i) => {
              const season = episodeSeason(ep);
              const epNumber = episodeNumber(ep, i);
              return (
                <CinemetaEpisodeRow
                  key={ep.id ?? `${ep.season ?? "x"}-${ep.episode ?? i}`}
                  meta={meta}
                  ep={ep}
                  flatIndex={ep.season == null ? i + 1 : undefined}
                  watched={watchedAt(season, epNumber)}
                  onContextMenu={openWatchedMenu}
                />
              );
            })}
          </div>
        )}
      </div>
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
          allEpisodes={allEpisodesOrdered}
          onClose={() => setWatchedMenu(null)}
        />
      )}
    </div>
  );
}

export function CinemetaEpisodeRow({
  meta,
  ep,
  flatIndex,
  watched = false,
  onContextMenu,
}: {
  meta: Meta;
  ep: CinemetaVideo;
  flatIndex?: number;
  watched?: boolean;
  onContextMenu?: (e: React.MouseEvent, season: number, episode: number, watched: boolean) => void;
}) {
  const t = useT();
  const playLocalAware = useLocalAwareSeriesPlay();
  const { settings } = useSettings();
  const aired = ep.released ?? ep.firstAired ?? null;
  const epNumber = ep.episode ?? ep.number ?? flatIndex ?? 1;
  const season = ep.season ?? 0;
  const runtime = ep.runtime ?? null;
  const playEpisode = {
    season: ep.season ?? 0,
    episode: epNumber,
    runtime: runtime ?? undefined,
    name: ep.name || ep.title || undefined,
    videoId: ep.id || undefined,
    still: ep.thumbnail || undefined,
    overview: ep.overview ?? ep.description,
  };
  return (
    <div
      data-ep={epNumber}
      data-no-card-ring
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, season, epNumber, watched) : undefined}
      className="group flex items-center gap-4 rounded-lg px-4 py-5 transition-colors hover:bg-elevated/30"
    >
      <button
        onClick={() =>
          playLocalAware({
            meta,
            episode: playEpisode,
            opts: { autoPlay: settings.instantPlay || settings.seasonSourceLock },
          })
        }
        className="flex min-w-0 flex-1 gap-6 text-start"
      >
        <div className="relative w-[200px] shrink-0 overflow-hidden rounded-lg">
          <Poster
            src={ep.thumbnail}
            seed={ep.id ?? `${meta.id}-${ep.season}-${epNumber}`}
            ratio="landscape"
            lazy
          />
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/40 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
              <Play size={18} fill="currentColor" />
            </div>
          </div>
          {ep.season != null && (
            <span className="absolute start-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
              {epNumber}
            </span>
          )}
          {watched && (
            <span className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-canvas shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              <Check size={13} strokeWidth={3} />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h4 className="truncate text-[16px] font-semibold text-ink">
            {ep.name || ep.title || formatAired(aired) || t("Episode {n}", { n: epNumber })}
          </h4>
          <p className="text-[12px] text-ink-subtle">
            {[
              ep.season != null ? `S${ep.season} E${epNumber}` : null,
              runtime ? t("{n} min", { n: runtime }) : null,
              formatAired(aired),
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
          {(ep.overview ?? ep.description) && (
            <p className="line-clamp-2 text-[13.5px] leading-relaxed text-ink-muted">
              {ep.overview ?? ep.description}
            </p>
          )}
        </div>
      </button>
      <EpisodeDownloadButton meta={meta} episode={playEpisode} />
    </div>
  );
}

function SeasonDropdown({
  seasons,
  active,
  onChange,
}: {
  seasons: number[];
  active: number;
  onChange: (n: number) => void;
}) {
  const t = useT();
  const [menu, setMenu] = useState<{
    right: number;
    top?: number;
    bottom?: number;
    maxH: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = menu != null;

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 16;
    const below = window.innerHeight - r.bottom - margin;
    const above = r.top - margin;
    const up = below < 240 && above > below;
    const maxH = Math.max(160, Math.min(0.6 * window.innerHeight, up ? above : below));
    const right = Math.max(margin, window.innerWidth - r.right);
    setMenu(
      up
        ? { right, bottom: window.innerHeight - r.top + 8, maxH }
        : { right, top: r.bottom + 8, maxH },
    );
  };

  return (
    <>
      <button
        ref={btnRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => (menu ? setMenu(null) : openMenu())}
        className="flex h-10 items-center gap-2 rounded-full bg-white/[0.06] ps-4 pe-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-white/[0.10]"
      >
        <span>{seasonLabel(t, active)}</span>
        <ChevronDown
          size={15}
          className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ right: menu.right, top: menu.top, bottom: menu.bottom }}
            className="animate-fade-in fixed z-[200] w-44 overflow-hidden rounded-lg border border-edge bg-elevated py-1.5 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.6)]"
          >
            <div className="overflow-y-auto" style={{ maxHeight: menu.maxH }}>
              {seasons.map((s) => {
                const isActive = s === active;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      onChange(s);
                      setMenu(null);
                    }}
                    className={`flex w-full items-center px-4 py-2.5 text-start text-[13.5px] transition-colors ${
                      isActive
                        ? "bg-ink/10 text-ink"
                        : "text-ink-muted hover:bg-raised hover:text-ink"
                    }`}
                  >
                    {seasonLabel(t, s)}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function seasonLabel(t: Translator, n: number): string {
  if (n === 0) return t("Specials");
  if (n === NO_SEASON) return t("No Season");
  return t("Season {n}", { n });
}

function formatAired(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
