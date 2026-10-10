import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { Poster } from "@/components/poster";
import { daysFromTodayLocal, formatAirDate } from "@/lib/dates";
import { tmdbSeasonEpisodes, type Episode, type TmdbDetail } from "@/lib/providers/tmdb";
import { useEpisodeOrder } from "@/views/detail/series-episodes/use-episode-order";
import { useTvdbSeasonTypes } from "@/views/detail/series-episodes/use-tvdb-season-types";
import { useSettings } from "@/lib/settings";
import { effectiveOrderProvider } from "@/lib/settings/episode-order";
import { t as translate, useT, useUiLanguage } from "@/lib/i18n";
import { getViewedSeason, setViewedSeason } from "@/lib/season-view-pref";
import { useMobileRemote } from "../mobile-remote";
import {
  HIDE_SCROLL,
  prefersReducedMotion,
  stillFrom,
  tmdbTvId,
  type Ep,
  type SeasonOption,
} from "./data";
import { Line, SectionTitle } from "./ui";
import { OrderStyleSwitch, type OrderOption } from "./order-switch";

type SeasonEntry = SeasonOption & { badge?: string };

const isUpcoming = (date?: string | null): boolean => {
  const d = daysFromTodayLocal(date);
  return d != null && d > 0;
};

function seasonTypeBadge(seasonNumber: number, label: string): string | undefined {
  const n = label.toLowerCase();
  if (/\bo[vn]a\b/.test(n)) return "OVA";
  if (/movie|film/.test(n)) return "Movie";
  if (seasonNumber <= 0 || /special/.test(n)) return "Special";
  return undefined;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-[5px] border border-edge-soft bg-elevated/40 px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
      {children}
    </span>
  );
}

