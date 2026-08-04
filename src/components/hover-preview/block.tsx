import { ArrowUpRight, Bookmark, BookmarkCheck, Play, Star } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type { PreviewData } from "@/lib/hover-preview/preview-data";
import { tmdbImdbCached } from "@/lib/providers/tmdb";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { ImdbIcon } from "../icons/imdb-icon";
import { MalLogo } from "../icons/mal-logo";

function DecisionLine({ data }: { data: PreviewData }) {
  const parts: ReactNode[] = [];
  if (data.rating) {
    parts.push(
      <span key="rating" className="inline-flex items-center gap-1 align-middle">
        {data.rating.kind === "mal" ? (
          <MalLogo className="h-[11px] w-auto text-ink-muted" />
        ) : data.rating.kind === "tmdb" ? (
          <Star className="h-[11px] w-[11px] text-amber-400" fill="currentColor" strokeWidth={0} />
        ) : (
          <ImdbIcon className="h-[11px] w-auto rounded-[2px]" />
        )}
        <span className="font-semibold text-ink">{data.rating.value}</span>
      </span>,
    );
  }
  if (data.year) parts.push(<span key="year">{data.year}</span>);
  if (data.length) parts.push(<span key="length">{data.length}</span>);
  if (data.genre) parts.push(<span key="genre">{data.genre}</span>);
  if (parts.length === 0) return null;
  return (
    <div
      data-stagger="1"
      className="truncate text-[12.5px] font-medium tabular-nums text-ink-muted"
    >
      {parts.flatMap((p, i) =>
        i === 0
          ? [p]
          : [
              <span key={`dot-${i}`} className="text-ink-subtle">
                {" · "}
              </span>,
              p,
            ],
      )}
    </div>
  );
}

function WatchlistToggle({ data }: { data: PreviewData }) {
  const meta = data.meta;
  const alt = tmdbImdbCached(meta.id);
  const altIds = useMemo(() => [alt ?? undefined], [alt]);
  const active = useInWatchlist(meta.id, altIds);
  return (
    <button
      type="button"
      tabIndex={-1}
      title={active ? "In watchlist" : "Add to watchlist"}
      aria-label={active ? "In watchlist" : "Add to watchlist"}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        toggleWatchlist({
          id: meta.id,
          type: meta.type,
          name: meta.name,
          poster: meta.poster,
          imdbId: alt ?? undefined,
        });
      }}
      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 hover:bg-raised hover:text-ink"
    >
      {active ? (
        <BookmarkCheck size={14} strokeWidth={2.6} fill="currentColor" className="text-ink" />
      ) : (
        <Bookmark size={14} strokeWidth={2.6} />
      )}
    </button>
  );
}

export function PreviewBlock({ data, onDetails }: { data: PreviewData; onDetails: () => void }) {
  const resume = data.resume;
  const inProgress = !!resume && !resume.external;
  const verb = inProgress
    ? resume.season != null && resume.episode != null
      ? `Resume S${resume.season} E${resume.episode}`
      : "Resume"
    : "Details";
  return (
    <div className="flex flex-col gap-3 px-5 pb-4 pt-4">
      <DecisionLine data={data} />
      {data.synopsis && (
        <p data-stagger="2" className="line-clamp-3 text-[13.5px] leading-[1.5] text-ink-muted">
          {data.synopsis}
        </p>
      )}
      <div data-stagger="2" className="flex h-6 items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle transition-colors duration-150 group-hover:text-ink">
          <span className="transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[2px] rtl:group-hover:-translate-x-[2px]">
            {inProgress ? (
              <Play size={12} fill="currentColor" />
            ) : (
              <ArrowUpRight size={12} strokeWidth={2.6} />
            )}
          </span>
          {verb}
        </span>
        {inProgress ? (
          <button
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDetails();
            }}
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle transition-colors duration-150 hover:text-ink"
          >
            Details
          </button>
        ) : (
          <WatchlistToggle data={data} />
        )}
      </div>
    </div>
  );
}
