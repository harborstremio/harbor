import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { markMovieWatched } from "@/lib/mark-watched";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { Check, Heart, Play } from "lucide-react";
import { useState } from "react";

export function ElegantHoverActions({ meta, onPlay, preview }: { meta: Meta; onPlay: () => void; preview?: boolean }) {
  const t = useT();
  const inWatchlist = useInWatchlist(meta.id);
  const [watched, setWatched] = useState(false);
  const movie = meta.type === "movie";
  const act = (e: React.MouseEvent, fn: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
  const btn = preview ? "pointer-events-none" : "pointer-events-auto";
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex items-end justify-between rounded-[var(--poster-radius,12px)] bg-black/25 p-2.5 transition-opacity duration-150 ${
        preview ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
      }`}
    >
      <span
        role="button"
        aria-label={t("Play")}
        title={t("Play")}
        onClick={(e) => act(e, onPlay)}
        className={`${btn} flex h-11 w-11 items-center justify-center rounded-full bg-[#22a45d] text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.7)] transition-transform hover:scale-110`}
      >
        <Play size={17} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />
      </span>
      <span className="flex items-center gap-0.5">
        {movie && (
          <span
            role="button"
            aria-label={t("Mark watched")}
            title={t("Mark watched")}
            onClick={(e) =>
              act(e, () => {
                setWatched(true);
                void markMovieWatched(
                  meta,
                  meta.id.startsWith("tt") ? meta.id : null,
                  meta.id.startsWith("tmdb:") ? meta.id.split(":")[2] : null,
                );
              })
            }
            className={`${btn} flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 ${
              watched ? "text-emerald-400" : "text-white"
            }`}
          >
            <Check size={19} strokeWidth={2.8} />
          </span>
        )}
        <span
          role="button"
          aria-label={inWatchlist ? t("Remove from watchlist") : t("Add to watchlist")}
          title={inWatchlist ? t("Remove from watchlist") : t("Add to watchlist")}
          onClick={(e) =>
            act(e, () => {
              toggleWatchlist({ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster });
            })
          }
          className={`${btn} flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-110`}
        >
          <Heart size={17} strokeWidth={2.2} fill={inWatchlist ? "currentColor" : "none"} />
        </span>
      </span>
    </div>
  );
}
