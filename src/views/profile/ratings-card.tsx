import { ArrowDownToLine, ChevronRight, Star } from "lucide-react";
import { useRatingPoster } from "@/lib/ratings/poster";
import { useT } from "@/lib/i18n";
import { ArrowedScrollRow } from "@/components/arrowed-scroll-row";
import { RatingPoster } from "@/components/ratings/rating-poster";
import type { RatingsSummary } from "@/lib/ratings/types";

export function RatingsCard({
  ratings,
  isOwner,
  onViewAll,
  onImport,
  onOpenMeta,
}: {
  ratings?: RatingsSummary;
  isOwner: boolean;
  onViewAll: () => void;
  onImport?: () => void;
  onOpenMeta?: (metaId: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
}) {
  const t = useT();
  const count = ratings?.count ?? 0;
  if (!ratings || (count === 0 && !isOwner)) return null;

  return (
    <section aria-label={t("Ratings")} className="rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          <Star size={20} /> {t("Ratings")}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {isOwner && onImport && (
            <button
              type="button"
              onClick={onImport}
              aria-label={t("Import your ratings")}
              className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              <ArrowDownToLine size={14} strokeWidth={2.2} />
              {t("Import")}
            </button>
          )}
          {count > 0 && (
            <button
              type="button"
              onClick={onViewAll}
              className="group/va inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              {t("View all")}
              <ChevronRight
                size={14}
                strokeWidth={2.2}
                className="dir-icon transition-transform duration-200 group-hover/va:translate-x-0.5"
              />
            </button>
          )}
        </div>
      </div>
      {count === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-subtle">
          {t("Rate movies, shows, anime, and manga to build your ratings")}
        </p>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex items-baseline gap-1.5">
              <Star size={18} className="translate-y-[3px] fill-current text-ink" />
              <span className="text-[22px] font-bold tabular-nums text-ink">{ratings.avg.toFixed(1)}</span>
              <span className="text-[12px] text-ink-subtle">{t("avg")}</span>
            </div>
            <span className="text-[13px] text-ink-muted">
              <span className="font-semibold tabular-nums text-ink">{count}</span>{" "}
              {count === 1 ? t("rating") : t("ratings")}
            </span>
          </div>
          <ArrowedScrollRow className="-mx-5 px-4">
            {ratings.recent.map((r) => (
              <RatingTile key={r.itemKey} r={r} onOpenMeta={onOpenMeta} />
            ))}
          </ArrowedScrollRow>
        </>
      )}
    </section>
  );
}

function RatingTile({
  r,
  onOpenMeta,
}: {
  r: RatingsSummary["recent"][number];
  onOpenMeta?: (metaId: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
}) {
  const poster = useRatingPoster(r.itemKey, r.mediaType, r.title, r.posterUrl);
  return (
    <div className="w-[104px] shrink-0">
      <RatingPoster
        title={r.title}
        posterUrl={poster}
        score={r.score}
        onOpen={onOpenMeta ? () => onOpenMeta(r.itemKey, r.mediaType, { name: r.title, poster }) : undefined}
      />
    </div>
  );
}
