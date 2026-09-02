import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronRight, Info, Plus, RotateCcw, TrendingUp, Volume2, VolumeX } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import tmdbIcon from "@/assets/addon-logos/tmdb.png";
import traktIcon from "@/assets/trakt.svg";
import simklIcon from "@/assets/simkl.png";
import cinemetaIcon from "@/assets/stremio.png";

const SOURCE_ICON: Record<string, string> = {
  TMDB: tmdbIcon,
  Trakt: traktIcon,
  Simkl: simklIcon,
  Cinemeta: cinemetaIcon,
};

const ROUNDED_ICON = new Set(["TMDB", "Simkl"]);
import { MetaAwardsCorner } from "@/components/meta-awards-corner";
import { RtBadge } from "@/components/rt-badge";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { omdbPrefetch, useOmdbScores } from "@/lib/providers/omdb";
import { useImdbRating } from "@/lib/imdb-rating";
import { tmdbImdbId, tmdbMovieImages, tmdbTrailerList, useTmdbImdbId } from "@/lib/providers/tmdb";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import { useSettings } from "@/lib/settings";
import { useTitleLogo } from "@/lib/title-logo";
import { useLocalizedOverview } from "@/lib/use-localized-overview";
import { fetchTrailer, prefetchTrailer, trailerSrc, type TrailerInfo } from "@/lib/trailer";
import { useView } from "@/lib/view";
import { useProfiles } from "@/lib/profiles";
import {
  getHeroMuted,
  setHeroMuted,
  subscribeHeroMuted,
  syncHeroMutedFromSetting,
} from "@/lib/hero-mute";
import { getHeroEnded, setHeroEnded } from "@/lib/hero-ended";
import { usePageVisible } from "@/lib/visibility";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";

