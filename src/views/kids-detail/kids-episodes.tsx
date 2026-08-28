import { ChevronDown, ChevronLeft, ChevronRight, Play, Tv } from "lucide-react";
import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { tmdbSeasonEpisodes, type Episode, type Season } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import {
  preferredEpisodeName,
  preferredEpisodeOverview,
  preferredEpisodeVideo,
} from "@/lib/preferred-meta";

const STILL = "https://image.tmdb.org/t/p/w300";

export function KidsEpisodes({
  meta,
  tvId,
  seasons,
  preferredVideos,
}: {
  meta: Meta;
  tvId: number;
  seasons: Season[];
  preferredVideos?: Meta["videos"];
}) {
  const t = useT();
  const { settings } = useSettings();
  const { openPicker } = useView();
  const [season, setSeason] = useState(seasons[0]?.seasonNumber ?? 1);
  const [eps, setEps] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!settings.tmdbKey) return;
    let cancelled = false;
    setLoading(true);
    tmdbSeasonEpisodes(settings.tmdbKey, tvId, season)
      .then((e) => {
        if (cancelled) return;
        setEps(
          e.map((ep) => {
            const preferred = preferredEpisodeVideo(
              preferredVideos,
              ep.seasonNumber,
              ep.episodeNumber,
            );
            return {
              ...ep,
              name: preferredEpisodeName(preferred) ?? ep.name,
              overview: preferredEpisodeOverview(preferred) ?? ep.overview,
              stillUrl: preferred?.thumbnail || ep.stillUrl,
            };
          }),
        );
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [preferredVideos, tvId, season, settings.tmdbKey]);

  const play = (ep: Episode) =>
    openPicker(
      meta,
      { season: ep.seasonNumber, episode: ep.episodeNumber },
      { autoPlay: settings.instantPlay, resume: settings.instantPlay },
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <Tv size={24} strokeWidth={2.4} className="text-[#1f8f88]" />
        <h2 className="font-display text-[26px] font-extrabold tracking-tight text-[#0e3a43]">
          {t("Episodes")}
        </h2>
      </div>

      {seasons.length > 1 && (
        <SeasonPicker seasons={seasons} season={season} setSeason={setSeason} t={t} />
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-2xl bg-white/40 ring-2 ring-white/60" />
            ))
          : eps.map((ep) => <EpisodeCard key={ep.id} ep={ep} onPlay={() => play(ep)} t={t} />)}
      </div>
    </div>
  );
}

function SeasonPicker({
  seasons,
  season,
  setSeason,
  t,
}: {
  seasons: Season[];
  season: number;
  setSeason: (n: number) => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const [open, setOpen] = useState(false);
  if (seasons.length <= 7) {
    return (
      <div className="flex flex-wrap gap-2">
        {seasons.map((s) => (
          <button
            key={s.seasonNumber}
            type="button"
            onClick={() => setSeason(s.seasonNumber)}
            className={`h-11 rounded-full px-5 text-[15px] font-extrabold transition ${
              s.seasonNumber === season
                ? "bg-[#1f8f88] text-white shadow-[0_8px_20px_-8px_rgba(20,90,90,0.6)]"
                : "bg-white/70 text-[#0e3a43] ring-1 ring-white/70 hover:bg-white"
            }`}
          >
            {t("Season {n}", { n: s.seasonNumber })}
          </button>
        ))}
      </div>
    );
  }
  const idx = seasons.findIndex((s) => s.seasonNumber === season);
  const go = (d: number) => {
    const n = seasons[idx + d];
    if (n) setSeason(n.seasonNumber);
  };
  return (
    <div className="relative flex items-center gap-2">
      <Step onClick={() => go(-1)} disabled={idx <= 0}>
        <ChevronLeft size={26} strokeWidth={2.6} className="dir-icon" />
      </Step>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-[#1f8f88] px-6 text-[17px] font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(20,90,90,0.6)]"
      >
        {t("Season {n}", { n: season })}
        <ChevronDown size={20} strokeWidth={2.8} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <Step onClick={() => go(1)} disabled={idx >= seasons.length - 1}>
        <ChevronRight size={26} strokeWidth={2.6} className="dir-icon" />
      </Step>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute start-14 top-14 z-20 grid max-h-[260px] w-[320px] grid-cols-5 gap-2 overflow-y-auto rounded-2xl bg-white p-3 shadow-[0_20px_50px_-16px_rgba(20,60,70,0.5)] ring-1 ring-[#1f8f88]/20">
            {seasons.map((s) => (
              <button
                key={s.seasonNumber}
                type="button"
                onClick={() => {
                  setSeason(s.seasonNumber);
                  setOpen(false);
                }}
                className={`flex h-12 items-center justify-center rounded-xl text-[16px] font-extrabold transition ${
                  s.seasonNumber === season
                    ? "bg-[#1f8f88] text-white"
                    : "bg-[#eaf6f5] text-[#0e3a43] hover:bg-[#d4eeec]"
                }`}
              >
                {s.seasonNumber}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Step({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-[#1f8f88] ring-1 ring-white/70 transition hover:bg-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function EpisodeCard({
  ep,
  onPlay,
  t,
}: {
  ep: Episode;
  onPlay: () => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const still = ep.stillUrl || (ep.stillPath ? `${STILL}${ep.stillPath}` : undefined);
  const rating = ep.voteAverage && ep.voteAverage > 0 ? ep.voteAverage.toFixed(1) : undefined;
  return (
    <button type="button" onClick={onPlay} className="group flex flex-col gap-2 text-start">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface shadow-[0_12px_28px_-14px_rgba(20,40,60,0.45)] ring-2 ring-white transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_36px_-14px_rgba(20,40,60,0.55)]">
        {still && (
          <img src={still} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span className="absolute start-2 top-2 rounded-full bg-black/75 px-2.5 py-1 text-[12px] font-extrabold text-white">
          {t("Ep {n}", { n: ep.episodeNumber })}
        </span>
        {rating && (
          <span className="pointer-events-none absolute bottom-1.5 end-1.5 grid h-9 w-9 place-items-center">
            <img src="/kids/starbadge.svg" alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]" />
            <span className="relative translate-y-[1px] text-[9px] font-extrabold leading-none text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
              {rating}
            </span>
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[#1f8f88] shadow-lg">
            <Play size={26} strokeWidth={0} fill="currentColor" className="ms-0.5" />
          </span>
        </span>
      </div>
      <p className="line-clamp-1 text-[15px] font-bold text-[#0e3a43]">{ep.name}</p>
    </button>
  );
}
