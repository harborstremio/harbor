import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ChevronLeft,
  Package,
  RefreshCw,
  Sparkles,
  Star,
  Upload,
} from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useT } from "@/lib/i18n";
import { type BundleKind, type StoreBundle } from "@/lib/bundle-store";
import type { StoreTheme } from "@/lib/theme-store";
import { SectionHeader } from "@/views/profile/section-header";
import { useStoreBundles } from "./use-store-bundles";
import { BundleDetail } from "./bundle-detail";
import { BundleHero } from "./bundle-hero";
import { BundleSkeleton } from "./bundle-skeleton";
import { MarketRail } from "./market/market-rail";
import { MarketCard } from "./market/market-card";

const SORTS = [
  { id: "top", label: "Top rated" },
  { id: "downloads", label: "Most installed" },
  { id: "new", label: "Newest" },
] as const;

type SortId = (typeof SORTS)[number]["id"];

type Copy = {
  unit: string;
  units: string;
  search: string;
  heroLabel: string;
  emptyTitle: string;
  emptyBody: string;
  share: string;
  noResults: string;
};

const COPY: Record<BundleKind, Copy> = {
  badge: {
    unit: "badge pack",
    units: "badge packs",
    search: "Search badge packs",
    heroLabel: "Badge pack",
    emptyTitle: "No badge packs yet",
    emptyBody:
      "Be the first to share a set of badge icons. Publish a pack and it shows up here for everyone.",
    noResults: "No badge packs match your search.",
    share: "Share a badge pack",
  },
  award: {
    unit: "award pack",
    units: "award packs",
    search: "Search award packs",
    heroLabel: "Award pack",
    emptyTitle: "No award packs yet",
    emptyBody:
      "Be the first to reskin the award trophies. Publish a pack and it shows up here for everyone.",
    noResults: "No award packs match your search.",
    share: "Share an award pack",
  },
};

function sortBundles(list: StoreBundle[], sort: SortId): StoreBundle[] {
  const copy = [...list];
  if (sort === "downloads") return copy.sort((a, b) => b.downloads - a.downloads);
  if (sort === "new")
    return copy.sort((a, b) =>
      b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0,
    );
  return copy.sort(
    (a, b) =>
      b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount || b.downloads - a.downloads,
  );
}