export const Hero = memo(function Hero({
  meta,
  rank,
  playTrailer = false,
  active = true,
  loadBackdrop = true,
  full = false,
  fullQuality = false,
  bottomAlign = false,
  playSquare = false,
  moreInfo = false,
}: {
  meta: Meta;
  rank?: { label: string; position: number; sources?: Array<{ label: string; rank: number }> };
  playTrailer?: boolean;
  active?: boolean;
  loadBackdrop?: boolean;
  full?: boolean;
  fullQuality?: boolean;
  bottomAlign?: boolean;
  playSquare?: boolean;
  moreInfo?: boolean;
}) {
  const { settings } = useSettings();
  const { openMeta, meta: activeDetail, player, picker, view } = useView();
  const { pickerOpen: profilePickerOpen } = useProfiles();
  const t = useT();
  const description = useLocalizedOverview(meta);
  const resolvedImdb = useTmdbImdbId(meta.id);
  const inWatchlist = useInWatchlist(meta.id, [resolvedImdb]);
  const [bgUrl, setBgUrl] = useState<string | undefined>(meta.background);
  const [bgResolved, setBgResolved] = useState<boolean>(!!meta.background);
  const bg = bgUrl
    ? upsizeTmdb(bgUrl, fullQuality)
    : (meta.background ?? (bgResolved ? meta.poster : undefined));
  const [trailerCandidates, setTrailerCandidates] = useState<string[]>([]);
  const [trailerInfo, setTrailerInfo] = useState<TrailerInfo | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [overControls, setOverControls] = useState(false);
  const audioHero = settings.heroTrailerAudio && playTrailer;
  const muted = useSyncExternalStore(subscribeHeroMuted, getHeroMuted);
  const [ended, setEnded] = useState(() => getHeroEnded(meta.id));
  const [logoState, setLogo] = useState<string | undefined>(meta.logo);
  const pinnedLogo = useTitleLogo(meta.id);
  const logo = pinnedLogo ?? logoState;
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoResolved, setLogoResolved] = useState<boolean>(!!meta.logo);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [visibleRatio, setVisibleRatio] = useState(1);
  const [lingered, setLingered] = useState(false);
  const omdb = useOmdbScores(resolvedImdb ?? undefined);
  const imdbRating = useImdbRating(meta, resolvedImdb);
  const pageVisible = usePageVisible();
  const overlayed = !!(activeDetail || player || picker) || profilePickerOpen || view !== "home";
  const onScreen = pageVisible && !overlayed && visibleRatio > 0.12;
  const wantsPlayback =
    !!playTrailer && !!trailerInfo && !overControls && onScreen && lingered && !ended;

  useEffect(() => {
    setTrailerCandidates([]);
    setTrailerInfo(null);
    setVideoReady(false);
    setEnded(getHeroEnded(meta.id));
  }, [meta.id]);

  useEffect(() => {
    if (!playTrailer || trailerCandidates.length > 0) return;
    let cancelled = false;
    const isTmdb = meta.id.startsWith("tmdb:");
    const lookup: Promise<string[]> = isTmdb
      ? tmdbTrailerList(settings.tmdbKey, meta.id)
      : fetchMeta(narrowMediaType(meta.type), meta.id).then((full) => {
          const ids = [
            full?.trailers?.[0]?.source,
            full?.trailerStreams?.[0]?.ytId,
            ...(full?.trailerStreams?.slice(1).map((s) => s.ytId) ?? []),
          ].filter((s): s is string => !!s);
          return Array.from(new Set(ids));
        });
    lookup
      .then((ids) => {
        if (cancelled) return;
        setTrailerCandidates(ids);
        if (ids[0]) prefetchTrailer(ids[0], "360p");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.type, settings.tmdbKey, playTrailer, trailerCandidates.length]);

  useEffect(() => {
    // peekCachedLogo, not meta.logo: when the image language is not English the
    // meta's own (English) logo is not final, and must be re-resolved below.
    const seed = peekCachedLogo(settings.tmdbKey, meta);
    setLogo(seed);
    setLogoLoaded(false);
    setLogoResolved(!!seed);
    setBgUrl(meta.background);
    setBgResolved(!!meta.background);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, meta.logo, meta.background, settings.tmdbKey]);

  useEffect(() => {
    if (logoResolved && bgResolved) return;
    let cancelled = false;
    if (!logoResolved) {
      // resolveLogo honours the configured image languages for tt ids too, by
      // mapping them to a TMDB id first. Resolving it here rather than inline
      // is what keeps Cinemeta's English logo from winning on those.
      resolveLogo(settings.tmdbKey, meta)
        .then((l) => {
          if (cancelled) return;
          setLogo(l);
          setLogoResolved(true);
        })
        .catch(() => {
          if (!cancelled) setLogoResolved(true);
        });
    }
    if (!bgResolved) {
      const isTmdb = meta.id.startsWith("tmdb:");
      const bg: Promise<string | undefined> = isTmdb
        ? tmdbMovieImages(settings.tmdbKey, meta.id).then((urls) => urls[0])
        : fetchMeta(narrowMediaType(meta.type), meta.id).then((full) => full?.background);
      bg.then((b) => {
        if (cancelled) return;
        if (b) setBgUrl(b);
        setBgResolved(true);
      }).catch(() => {
        if (!cancelled) setBgResolved(true);
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoResolved, bgResolved, meta.id, meta.type, settings.tmdbKey]);

  useEffect(() => {
    if (!active || !settings.omdbKey) return;
    let cancelled = false;
    tmdbImdbId(settings.tmdbKey, meta.id).then((id) => {
      if (cancelled || !id) return;
      omdbPrefetch(settings.omdbKey, id);
    });
    return () => {
      cancelled = true;
    };
  }, [active, meta.id, settings.tmdbKey, settings.omdbKey]);

  useEffect(() => {
    if (!playTrailer || trailerCandidates.length === 0 || trailerInfo) return;
    let cancelled = false;
    fetchTrailer(trailerCandidates[0], "360p").then((info) => {
      if (!cancelled && info) setTrailerInfo(info);
    });
    return () => {
      cancelled = true;
    };
  }, [playTrailer, trailerCandidates, trailerInfo]);

  useEffect(() => {
    syncHeroMutedFromSetting(settings.heroTrailerAudio);
  }, [settings.heroTrailerAudio]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted || !audioHero;
    v.volume = audioHero && !muted ? Math.max(0, Math.min(1, (visibleRatio - 0.2) / 0.7)) : 0;
  }, [muted, audioHero, visibleRatio, trailerInfo]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (!audioHero) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) setVisibleRatio(e.intersectionRatio > 0.12 ? 1 : 0);
        },
        { threshold: [0.12] },
      );
      io.observe(el);
      return () => io.disconnect();
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisibleRatio(e.intersectionRatio);
      },
      { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [audioHero]);

  useEffect(() => {
    if (!onScreen) {
      setLingered(false);
      return;
    }
    const id = window.setTimeout(() => setLingered(true), 1000);
    return () => window.clearTimeout(id);
  }, [onScreen]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    if (wantsPlayback) {
      v.muted = muted || !audioHero;
      v.play().catch(() => {
        if (cancelled) return;
        if (!v.muted) {
          v.muted = true;
          setHeroMuted(true);
          v.play().catch(() => {});
        }
      });
    } else {
      v.pause();
    }
    return () => {
      cancelled = true;
    };
  }, [wantsPlayback, muted, audioHero]);

  useEffect(() => {
    if (!trailerInfo) return;
    const v = videoRef.current;
    return () => {
      if (!v) return;
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {
        void 0;
      }
    };
  }, [trailerInfo]);

  const actionRadius = playSquare ? "rounded-md" : "rounded-full";

  return (
    <section
      ref={sectionRef}
      onClick={() => openMeta({ ...meta, logo: logo ?? meta.logo })}
      className={`harbor-hero-stage group relative cursor-pointer overflow-hidden bg-canvas ${full ? "h-[78vh] min-h-[640px] rounded-none" : "h-[560px] rounded-2xl"}`}
      style={{ isolation: "isolate" }}
    >
      {bg && loadBackdrop && (
        <img
          src={bg}
          alt=""
          decoding="async"
          fetchPriority={active ? "high" : "low"}
          className={`absolute object-cover transition-opacity duration-500 ${full ? "inset-0 h-full w-full rounded-none" : "inset-[2px] h-[calc(100%-4px)] w-[calc(100%-4px)] rounded-[26px]"}`}
          style={{ opacity: wantsPlayback && videoReady ? 0 : 0.9 }}
        />
      )}
      {trailerInfo && (
        <div
          className={`pointer-events-none absolute overflow-hidden transition-opacity duration-500 ${full ? "inset-0 rounded-none" : "inset-[2px] rounded-[26px]"}`}
          style={{ opacity: wantsPlayback && videoReady ? 1 : 0 }}
        >
          <video
            ref={videoRef}
            src={trailerSrc(trailerInfo)}
            loop={!audioHero}
            playsInline
            preload="none"
            onCanPlay={() => setVideoReady(true)}
            onEnded={() => {
              if (audioHero) {
                setEnded(true);
                setHeroEnded(meta.id, true);
              }
            }}
            className="absolute left-1/2 top-1/2 h-[110%] w-[110%] -translate-x-1/2 -translate-y-1/2 object-cover"
          />
        </div>
      )}
      {audioHero && trailerInfo && videoReady && (wantsPlayback || ended) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (ended) {
              const v = videoRef.current;
              if (v) {
                v.currentTime = 0;
                setEnded(false);
                setHeroEnded(meta.id, false);
                v.play().catch(() => {});
              }
            } else {
              setHeroMuted(!muted);
            }
          }}
          aria-label={ended ? t("Replay") : muted ? t("Unmute") : t("Mute")}
          title={ended ? t("Replay") : muted ? t("Unmute") : t("Mute")}
          className={`absolute end-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/15 backdrop-blur-md transition-all duration-200 hover:bg-black/75 active:scale-90 ${full ? "top-28 lg:top-32" : "top-6"}`}
        >
          {ended ? <RotateCcw size={18} /> : muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      )}
      <div
        className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/85 via-50% to-transparent rtl:bg-gradient-to-l"
        style={{ opacity: settings.heroShadow / 100 }}
      />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-canvas via-canvas/70 via-50% to-transparent" />
      <MetaAwardsCorner meta={meta} imdbId={resolvedImdb} />

      <div
        className={`harbor-hero-content relative flex h-full flex-col p-14 ${bottomAlign ? "justify-end pb-24" : "justify-center"} ${full ? "pt-28 lg:pt-32" : ""}`}
      >
        <div className="max-w-2xl">
          {rank && (
            <div className="group/rank relative mb-5 inline-flex self-start">
              <div className="inline-flex cursor-help items-center gap-1.5 rounded-md bg-canvas/85 px-2.5 py-1 text-[12px] font-semibold text-ink">
                <TrendingUp size={12} className="text-accent" />
                <span>
                  {t("#{position} in {label} Today", {
                    position: rank.position,
                    label: t(rank.label),
                  })}
                </span>
              </div>
              {rank.sources && rank.sources.length > 0 && (
                <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-max min-w-[232px] translate-y-1 rounded-md bg-elevated p-2.5 opacity-0 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] ring-1 ring-edge transition-[opacity,transform] duration-150 ease-out group-hover/rank:translate-y-0 group-hover/rank:opacity-100 motion-reduce:transition-none">
                  <div className="px-1 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                    {t("Consensus ranking")}
                  </div>
                  <div className="flex flex-col gap-1">
                    {rank.sources.map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center justify-between gap-6 px-1 py-1.5"
                      >
                        <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ink">
                          {SOURCE_ICON[s.label] && (
                            <img
                              src={SOURCE_ICON[s.label]}
                              alt=""
                              className={`h-[18px] w-[18px] shrink-0 ${
                                ROUNDED_ICON.has(s.label)
                                  ? "rounded-full object-cover"
                                  : "object-contain"
                              }`}
                            />
                          )}
                          {s.label}
                        </span>
                        <span className="text-[12px] font-semibold tabular-nums text-ink-muted">
                          #{s.rank}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="px-1 pt-2.5 text-[11px] leading-snug text-ink-subtle">
                    {t("Blended across TMDB, Trakt, Simkl and Cinemeta.")}
                  </div>
                </div>
              )}
            </div>
          )}
          <HeroTitlePlate
            name={meta.name}
            logo={logo}
            loaded={logoLoaded}
            resolved={logoResolved}
            onLoad={() => setLogoLoaded(true)}
            onError={() => {
              setLogo(undefined);
              setLogoResolved(true);
            }}
          />
          {description && (
            <p className="mt-6 line-clamp-3 max-w-xl text-[16px] leading-relaxed text-ink-muted">
              {description}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-[14px]">
            {meta.releaseInfo && <Stat label={t("Year")} value={meta.releaseInfo} />}
            {settings.showImdbBadge && imdbRating && (
              <span className="flex items-center gap-2">
                <ImdbIcon className="h-[18px] w-auto rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.35)]" />
                <span className="font-semibold text-ink">{imdbRating}</span>
              </span>
            )}
            {settings.showRtBadge && omdb?.rtCritics != null && (
              <span className="flex items-center gap-2">
                <RtBadge score={omdb.rtCritics} className="h-[18px] w-auto" />
                <span className="font-semibold text-ink">{omdb.rtCritics}%</span>
              </span>
            )}
            {meta.runtime && <Stat label={t("Runtime")} value={meta.runtime} />}
          </div>
          <div
            className="mt-9 flex gap-3"
            onMouseEnter={() => setOverControls(true)}
            onMouseLeave={() => setOverControls(false)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                openMeta({ ...meta, logo: logo ?? meta.logo });
              }}
              className={`flex h-12 items-center gap-2.5 ${actionRadius} bg-ink px-7 text-[15px] font-semibold text-canvas transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]`}
            >
              <Play size={18} fill="currentColor" />
              {t("Play")}
            </button>
            {moreInfo ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openMeta({ ...meta, logo: logo ?? meta.logo });
                }}
                className={`flex h-12 items-center gap-2.5 ${actionRadius} bg-canvas/80 px-6 text-[15px] font-medium text-ink transition-colors duration-200 hover:bg-canvas/95`}
              >
                <Info size={18} strokeWidth={2} />
                {t("More info")}
                <ChevronRight size={16} strokeWidth={2} className="dir-icon opacity-65" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWatchlist({
                    id: meta.id,
                    type: meta.type,
                    name: meta.name,
                    poster: meta.poster,
                    imdbId: resolvedImdb,
                    addonOrigin: meta.addonOrigin,
                    videos: meta.videos,
                  });
                }}
                className={`flex h-12 items-center gap-2.5 ${actionRadius} bg-canvas/80 px-6 text-[15px] font-medium text-ink transition-colors duration-200 hover:bg-canvas/95`}
              >
                {inWatchlist ? (
                  <Check size={18} strokeWidth={2.4} />
                ) : (
                  <Plus size={18} strokeWidth={2} />
                )}
                {inWatchlist ? t("In Watchlist") : t("Add to Watchlist")}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

