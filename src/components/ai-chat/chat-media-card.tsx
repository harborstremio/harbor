import { useState, useEffect } from "react";
import { Play, Star, Clock, Info, Film, Tv, CheckCircle2, Calendar } from "lucide-react";
import type { ResolvedRecommendation } from "@/lib/ai-chat-catalog";
import { formatDuration, formatFinishTime } from "@/lib/ai-chat-catalog";
import { ResultPoster } from "@/components/search/result-poster";
import { useView } from "@/lib/view";
import { smartPlayEpisode } from "@/lib/smart-play";
import { useT } from "@/lib/i18n";

export function ChatMediaCard({
  item,
  className = "",
}: {
  item: ResolvedRecommendation;
  className?: string;
}) {
  const { meta, reason, runtimeMinutes } = item;
  const isReleased = item.isReleased === true;
  const { openMeta, openPicker } = useView();
  const t = useT();

  // Dynamic finish time refreshed every minute (strictly for released movies)
  const [finishTime, setFinishTime] = useState<string | null>(() =>
    isReleased && runtimeMinutes ? formatFinishTime(runtimeMinutes) : null,
  );

  useEffect(() => {
    if (!isReleased || !runtimeMinutes) {
      setFinishTime(null);
      return;
    }
    setFinishTime(formatFinishTime(runtimeMinutes));
    const interval = setInterval(() => {
      setFinishTime(formatFinishTime(runtimeMinutes));
    }, 30000);
    return () => clearInterval(interval);
  }, [isReleased, runtimeMinutes]);

  const isSeries = meta.type === "series";
  const durationText = isReleased
    ? runtimeMinutes
      ? formatDuration(runtimeMinutes)
      : meta.runtime || null
    : null;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isReleased) return;
    openPicker(meta, smartPlayEpisode(meta), { autoPlay: true });
  };

  const handleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    openMeta(meta);
  };

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-edge-soft bg-canvas/92 shadow-lg backdrop-blur-xl transition-all hover:border-accent/40 ${className}`}
    >
      {/* Top Media Header / Poster banner */}
      <div className="relative flex gap-3.5 p-3.5 pb-2">
        {/* Poster with hover zoom effect */}
        <button
          type="button"
          aria-label={t("Details")}
          onClick={handleDetails}
          className="relative h-32 w-22 shrink-0 cursor-pointer overflow-hidden rounded-xl shadow-md ring-1 ring-edge-soft transition-transform group-hover:scale-[1.02]"
        >
          <ResultPoster id={meta.id} poster={meta.poster} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end justify-center pb-2">
            <Info size={18} className="text-white drop-shadow" />
          </div>
        </button>

        {/* Title, tags, ratings */}
        <div className="flex flex-1 flex-col justify-between min-w-0 py-0.5">
          <div>
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent ring-1 ring-accent/25">
                {isSeries ? <Tv size={11} /> : <Film size={11} />}
                {isSeries ? t("Series") : t("Movie")}
              </span>

              {!isReleased ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400 ring-1 ring-amber-500/30">
                  <Calendar size={11} />
                  {item.isReleased === false ? t("Upcoming") : t("Release status unconfirmed")}
                </span>
              ) : meta.releaseInfo ? (
                <span className="rounded-md bg-canvas/80 px-1.5 py-0.5 text-[11px] text-ink/90 ring-1 ring-edge-soft backdrop-blur-sm">
                  {meta.releaseInfo}
                </span>
              ) : null}

              {meta.imdbRating && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-400 ring-1 ring-amber-500/30">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  {meta.imdbRating}
                </span>
              )}
            </div>

            {/* Title */}
            <button
              type="button"
              onClick={handleDetails}
              className="text-start font-bold text-[15px] leading-tight text-ink hover:text-accent transition-colors line-clamp-2"
              title={meta.name}
            >
              {meta.name}
            </button>

            {/* Genres */}
            {meta.genres && meta.genres.length > 0 && (
              <p className="mt-1 text-[11.5px] text-ink/85 truncate">
                {meta.genres.slice(0, 3).join(" • ")}
              </p>
            )}
          </div>

          {/* Duration & Finish time row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink/90">
            {isReleased ? (
              <>
                {durationText && (
                  <span className="inline-flex items-center gap-1 text-ink font-medium">
                    <Clock size={12} className="text-ink/85" />
                    {durationText}
                  </span>
                )}

                {finishTime && (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-md ring-1 ring-emerald-500/20">
                    <CheckCircle2 size={11} />
                    <span>
                      {t("If you start watching now, you'll finish at {time}", {
                        time: finishTime,
                      })}
                    </span>
                  </span>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-md ring-1 ring-amber-500/20">
                <Calendar size={11} />
                <span>
                  {item.releaseDate
                    ? t("Release date: {date}", { date: item.releaseDate })
                    : item.isReleased === false
                      ? t("Upcoming")
                      : t("Release status unconfirmed")}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AI Recommendation Reason / Synopsis */}
      <div className="px-3.5 py-2 text-[12.5px] leading-relaxed text-ink">
        {reason ? (
          <p className="border-s-2 border-accent/60 ps-2.5 italic text-ink">{reason}</p>
        ) : meta.description ? (
          <p className="line-clamp-2 text-ink/85">{meta.description}</p>
        ) : null}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 p-3.5 pt-2 border-t border-edge-soft/50 bg-canvas/75">
        {isReleased ? (
          <>
            <button
              type="button"
              onClick={handlePlay}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-[13px] font-semibold text-canvas shadow-md transition-transform hover:brightness-110 active:scale-[0.98]"
            >
              <Play size={14} className="fill-current" />
              <span>{t("Play")}</span>
            </button>

            <button
              type="button"
              onClick={handleDetails}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-edge-soft bg-canvas/90 px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-canvas hover:text-accent active:scale-[0.98]"
            >
              <Info size={14} />
              <span>{t("Details")}</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleDetails}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-edge-soft bg-canvas/90 px-3 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-canvas hover:text-accent active:scale-[0.98]"
          >
            <Info size={14} />
            <span>{t("Details")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
