import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { MIN_VOTES_MOVIE, MIN_VOTES_TV, type FilmographySort } from "./filmography-rank";

const SORTS: Array<{ id: FilmographySort; label: string }> = [
  { id: "popularity", label: "Popularity" },
  { id: "rating", label: "Rating" },
  { id: "newest", label: "Newest" },
];

const MIN_RATINGS = ["6", "7", "8"];

export function FilmographyBar({
  sort,
  onSort,
  minRating,
  onMinRating,
  resultCount,
}: {
  sort: FilmographySort;
  onSort: (s: FilmographySort) => void;
  minRating: number;
  onMinRating: (r: number) => void;
  resultCount: { shown: number; total: number } | null;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1 pb-1">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
        <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">
          {t("Filmography")}
        </h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 ms-auto">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
              {t("Sort")}
            </span>
            <Dropdown
              value={sort}
              onChange={(v) => onSort(v as FilmographySort)}
              options={SORTS.map((s) => ({ value: s.id, label: t(s.label) }))}
              className="w-[142px]"
            />
          </div>

          <Dropdown
            value={minRating > 0 ? String(minRating) : ""}
            onChange={(v) => onMinRating(v ? Number(v) : 0)}
            options={[
              { value: "", label: t("Any rating") },
              ...MIN_RATINGS.map((r) => ({ value: r, label: t("Rated {r}+", { r }) })),
            ]}
            className="w-[150px]"
          />
        </div>
      </div>
      <p className="flex flex-wrap gap-x-2 text-[11px] leading-tight text-ink-subtle">
        {resultCount && (
          <span className="tabular-nums">
            {t("{n} of {total}", {
              n: String(resultCount.shown),
              total: String(resultCount.total),
            })}
          </span>
        )}
        <span>
          {t("Ratings count from {movie}+ votes, {tv}+ for TV", {
            movie: String(MIN_VOTES_MOVIE),
            tv: String(MIN_VOTES_TV),
          })}
        </span>
      </p>
    </div>
  );
}