function HeroTitlePlate({
  name,
  logo,
  loaded,
  resolved,
  onLoad,
  onError,
}: {
  name: string;
  logo?: string;
  loaded: boolean;
  resolved: boolean;
  onLoad: () => void;
  onError: () => void;
}) {
  return (
    <div className="relative flex min-h-[112px] items-end">
      {logo ? (
        <img
          ref={(el) => {
            if (!el || !el.complete || el.naturalWidth === 0) return;
            if (el.naturalWidth < 40 || el.naturalHeight < 12) onError();
            else onLoad();
          }}
          src={logo}
          alt={name}
          decoding="async"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth < 40 || img.naturalHeight < 12) onError();
            else onLoad();
          }}
          onError={onError}
          className="max-h-[120px] w-auto max-w-[460px] object-contain object-left rtl:object-right drop-shadow-[0_6px_22px_rgba(0,0,0,0.45)]"
          style={{
            opacity: loaded ? 1 : 0,
            transition: "opacity 360ms cubic-bezier(0.32, 0.72, 0.24, 1)",
          }}
        />
      ) : resolved ? (
        <h2
          className="font-display text-[68px] font-medium leading-[0.98] tracking-tight text-ink"
          style={{ animation: "harbor-fade-in 420ms cubic-bezier(0.32, 0.72, 0.24, 1) both" }}
        >
          {name}
        </h2>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-ink-subtle">{label}: </span>
      <span className="text-ink">{value}</span>
    </span>
  );
}

function upsizeTmdb(url?: string, full = false): string | undefined {
  if (!url) return url;
  const hi =
    full &&
    typeof window !== "undefined" &&
    (window.screen?.height ?? 0) * (window.devicePixelRatio || 1) >= 2000;
  const size = hi ? "original" : "w1280";
  return url.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${size}/`);
}
