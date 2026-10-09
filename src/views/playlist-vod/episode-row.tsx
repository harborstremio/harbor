import { Check } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { readResumeEntry } from "@/lib/resume";
import type { VodEpisode } from "@/lib/iptv/vod";

const WATCHED_RATIO = 0.9;

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function episodeProgressOf(seriesId: string, ep: VodEpisode): { ratio: number; leftSec: number } {
  const entry = readResumeEntry(seriesId, ep.season, ep.episode);
  const total = ep.durationSec && ep.durationSec > 0 ? ep.durationSec : 0;
  if (!entry || entry.ms <= 0 || total <= 0) return { ratio: 0, leftSec: 0 };
  const watched = entry.ms / 1000;
  return { ratio: Math.min(1, watched / total), leftSec: Math.max(0, total - watched) };
}

export function EpisodeRow({
  seriesId,
  ep,
  fallbackLogo,
  onPlay,
}: {
  seriesId: string;
  ep: VodEpisode;
  fallbackLogo?: string | null;
  onPlay: () => void;
}) {
  const t = useT();
  const { ratio, leftSec } = episodeProgressOf(seriesId, ep);
  const done = ratio >= WATCHED_RATIO;

  return (
    <button
      onClick={onPlay}
      className="group flex items-start gap-3.5 rounded-xl p-2 text-start transition-colors hover:bg-elevated"
    >
      <span className="relative w-[150px] shrink-0 overflow-hidden rounded-lg bg-elevated">
        <Poster
          src={ep.logo ?? fallbackLogo ?? undefined}
          seed={`${seriesId}-${ep.season}-${ep.episode}`}
          className="aspect-video w-full object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-canvas/45 opacity-0 transition-opacity group-hover:opacity-100">
          <Play size={20} fill="currentColor" className="text-ink" />
        </span>
        {ratio > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-canvas/70">
            <span
              className="block h-full bg-accent"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1 pt-0.5">
        <span className="flex items-baseline gap-2">
          <span className="text-[12px] font-semibold tabular-nums text-ink-subtle">
            {ep.episode}
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
            {ep.title}
          </span>
          {done && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-canvas">
              <Check size={10} strokeWidth={3.2} />
            </span>
          )}
        </span>
        {ep.plot && (
          <span className="mt-1 line-clamp-2 block text-[12.5px] leading-relaxed text-ink-muted">
            {ep.plot}
          </span>
        )}
        <span className="mt-1 block text-[11.5px] text-ink-subtle">
          {ratio > 0 && !done
            ? t("{time} left", { time: clock(leftSec) })
            : ep.durationSec
              ? clock(ep.durationSec)
              : ""}
        </span>
      </span>
    </button>
  );
}
