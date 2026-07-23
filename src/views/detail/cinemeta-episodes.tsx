import { Check, ChevronDown, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Meta } from "@/lib/cinemeta";
import { EpisodeWatchedMenu, type WatchedMenuTarget } from "@/components/episode-watched-menu";
import {
  manualWatchedState,
  manualWatchedVersion,
  subscribeManualWatched,
} from "@/lib/manual-watched";
import { getLastSeason, setLastSeason } from "@/lib/last-season";
import { lastPlayedEpisode } from "@/lib/resume";
import { Poster } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { useLocalAwareSeriesPlay } from "@/lib/local-library/use-series-play";
import { useT } from "@/lib/i18n";
import { EpisodeDownloadButton } from "./episode-download-button";

type Translator = (key: string, vars?: Record<string, string | number>) => string;

type CinemetaVideo = NonNullable<Meta["videos"]>[number];

function pickDefaultSeason(metaId: string, seasons: number[]): number {
  const has = (n: number) => seasons.includes(n);
  const saved = getLastSeason(metaId);
  if (saved != null && has(saved)) return saved;
  const lp = lastPlayedEpisode(metaId);
  if (lp && has(lp.season)) return lp.season;
  const real = seasons.filter((s) => s > 0);
  return real[real.length - 1] ?? seasons[seasons.length - 1] ?? 1;
}

export function CinemetaEpisodes({
  meta,
  videos,
}: {
  meta: Meta;
  videos: NonNullable<Meta["videos"]>;
}) {
  const t = useT();
  useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
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
  const grouped = useMemo(() => {
    const map = new Map<number, CinemetaVideo[]>();
    const flat: CinemetaVideo[] = [];
    for (const v of videos) {
      if (v.season == null || (v.episode ?? v.number) == null) {
        flat.push(v);
        continue;
      }
      const arr = map.get(v.season) ?? [];
      arr.push(v);
      map.set(v.season, arr);
    }
    const numbered = Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([s, eps]) => ({
        seasonNumber: s,
        episodes: eps
          .slice()
          .sort((a, b) => (a.episode ?? a.number ?? 0) - (b.episode ?? b.number ?? 0)),
      }));
    if (flat.length > 0 && numbered.length === 0) {
      flat.sort((a, b) => (a.released ?? "").localeCompare(b.released ?? ""));
      return [{ seasonNumber: -1, episodes: flat }];
    }
    return numbered;
  }, [videos]);

  const allEpisodesOrdered = useMemo(
    () =>
      grouped.flatMap((g) =>
        g.episodes.map((ep, i) => ({
          season: ep.season ?? 0,
          episode: ep.episode ?? ep.number ?? (ep.season == null ? i + 1 : 1),
        })),
      ),
    [grouped],
  );

  const [active, setActive] = useState<number>(() =>
    pickDefaultSeason(
      meta.id,
      grouped.map((g) => g.seasonNumber),
    ),
  );
  const userPickedRef = useRef(false);

  useEffect(() => {
    userPickedRef.current = false;
  }, [meta.id]);

  useEffect(() => {
    if (userPickedRef.current) return;
    setActive(
      pickDefaultSeason(
        meta.id,
        grouped.map((g) => g.seasonNumber),
      ),
    );
  }, [meta.id, grouped.length]);

  if (grouped.length === 0) return null;
  const activeEps = grouped.find((g) => g.seasonNumber === active)?.episodes ?? [];

  return (
    <div data-episodes className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex items-center gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="shrink-0 text-[22px] font-medium tracking-tight text-ink">
            {t("Episodes")}
          </h3>
          {grouped.length > 1 && (
            <SeasonDropdown
              seasons={grouped.map((g) => g.seasonNumber)}
              active={active}
              onChange={(n) => {
                userPickedRef.current = true;
                setLastSeason(meta.id, n);
                setActive(n);
              }}
            />
          )}
        </div>
      </div>
      <p className="text-[13px] text-ink-subtle">
        {activeEps.length === 1
          ? t("{n} episode", { n: activeEps.length })
          : t("{n} episodes", { n: activeEps.length })}
      </p>
      <div className="flex flex-col gap-1">
        {activeEps.map((ep, i) => {
          const season = ep.season ?? 0;
          const epNumber = ep.episode ?? ep.number ?? (ep.season == null ? i + 1 : 1);
          return (
            <CinemetaEpisodeRow
              key={ep.id ?? `${ep.season ?? "x"}-${ep.episode ?? i}`}
              meta={meta}
              ep={ep}
              flatIndex={ep.season == null ? i + 1 : undefined}
              watched={manualWatchedState(meta.id, season, epNumber) === true}
              onContextMenu={openWatchedMenu}
            />
          );
        })}
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
  const playEpisode = {
    season: ep.season ?? 0,
    episode: epNumber,
    name: ep.name || ep.title || undefined,
    videoId: ep.id || undefined,
    still: ep.thumbnail || undefined,
    overview: undefined,
  };
  return (
    <div
      data-no-card-ring
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, season, epNumber, watched) : undefined}
      className="group flex items-center gap-4 rounded-2xl px-4 py-5 transition-colors hover:bg-elevated/30"
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
            {[ep.season != null ? `S${ep.season} E${epNumber}` : null, formatAired(aired)]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
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
        className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-canvas/90 ps-4 pe-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-canvas"
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
            className="animate-fade-in fixed z-[200] w-44 overflow-hidden rounded-2xl border border-edge-soft bg-canvas py-1.5 shadow-2xl"
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
                        : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
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
  if (n === -1) return t("Videos");
  return t("Season {n}", { n });
}

function formatAired(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
