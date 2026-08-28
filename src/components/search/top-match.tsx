import { Play, Star } from "lucide-react";
import type { SearchResults } from "@/lib/search";
import { AwardChips } from "@/components/award-chips";
import { ResultPoster } from "./result-poster";
import { useLocalizedOverview } from "@/lib/use-localized-overview";
import { useView } from "@/lib/view";
import { mergePreferredMeta } from "@/lib/preferred-meta";
import { usePreferredMeta } from "@/lib/use-preferred-meta";

export function TopMatch({
  match,
  onClose,
  collection,
}: {
  match: NonNullable<SearchResults["topMatch"]>;
  onClose: () => void;
  collection?: { name: string; onOpen: () => void };
}) {
  const { openMeta } = useView();
  const yearTxt = match.meta.releaseInfo ?? "";
  const rating = match.voteAverage && match.voteAverage > 0 ? match.voteAverage.toFixed(1) : null;
  const synopsis = (useLocalizedOverview(match.meta) ?? "").trim();
  const preferredMeta = usePreferredMeta(match.meta);
  const displayMeta = mergePreferredMeta(match.meta, preferredMeta);

  const handleOpen = () => {
    openMeta(displayMeta);
    onClose();
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-edge-soft bg-elevated">
      <button
        type="button"
        onClick={handleOpen}
        className="group flex w-full items-center gap-5 p-4 text-start transition-colors duration-150 hover:bg-raised active:scale-[0.997]"
      >
        <div className="relative aspect-[2/3] w-[104px] shrink-0 overflow-hidden rounded-xl ring-1 ring-edge-soft">
          <ResultPoster
            id={match.meta.id}
            poster={match.meta.poster}
            className="block h-full w-full"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent">
            Top match
          </span>
          <h2
            className="mt-1 truncate text-[clamp(22px,2.2vw,30px)] font-medium leading-[1.1] tracking-tight text-ink"
            style={{ fontFamily: "var(--font-display, 'Fraunces')" }}
          >
            {displayMeta.name}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[13px] text-ink-muted">
            <span className="font-medium">{match.kind === "movie" ? "Movie" : "Series"}</span>
            {yearTxt && (
              <>
                <Dot />
                <span>{yearTxt}</span>
              </>
            )}
            {rating && (
              <>
                <Dot />
                <span className="flex items-center gap-1.5 text-ink">
                  <Star size={12} className="fill-accent text-accent" />
                  {rating}
                </span>
              </>
            )}
          </div>
          {synopsis && (
            <p className="mt-2 line-clamp-2 max-w-[64ch] text-[13px] leading-relaxed text-ink-muted">
              {synopsis}
            </p>
          )}
          <div className="mt-2.5">
            <AwardChips
              meta={match.meta}
              imdbId={match.meta.id.startsWith("tt") ? match.meta.id : null}
              limit={4}
              size="sm"
            />
          </div>
          {collection && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                collection.onOpen();
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.stopPropagation();
                collection.onOpen();
              }}
              className="mt-2 inline-flex w-fit items-center gap-1 text-[12.5px] font-semibold text-accent transition-colors hover:text-accent/80"
            >
              {`Part of ${collection.name}`}
              <span aria-hidden>›</span>
            </span>
          )}
        </div>

        <div className="me-1 inline-flex h-10 shrink-0 items-center gap-2 self-center rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-opacity group-hover:opacity-90">
          <Play size={14} className="fill-current" strokeWidth={0} />
          Open
        </div>
      </button>
    </section>
  );
}

function Dot() {
  return <span aria-hidden className="h-1 w-1 rounded-full bg-ink-subtle" />;
}