export function EpisodeSection({
  meta,
  full,
  detail,
  tmdbKey,
  seasons,
  onPlay,
}: {
  meta: Meta;
  full: Meta | null;
  detail: TmdbDetail | null;
  tmdbKey: string;
  seasons: number[];
  onPlay: (ep: Ep) => void;
}) {
  const t = useT();
  const language = useUiLanguage();
  const { settings } = useSettings();
  const { snapshot } = useMobileRemote();
  const tvdbKey = settings.tvdbKey || snapshot.tvdbKey || "";
  const imdbId = detail?.imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);

  const settingsProvider = effectiveOrderProvider(settings);
  const [override, setOverride] = useState<{
    provider: "default" | "tvdb";
    seasonType: string;
  } | null>(null);
  useEffect(() => {
    setOverride(null);
  }, [meta.id]);
  const effProvider = override?.provider ?? settingsProvider;
  const effSeasonType = override?.seasonType ?? settings.tvdbSeasonType;

  const ordering = useEpisodeOrder(imdbId, meta.id, effProvider, effSeasonType, tvdbKey);

  const orderTypes = useTvdbSeasonTypes(imdbId, meta.id, tvdbKey, !!tvdbKey);
  const orderOptions = useMemo<OrderOption[]>(() => {
    if (orderTypes.length === 0) return [];
    const base: OrderOption[] = orderTypes.map((o) => ({ value: o.value, label: o.label }));
    return settings.tmdbKey ? [...base, { value: "tmdb", label: "TMDB" }] : base;
  }, [orderTypes, settings.tmdbKey]);
  const activeOrder = effProvider === "tvdb" && effSeasonType !== "tmdb" ? effSeasonType : "tmdb";
  const pickOrder = (value: string) => {
    if (value === "tmdb") setOverride({ provider: "default", seasonType: "tmdb" });
    else setOverride({ provider: "tvdb", seasonType: value });
  };

  const seasonOptions = useMemo<SeasonEntry[]>(() => {
    if (ordering) {
      return ordering.seasons
        .filter((s) => s.seasonNumber >= 1)
        .map((s) => {
          const label =
            s.name && s.name.trim()
              ? s.name
              : translate("Season {number}", { number: s.seasonNumber });
          return { number: s.seasonNumber, label, badge: seasonTypeBadge(s.seasonNumber, label) };
        });
    }
    return seasons.map((n) => ({ number: n, label: translate("Season {number}", { number: n }) }));
  }, [ordering, seasons, language]);

  const [season, setSeason] = useState<number>(() => {
    const v = getViewedSeason(meta.id);
    return v != null && seasonOptions.some((o) => o.number === v)
      ? v
      : (seasonOptions[0]?.number ?? 1);
  });
  useEffect(() => {
    setSeason((s) =>
      seasonOptions.some((o) => o.number === s) ? s : (seasonOptions[0]?.number ?? 1),
    );
  }, [seasonOptions]);
  const pickSeason = (n: number) => {
    setViewedSeason(meta.id, n);
    setSeason(n);
  };

  const tvId = tmdbTvId(meta, detail);
  const [tmdbEps, setTmdbEps] = useState<Episode[]>([]);
  const [loadingEps, setLoadingEps] = useState(false);
  useEffect(() => {
    setTmdbEps([]);
    if (ordering) {
      setLoadingEps(false);
      return;
    }
    if (!tmdbKey || tvId == null) return;
    let alive = true;
    setLoadingEps(true);
    tmdbSeasonEpisodes(tmdbKey, tvId, season)
      .then((eps) => {
        if (!alive) return;
        setTmdbEps(eps);
        setLoadingEps(false);
      })
      .catch(() => {
        if (alive) setLoadingEps(false);
      });
    return () => {
      alive = false;
    };
  }, [ordering, tmdbKey, tvId, season]);

  const episodes = useMemo<Ep[]>(() => {
    if (ordering) {
      return (ordering.bySeason.get(season) ?? []).map((e) => ({
        season: e.seasonNumber,
        episode: e.episodeNumber,
        name: e.name || undefined,
        still: stillFrom(e.stillPath, e.stillUrl),
        overview: e.overview || undefined,
        runtime: e.runtime,
        airDate: e.airDate,
      }));
    }
    const byNum = new Map<number, Ep>();
    for (const v of full?.videos ?? []) {
      if (v.season !== season || typeof v.episode !== "number") continue;
      byNum.set(v.episode, {
        season,
        episode: v.episode,
        name: v.name || v.title,
        still: v.thumbnail,
        overview: v.overview || v.description,
        airDate: v.released || v.firstAired,
      });
    }
    for (const e of tmdbEps) {
      const prev = byNum.get(e.episodeNumber);
      byNum.set(e.episodeNumber, {
        season,
        episode: e.episodeNumber,
        name: prev?.name || e.name || undefined,
        still: prev?.still || stillFrom(e.stillPath, e.stillUrl),
        overview: prev?.overview || e.overview || undefined,
        runtime: e.runtime,
        airDate: prev?.airDate || e.airDate,
      });
    }
    return [...byNum.values()].sort((a, b) => a.episode - b.episode);
  }, [ordering, season, full?.videos, tmdbEps]);

  if (seasonOptions.length === 0) return null;

  const activeLabel =
    seasonOptions.find((o) => o.number === season)?.label ??
    t("Season {number}", { number: season });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>{t("Episodes")}</SectionTitle>
        {seasonOptions.length > 1 && (
          <SeasonPicker
            options={seasonOptions}
            value={season}
            label={activeLabel}
            onChange={pickSeason}
          />
        )}
      </div>
      {orderOptions.length > 1 && (
        <OrderStyleSwitch options={orderOptions} active={activeOrder} onPick={pickOrder} />
      )}
      {loadingEps && episodes.length === 0 ? (
        <div className="flex flex-col gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <EpisodeSkeleton key={i} />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <p className="text-[13.5px] text-ink-subtle">{t("No episodes to show here yet.")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {episodes.map((ep) => (
            <EpisodeItem key={ep.episode} ep={ep} onPlay={onPlay} />
          ))}
        </div>
      )}
    </section>
  );
}

