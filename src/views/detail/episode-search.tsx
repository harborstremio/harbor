import { X } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useT } from "@/lib/i18n";

export function EpisodeSearch({
  query,
  onQuery,
  matched,
}: {
  query: string;
  onQuery: (q: string) => void;
  matched: number | null;
}) {
  const t = useT();
  return (
    <div className="relative flex items-center">
      <Search
        size={15}
        strokeWidth={2.2}
        className="pointer-events-none absolute start-3.5 text-ink-subtle"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={t("Search by episode number or title")}
        className="h-11 w-full rounded-lg bg-canvas ps-10 pe-24 text-[14px] text-ink outline-none ring-1 ring-inset ring-edge-soft transition-colors duration-150 placeholder:text-ink-subtle focus:ring-accent/50"
      />
      {query.trim() !== "" && (
        <div className="absolute end-2.5 flex items-center gap-2">
          <span className="text-[12.5px] tabular-nums text-ink-subtle">{matched ?? 0}</span>
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label={t("Clear")}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-elevated/60 hover:text-ink"
          >
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
}
