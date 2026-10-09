import { useT } from "@/lib/i18n";

export type SearchFilterKey =
  | "all"
  | "movies"
  | "shows"
  | "people"
  | "live"
  | "anime"
  | "manga"
  | "music"
  | "ebooks"
  | "sports";

export type SearchAddonFilter = `addon:${string}`;
export type SearchFilter = SearchFilterKey | SearchAddonFilter;
export type SearchAddonPill = { id: string; name: string; logo?: string; count: number };

const ORDER: { key: SearchFilterKey; label: string }[] = [
  { key: "movies", label: "Movies" },
  { key: "shows", label: "Series" },
  { key: "people", label: "People" },
  { key: "live", label: "Live TV" },
  { key: "anime", label: "Anime" },
  { key: "manga", label: "Manga" },
  { key: "music", label: "Music" },
  { key: "ebooks", label: "eBooks" },
  { key: "sports", label: "Sports" },
];

export function SearchFilterBar({
  counts,
  addons = [],
  value,
  onChange,
}: {
  counts: Partial<Record<SearchFilterKey, number>>;
  addons?: SearchAddonPill[];
  value: SearchFilter;
  onChange: (next: SearchFilter) => void;
}) {
  const t = useT();
  const present = ORDER.filter((entry) => (counts[entry.key] ?? 0) > 0);
  const live = addons.filter((entry) => entry.count > 0);
  if (present.length + live.length < 2) return null;
  const total =
    present.reduce((sum, entry) => sum + (counts[entry.key] ?? 0), 0) +
    live.reduce((sum, entry) => sum + entry.count, 0);

  const pill = (key: SearchFilter, label: string, count: number, logo?: string) => {
    const active = value === key;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={active}
        onClick={() => onChange(key)}
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
          active
            ? "border-edge bg-elevated text-ink"
            : "border-edge-soft bg-elevated/40 text-ink-muted hover:border-edge hover:text-ink"
        }`}
      >
        {logo ? (
          <img
            src={logo}
            alt=""
            loading="lazy"
            draggable={false}
            className="-ms-1 size-4 shrink-0 rounded-[3px] object-cover"
          />
        ) : null}
        <span className="max-w-[160px] truncate">{logo ? label : t(label)}</span>
        <span className={active ? "text-ink-muted" : "text-ink-subtle"}>{count}</span>
      </button>
    );
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {pill("all", "All", total)}
      {present.map((entry) => pill(entry.key, entry.label, counts[entry.key] ?? 0))}
      {live.map((entry) =>
        pill(`addon:${entry.id}`, entry.name, entry.count, entry.logo),
      )}
    </div>
  );
}
