import { Check, ChevronDown, ListPlus, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { queueToggle, useQueue } from "@/lib/queue";
import { useT } from "@/lib/i18n";
import { pickLocalizedText } from "@/lib/localized-text";
import { useSettings } from "@/lib/settings";
import { effectiveOrderProvider } from "@/lib/settings/episode-order";
import { getEpisodeProgress, resumeDefaultSeason } from "@/lib/episode-progress";
import { fetchEpisodeList } from "@/lib/series-episodes";
import type { Episode } from "@/lib/providers/tmdb";
import { tmdbLanguageIso } from "@/lib/providers/tmdb/tmdb-client";
import { useTrakt } from "@/lib/trakt/provider";
import { useSimkl } from "@/lib/simkl/provider";
import type { PlayEpisode } from "@/lib/view";
import { useArcGroups } from "@/views/detail/series-episodes/use-arc-groups";
import { useEpisodeOrder } from "@/views/detail/series-episodes/use-episode-order";
import { useSeriesTvdbStills } from "@/views/detail/series-episodes/use-series-tvdb-stills";
import { useWatchedSets } from "@/views/detail/series-episodes/use-watched-sets";
import { useTvdbSeasonTypes } from "@/views/detail/series-episodes/use-tvdb-season-types";
import { TvdbOrderPanel } from "@/views/detail/series-episodes/tvdb-order-panel";
import type { PickerItem } from "@/views/detail/series-episodes/season-arc-picker";
import { seasonDateRange, type OrderedEpisode } from "@/lib/providers/tvdb-order";

type DropOption = { key: string; label: string };

function SeasonDropdown({
  options,
  activeKey,
  onSelect,
}: {
  options: DropOption[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const activeLabel = options.find((o) => o.key === activeKey)?.label ?? options[0]?.label ?? "";
  return (
    <div ref={ref} className="relative w-fit">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-white/[0.09] px-4 py-2 text-[14px] font-semibold text-white ring-1 ring-white/12 transition-colors hover:bg-white/15"
      >
        {activeLabel}
        <ChevronDown size={16} strokeWidth={2.4} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 max-h-72 w-56 overflow-y-auto rounded-xl bg-neutral-900/95 p-1.5 ring-1 ring-white/12 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl [scrollbar-width:thin]">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                onSelect(o.key);
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-lg px-3 py-2 text-start text-[13.5px] transition-colors ${
                o.key === activeKey ? "bg-white/15 font-semibold text-white" : "text-white/70 hover:bg-white/10"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EpisodePicker({
  meta,
  imdbId,
  onPlayEpisode,
}: {
  meta: Meta;
  imdbId: string | null;
  onPlayEpisode: (ep: PlayEpisode) => void;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const queue = useQueue();
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: simklConnected } = useSimkl();
  const { traktWatched, simklWatched } = useWatchedSets({
    traktConnected,
    simklConnected,
    imdbId,
    metaId: meta.id,
  });
  const [eps, setEps] = useState<PlayEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<number | null>(null);
  const [orderSeason, setOrderSeason] = useState<number>(-1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEps([]);
    fetchEpisodeList(meta, { tmdbKey: settings.tmdbKey })
      .then((list) => {
        if (!cancelled) {
          setEps(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, settings.tmdbKey]);

  const combinedWatched = useMemo(() => {
    const s = new Set<string>();
    for (const k of simklWatched) s.add(k);
    for (const k of traktWatched) {
      const e = k.lastIndexOf(":");
      const se = e > 0 ? k.lastIndexOf(":", e - 1) : -1;
      if (se >= 0) s.add(k.slice(se + 1));
    }
    return s;
  }, [simklWatched, traktWatched]);

  const tvId = meta.id.startsWith("tmdb:tv:") ? parseInt(meta.id.slice(8), 10) || 0 : 0;
  const arc = useArcGroups({ tvId, tmdbKey: settings.tmdbKey, enabled: settings.episodeArcGroups });
  const orderProvider = effectiveOrderProvider(settings);
  const ordering = useEpisodeOrder(imdbId, meta.id, orderProvider, settings.tvdbSeasonType, settings.tvdbKey);
  const orderTypes = useTvdbSeasonTypes(imdbId, meta.id, settings.tvdbKey, orderProvider === "tvdb");

  const [arcMode, setArcMode] = useState<"seasons" | "arcs">("seasons");
  const arcAvailable = settings.episodeArcGroups && arc.hasArcs;
  const arcActive = arcAvailable && arcMode === "arcs";
  const orderActive = !arcActive && ordering != null;
  const mode: "arcs" | "order" | "flat" = arcActive ? "arcs" : orderActive ? "order" : "flat";

  const flatSeasonObjs = useMemo(() => {
    const counts = new Map<number, number>();
    for (const e of eps) if (e.season >= 1) counts.set(e.season, (counts.get(e.season) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([seasonNumber, episodeCount]) => ({ seasonNumber, episodeCount }));
  }, [eps]);
  const flatSeasons = flatSeasonObjs.map((s) => s.seasonNumber);
  const flatDefault = resumeDefaultSeason(meta.id, flatSeasonObjs, combinedWatched);
  const flatActive = season != null && flatSeasons.includes(season) ? season : flatDefault;

  const orderSeasonEff =
    ordering && !ordering.seasons.some((s) => s.seasonNumber === orderSeason)
      ? resumeDefaultSeason(meta.id, ordering.seasons, combinedWatched)
      : orderSeason;

  const orderItems = useMemo<PickerItem[]>(() => {
    if (!ordering) return [];
    return ordering.seasons
      .filter((s) => s.seasonNumber >= 1)
      .map((s) => {
        const bucket = ordering.bySeason.get(s.seasonNumber) ?? [];
        const { from, to } = seasonDateRange(bucket);
        return {
          key: String(s.seasonNumber),
          name: s.name,
          count: bucket.length,
          year: s.airDate?.slice(0, 4) ?? undefined,
          from,
          to,
        };
      });
  }, [ordering]);

  const flatByKey = useMemo(() => {
    const m = new Map<string, PlayEpisode>();
    for (const e of eps) m.set(`${e.season}:${e.episode}`, e);
    return m;
  }, [eps]);

  const toPlay = useCallback(
    (e: Episode | OrderedEpisode): PlayEpisode => {
      const match = flatByKey.get(`${e.seasonNumber}:${e.episodeNumber}`);
      const still = e.stillUrl ?? (e.stillPath ? `https://image.tmdb.org/t/p/w300${e.stillPath}` : undefined);
      // pickLocalizedText keys script tests by ISO-1 ("ko"), not TVDB codes ("kor").
      const lang = tmdbLanguageIso();
      const enName = "nameEn" in e ? e.nameEn : undefined;
      const enOverview = "overviewEn" in e ? e.overviewEn : undefined;
      return {
        ...match,
        season: e.seasonNumber,
        episode: e.episodeNumber,
        name:
          (pickLocalizedText(
            [{ text: e.name }, { text: enName ?? "" }, { text: match?.name ?? "" }],
            { forName: true, lang },
          ) ?? e.name) || undefined,
        still: match?.still ?? still,
        overview:
          (pickLocalizedText(
            [{ text: e.overview }, { text: enOverview ?? "" }, { text: match?.overview ?? "" }],
            { lang },
          ) ?? e.overview) || undefined,
        rating: e.voteAverage && e.voteAverage > 0 ? e.voteAverage : match?.rating,
        airDate: e.airDate || match?.airDate || undefined,
        runtime: e.runtime && e.runtime > 0 ? e.runtime : match?.runtime,
      };
    },
    [flatByKey],
  );

  const activeEpisodes = useMemo<PlayEpisode[]>(() => {
    if (mode === "arcs") return arc.episodes.map(toPlay);
    if (mode === "order" && ordering) return (ordering.bySeason.get(orderSeasonEff) ?? []).map(toPlay);
    return eps.filter((e) => e.season === flatActive).sort((a, b) => a.episode - b.episode);
  }, [mode, arc.episodes, ordering, orderSeasonEff, eps, flatActive, toPlay]);

  const options: DropOption[] =
    mode === "arcs"
      ? arc.arcs.map((a) => ({ key: a.id, label: a.name }))
      : mode === "order" && ordering
        ? ordering.seasons.map((s) => ({ key: String(s.seasonNumber), label: s.name }))
        : flatSeasons.map((s) => ({ key: String(s), label: s === 0 ? t("Specials") : t("Season {n}", { n: s }) }));

  const activeKey =
    mode === "arcs"
      ? arc.activeArcId ?? arc.arcs[0]?.id ?? ""
      : mode === "order"
        ? String(orderSeasonEff)
        : String(flatActive);

  const onSelectKey = (k: string) => {
    if (mode === "arcs") arc.setActiveArcId(k);
    else if (mode === "order") setOrderSeason(Number(k));
    else setSeason(Number(k));
  };

  const tvdbStills = useSeriesTvdbStills(imdbId, activeEpisodes.length, settings.tvdbSeasonType);
  const thumbFor = (ep: PlayEpisode) =>
    ep.still ?? tvdbStills[`s${ep.season}e${ep.episode}`] ?? tvdbStills[`abs${ep.episode}`];
  const progressFor = (ep: PlayEpisode) =>
    getEpisodeProgress(meta.id, ep.season, ep.episode, ep.runtime ?? null, imdbId ?? null, traktWatched, undefined, undefined, simklWatched);
  const queuedKeys = useMemo(
    () => new Set(queue.map((i) => `${i.meta.id}:${i.episode?.season ?? ""}:${i.episode?.episode ?? ""}`)),
    [queue],
  );

  const loadingNow = mode === "arcs" ? arc.loading : mode === "flat" ? loading : false;

  return (
    <div className="flex flex-col gap-5 px-6 pb-8 pt-1 sm:px-8">
      {arcAvailable && (
        <div className="flex w-fit gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
          {(["seasons", "arcs"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setArcMode(m)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                arcMode === m ? "bg-white/15 text-white" : "text-white/55 hover:text-white/80"
              }`}
            >
              {m === "seasons" ? t("Seasons") : t("Arcs")}
            </button>
          ))}
        </div>
      )}
      {mode === "order" && ordering && orderItems.length > 0 ? (
        <div className="w-fit">
          <TvdbOrderPanel
            items={orderItems}
            activeKey={String(orderSeasonEff)}
            onSelect={(k) => setOrderSeason(Number(k))}
            orderTypes={orderTypes}
            activeType={settings.tvdbSeasonType}
            onSelectType={(v) => update({ tvdbSeasonType: v as typeof settings.tvdbSeasonType })}
          />
        </div>
      ) : options.length > 1 ? (
        <SeasonDropdown options={options} activeKey={activeKey} onSelect={onSelectKey} />
      ) : null}

      {loadingNow ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-video w-full animate-pulse rounded-xl bg-white/[0.06]" />
          ))}
        </div>
      ) : activeEpisodes.length === 0 ? (
        <p className="px-1 text-[13.5px] text-white/50">{t("No episodes found.")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
          {activeEpisodes.map((ep) => {
            const thumb = thumbFor(ep);
            const prog = progressFor(ep);
            const queued = queuedKeys.has(`${meta.id}:${ep.season}:${ep.episode}`);
            const sub = [ep.airDate?.slice(0, 10), ep.runtime ? `${ep.runtime}m` : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={`${ep.season}-${ep.episode}`} className="group relative flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onPlayEpisode(ep)}
                  className="flex w-full flex-col gap-2 text-start"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/10 transition duration-200 group-hover:ring-white/25">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        className={`h-full w-full object-cover ${prog.watched ? "opacity-55" : ""}`}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[13px] text-white/40">
                        {t("Episode {n}", { n: ep.episode })}
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
                        <Play size={20} fill="currentColor" className="ml-0.5" />
                      </span>
                    </div>
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {ep.episode}
                    </span>
                    {prog.watched && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/90 text-black ring-1 ring-black/20 transition-opacity duration-200 group-hover:opacity-0">
                        <Check size={12} strokeWidth={3.2} />
                      </span>
                    )}
                    {!prog.watched && prog.ratio > 0.02 && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                        <div className="h-full bg-accent" style={{ width: `${Math.min(100, prog.ratio * 100)}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 px-0.5">
                    <span className={`line-clamp-1 text-[13px] font-semibold ${prog.watched ? "text-white/55" : "text-white/90"}`}>
                      {ep.name || t("Episode {n}", { n: ep.episode })}
                    </span>
                    {sub && <span className="text-[11.5px] text-white/45">{sub}</span>}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => queueToggle(meta, ep)}
                  aria-label={queued ? t("Remove from queue") : t("Add to queue")}
                  title={queued ? t("In your queue") : t("Add to queue")}
                  className={`absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full ring-1 backdrop-blur-md transition-all duration-200 ${
                    queued
                      ? "bg-accent text-black ring-black/10"
                      : "bg-black/55 text-white opacity-0 ring-white/25 hover:bg-black/80 group-hover:opacity-100"
                  }`}
                >
                  {queued ? <Check size={16} strokeWidth={3} /> : <ListPlus size={16} strokeWidth={2.4} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