function SeasonPicker({
  options,
  value,
  label,
  onChange,
}: {
  options: SeasonEntry[];
  value: number;
  label: string;
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink ring-1 ring-edge-soft transition-transform active:scale-[0.97] motion-reduce:transition-none"
      >
        <span className="max-w-[42vw] truncate">{label}</span>
        <ChevronDown size={15} strokeWidth={2.4} className="shrink-0 text-ink-subtle" />
      </button>
      {open && (
        <SeasonSheet
          options={options}
          value={value}
          onPick={(n) => {
            onChange(n);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function SeasonSheet({
  options,
  value,
  onPick,
  onClose,
}: {
  options: SeasonEntry[];
  value: number;
  onPick: (n: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [reduced] = useState(prefersReducedMotion);
  const sheet = (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={t("Close")}
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 ${reduced ? "" : "md-sheet-fade"}`}
      />
      <div
        className={`relative max-h-[70vh] overflow-y-auto rounded-t-3xl bg-canvas ${HIDE_SCROLL} ${
          reduced ? "" : "md-sheet-in"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="sticky top-0 flex items-center justify-center bg-canvas pb-2 pt-3">
          <span className="h-1 w-9 rounded-full bg-edge" />
        </div>
        <div className="flex flex-col px-3 pb-2">
          <h3 className="px-3 pb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("Seasons")}
          </h3>
          {options.map((o) => (
            <button
              key={o.number}
              type="button"
              onClick={() => onPick(o.number)}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-start text-[15px] transition-colors active:bg-elevated/50 motion-reduce:transition-none ${
                o.number === value ? "font-semibold text-ink" : "text-ink-muted"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{o.label}</span>
                {o.badge && <Badge>{t(o.badge)}</Badge>}
              </span>
              {o.number === value && (
                <Check size={17} strokeWidth={2.6} className="shrink-0 text-accent" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(sheet, document.body) : sheet;
}

function EpisodeItem({ ep, onPlay }: { ep: Ep; onPlay: (ep: Ep) => void }) {
  const t = useT();
  const upcoming = isUpcoming(ep.airDate);
  const sub = [
    t("S{season} E{episode}", { season: ep.season, episode: ep.episode }),
    ep.runtime ? t("{count} min", { count: ep.runtime }) : null,
    formatAirDate(ep.airDate) || null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <button
      type="button"
      onClick={() => onPlay(ep)}
      className="flex gap-3.5 rounded-2xl p-2 text-start transition-colors active:bg-elevated/50 motion-reduce:transition-none"
    >
      <div className="relative w-[128px] shrink-0 overflow-hidden rounded-xl">
        <div className={upcoming ? "opacity-70" : undefined}>
          <Poster src={ep.still} seed={`${ep.season}-${ep.episode}`} ratio="landscape" lazy />
        </div>
        <span className="absolute start-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {ep.episode}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <div className="flex items-center gap-2">
          <p
            className={`line-clamp-1 min-w-0 text-[14px] font-semibold ${
              upcoming ? "text-ink-muted" : "text-ink"
            }`}
          >
            {ep.name || t("Episode {number}", { number: ep.episode })}
          </p>
          {upcoming && <Badge>{t("Upcoming")}</Badge>}
        </div>
        {sub && <p className="text-[11.5px] text-ink-subtle">{sub}</p>}
        {ep.overview && (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{ep.overview}</p>
        )}
      </div>
    </button>
  );
}

function EpisodeSkeleton() {
  return (
    <div className="flex gap-3.5 p-2">
      <div className="aspect-video w-[128px] shrink-0 animate-pulse rounded-xl bg-elevated/70" />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <Line className="w-2/3" />
        <Line className="w-1/3" />
        <Line className="w-full" />
      </div>
    </div>
  );
}