export function BundleBrowse({ kind, onShare }: { kind: BundleKind; onShare?: () => void }) {
  const t = useT();
  const { bundles, loading, error, reload } = useStoreBundles(kind);
  const [sort, setSort] = useState<SortId>("top");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"shelves" | "all">("shelves");
  const [selected, setSelected] = useState<StoreBundle | null>(null);
  const copy = COPY[kind];
  const q = query.trim().toLowerCase();

  const hero = useMemo(() => {
    if (!bundles || bundles.length === 0) return null;
    const ranked = [...bundles].sort(
      (a, b) => b.ratingAvg - a.ratingAvg || b.downloads - a.downloads,
    );
    return ranked.find((b) => b.cover) ?? ranked[0] ?? null;
  }, [bundles]);

  const rails = useMemo(() => {
    const without = bundles && hero ? bundles.filter((b) => b.id !== hero.id) : (bundles ?? []);
    return {
      top: sortBundles(without, "top"),
      downloads: sortBundles(without, "downloads"),
      new: sortBundles(without, "new"),
    };
  }, [bundles, hero]);

  const shown = useMemo(() => {
    if (!bundles) return [];
    const filtered = q
      ? bundles.filter((b) => `${b.name} ${b.author} ${b.description}`.toLowerCase().includes(q))
      : bundles;
    return sortBundles(filtered, sort);
  }, [bundles, q, sort]);

  if (loading) return <BundleSkeleton />;
  if (error) return <BundleError message={error} onRetry={reload} />;
  if (!bundles || bundles.length === 0) return <BundleEmpty copy={copy} onShare={onShare} />;

  const showShelves = view === "shelves" && !q && bundles.length >= 6;
  const openBundle = (it: StoreTheme | StoreBundle) => setSelected(it as StoreBundle);
  const browseWith = (s: SortId) => {
    setSort(s);
    setView("all");
  };

  return (
    <section className="flex flex-col gap-10">
      {showShelves && hero && (
        <BundleHero bundle={hero} label={copy.heroLabel} onOpen={openBundle} />
      )}

      <div className="flex flex-col gap-8 ps-[9px]">
        <FilterBar
          query={query}
          onQuery={setQuery}
          activeSort={view === "all" ? sort : null}
          onSort={browseWith}
          count={shown.length}
          copy={copy}
          onBack={view === "all" && !q ? () => setView("shelves") : undefined}
        />

        {showShelves ? (
          <div className="flex flex-col gap-10">
            <MarketRail
              title={t("Top rated")}
              subtitle={t("Highly rated by the community")}
              icon={<Star size={14} strokeWidth={2.2} />}
              items={rails.top}
              kind={kind}
              ranked
              scrollKey={`bundles-${kind}-top`}
              onOpen={openBundle}
              onViewAll={() => browseWith("top")}
            />
            <MarketRail
              title={t("Most installed")}
              icon={<ArrowDownToLine size={14} strokeWidth={2.2} />}
              items={rails.downloads}
              kind={kind}
              scrollKey={`bundles-${kind}-dl`}
              onOpen={openBundle}
              onViewAll={() => browseWith("downloads")}
            />
            <MarketRail
              title={t("Newest")}
              icon={<Sparkles size={14} strokeWidth={2.2} />}
              items={rails.new}
              kind={kind}
              scrollKey={`bundles-${kind}-new`}
              onOpen={openBundle}
              onViewAll={() => browseWith("new")}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <SectionHeader
              icon={<Package size={14} strokeWidth={2.2} />}
              label={q ? t("Results") : t("All packs")}
            />
            {shown.length === 0 ? (
              <p className="rounded-md border border-dashed border-edge px-4 py-14 text-center text-[13px] text-ink-subtle">
                {t(copy.noResults)}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {shown.map((b, i) => (
                  <MarketCard
                    key={b.id}
                    item={b}
                    kind={kind}
                    rank={!q && sort === "top" ? i + 1 : undefined}
                    onOpen={openBundle}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selected && <BundleDetail bundle={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function FilterBar({
  query,
  onQuery,
  activeSort,
  onSort,
  count,
  copy,
  onBack,
}: {
  query: string;
  onQuery: (v: string) => void;
  activeSort: SortId | null;
  onSort: (s: SortId) => void;
  count: number;
  copy: Copy;
  onBack?: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-elevated pe-3.5 ps-2.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <ChevronLeft size={14} strokeWidth={2.4} className="dir-icon" /> {t("Featured")}
        </button>
      )}
      <div className="flex h-8 items-center gap-2 rounded-full bg-elevated px-3.5">
        <Search size={14} className="text-ink-subtle" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t(copy.search)}
          className="w-40 bg-transparent text-[12.5px] text-ink placeholder:text-ink-subtle focus:outline-none"
        />
      </div>
      {SORTS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSort(s.id)}
          className={`h-8 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors ${
            activeSort === s.id
              ? "border-ink bg-ink text-canvas"
              : "border-edge-soft bg-elevated text-ink-muted hover:border-edge hover:text-ink"
          }`}
        >
          {t(s.label)}
        </button>
      ))}
      <span className="ms-auto text-[12.5px] tabular-nums text-ink-subtle">
        {count} {count === 1 ? t(copy.unit) : t(copy.units)}
      </span>
    </div>
  );
}

function BundleError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-md bg-surface px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-danger/15 text-danger">
        <AlertCircle size={22} />
      </span>
      <p className="text-[13.5px] text-ink-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] motion-reduce:active:scale-100"
      >
        <RefreshCw size={14} strokeWidth={2.2} /> {t("Try again")}
      </button>
    </div>
  );
}

function BundleEmpty({ copy, onShare }: { copy: Copy; onShare?: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-md border border-dashed border-edge bg-surface px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
        <Package size={26} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[18px] font-semibold tracking-tight text-ink">{t(copy.emptyTitle)}</h3>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">{t(copy.emptyBody)}</p>
      </div>
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          className="flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[13.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] motion-reduce:active:scale-100"
        >
          <Upload size={16} strokeWidth={2.2} /> {t(copy.share)}
        </button>
      )}
    </div>
  );
}
