import type { Meta } from "@/lib/cinemeta";
import { type PlayEpisode } from "@/lib/view";
import { Check } from "lucide-react";
import { useEffect } from "react";

export function DownloadStarted({
  meta,
  episode,
  label,
  onDone,
}: {
  meta: Meta;
  episode?: PlayEpisode;
  label?: string | null;
  onDone: () => void;
}) {
  const backdrop = episode?.still || meta.background || meta.poster;
  useEffect(() => {
    const t = window.setTimeout(onDone, 1500);
    return () => window.clearTimeout(t);
  }, [onDone]);
  const title = episode
    ? `${meta.name}  ·  S${episode.imdbSeason ?? episode.season} E${String(episode.imdbEpisode ?? episode.episode).padStart(2, "0")}`
    : meta.name;
  return (
    <main className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black">
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-35 blur-[30px] saturate-150"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/85" />
      <div className="relative flex flex-col items-center gap-6 px-8 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/12 ring-1 ring-emerald-400/35">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/90 text-black animate-in zoom-in duration-300">
            <Check size={30} strokeWidth={3} />
          </span>
        </span>
        <div className="flex flex-col gap-2">
          <p className="font-display text-[30px] font-medium leading-tight text-white drop-shadow-[0_12px_30px_rgba(0,0,0,0.6)]">
            Saving to Downloads
          </p>
          <p className="text-[14px] text-white/75">{title}</p>
          {label && <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/45">{label}</p>}
        </div>
        <p className="text-[13px] text-white/55">Track progress on the Downloads tab</p>
      </div>
    </main>
  );
}
