import { Search } from "@/components/icons/search-icon";
import { useT } from "@/lib/i18n";

export type LibCat = "all" | "Featured" | "Built-in" | "Template" | "Yours";

const CATS: ReadonlyArray<{ id: LibCat; label: string }> = [
  { id: "all", label: "All" },
  { id: "Featured", label: "Featured" },
  { id: "Built-in", label: "Built-in" },
  { id: "Template", label: "Templates" },
  { id: "Yours", label: "Yours" },
];

export function MyLibraryFilters({
  query,
  onQuery,
  cat,
  onCat,
  counts,
  shown,
  total,
}: {
  query: string;
  onQuery: (v: string) => void;
  cat: LibCat;
  onCat: (c: LibCat) => void;
  counts: Record<string, number>;
  shown: number;
  total: number;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-11 items-center gap-2 rounded-md bg-canvas px-3.5">
        <Search size={18} className="text-ink-subtle" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("Search your library")}
          aria-label={t("Search your library")}
          className="h-11 w-48 min-w-0 bg-transparent text-[15.5px] text-ink placeholder:text-ink-subtle focus:outline-none"
        />
      </div>
      {CATS.map((c) => {
        const count = c.id === "all" ? total : (counts[c.id] ?? 0);
        if (c.id !== "all" && count === 0) return null;
        const on = cat === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onCat(c.id)}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[15.5px] font-semibold transition-colors ${
              on
                ? "border-ink bg-ink text-canvas"
                : "border-edge-soft bg-elevated text-ink-muted hover:bg-raised hover:text-ink"
            }`}
          >
            {t(c.label)}
            <span className={`tabular-nums ${on ? "text-canvas/70" : "text-ink-subtle"}`}>
              {count}
            </span>
          </button>
        );
      })}
      <span className="ms-auto text-[15.5px] leading-[22px] tabular-nums text-ink-subtle">
        {t("{shown} of {total}", { shown, total })}
      </span>
    </div>
  );
}
