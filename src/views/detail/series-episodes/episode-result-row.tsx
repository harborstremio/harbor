import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { Play } from "lucide-react";

type Video = NonNullable<Meta["videos"]>[number];

export function EpisodeResultRow({ video, onPlay, index }: { video: Video; onPlay: () => void; index?: number }) {
  const t = useT();
  const staggered = index != null;
  return (
    <button
      type="button"
      onClick={onPlay}
      style={staggered ? { animationDelay: `${Math.min(index, 8) * 55}ms` } : undefined}
      className={`group flex items-center gap-3.5 rounded-xl p-2 text-start transition-colors hover:bg-elevated ${
        staggered ? "animate-ai-reveal" : ""
      }`}
    >
      <div className="relative w-40 shrink-0 overflow-hidden rounded-lg">
        <Poster src={video.thumbnail || undefined} seed={String(video.id ?? video.episode)} ratio="landscape" lazy />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/90 text-canvas backdrop-blur-md">
            <Play size={14} fill="currentColor" />
          </span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[14.5px] font-semibold text-ink">
          {video.name || t("Episode {n}", { n: video.episode ?? 0 })}
        </span>
        <span className="text-[12.5px] font-medium text-accent">
          {t("Season {s}", { s: video.season ?? 0 })} · {t("Episode {n}", { n: video.episode ?? 0 })}
        </span>
      </div>
    </button>
  );
}
