import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, Pin, Puzzle, Search, SlidersHorizontal, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { listBrowseCatalogs, type BrowseCatalog } from "@/lib/catalog-browse";
import { queryKeys } from "@/lib/query";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { CatalogShelf, prefetchCatalogShelf } from "./catalogs/catalog-shelf";
import { CatalogManageList } from "./catalogs/catalog-manage-list";
import { AddonFilterSelect } from "./catalogs/addon-filter-select";
import { useCatalogList } from "./catalogs/use-catalog-list";

const TYPE_LABELS: Record<string, string> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  tv: "TV",
  channel: "Channels",
};

/** First N shelves load eagerly + prefetched so posters appear without waiting for IO. */
const EAGER_SHELF_COUNT = 8;

export function Catalogs({ active = true }: { active?: boolean }) {
  const t = useT();
  const { authKey } = useAuth();
  const { setView } = useView();
  const { settings, update } = useSettings();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [addonFilter, setAddonFilter] = useState("all");
  const [customize, setCustomize] = useState(false);

  const {
    data: catalogs = [],
    isPending: loading,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.catalog.list(authKey),
    queryFn: () => listBrowseCatalogs(authKey),
    enabled: active,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  const pinned = settings.catalogsPinned ?? [];
  const hidden = settings.catalogsHidden ?? [];
  const { types, addons, filtered, pinnedCats, pinnedSet, hiddenSet, groups } = useCatalogList(
    catalogs,
    { query, typeFilter, addonFilter },
    pinned,
    hidden,
  );

  // Prefetch poster pages for the shelves the user will see first.
  useEffect(() => {
    if (!active || catalogs.length === 0) return;
    const visible: BrowseCatalog[] = [...pinnedCats, ...groups.flatMap((g) => g.cats)];
    const seen = new Set<string>();
    let n = 0;
    for (const c of visible) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      prefetchCatalogShelf(queryClient, c);
      n += 1;
      if (n >= EAGER_SHELF_COUNT) break;
    }
  }, [active, catalogs, pinnedCats, groups, queryClient]);

  const togglePin = (key: string) =>
    update({
      catalogsPinned: pinned.includes(key) ? pinned.filter((k) => k !== key) : [...pinned, key],
    });
  const toggleHide = (key: string) =>
    update({
      catalogsHidden: hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key],
    });
  const movePin = (key: string, dir: -1 | 1) => {
    const arr = [...pinned];
    const i = arr.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    update({ catalogsPinned: arr });
  };

  const hiddenCount = useMemo(
    () => (customize ? 0 : catalogs.filter((c) => hiddenSet.has(c.key)).length),
    [customize, catalogs, hiddenSet],
  );

  const eagerKeys = useMemo(() => {
    const keys = new Set<string>();
    const order = [...pinnedCats, ...groups.flatMap((g) => g.cats)];
    for (const c of order) {
      if (keys.size >= EAGER_SHELF_COUNT) break;
      keys.add(c.key);
    }
    return keys;
  }, [pinnedCats, groups]);

  return (
    <main className="flex-1 overflow-y-auto px-12 pb-24 pt-28">
      <div data-tauri-drag-region className="flex flex-col gap-8">
        <header className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-[30px] font-medium tracking-tight text-ink">
                {t("Catalogs")}
              </h1>
              <p className="text-[14px] text-ink-muted">
                {customize
                  ? t("Choose what shows, what stays hidden, and what sits up top.")
                  : t(
                      "Everything your addons offer, shown as posters. Scroll, search, or filter to what you want.",
                    )}
              </p>
            </div>
            {!loading && catalogs.length > 0 && (
              <button
                onClick={() => setCustomize((v) => !v)}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors ${
                  customize
                    ? "bg-ink text-canvas"
                    : "border border-edge-soft bg-elevated/40 text-ink-muted hover:bg-elevated hover:text-ink"
                }`}
              >
                {customize ? <Check size={16} /> : <SlidersHorizontal size={15} />}
                {customize ? t("Done") : t("Customize")}
              </button>
            )}
          </div>

          {!loading && catalogs.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative h-11 w-full max-w-[360px] min-w-0">
                  <Search
                    size={16}
                    className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("Search catalogs")}
                    spellCheck={false}
                    className="h-full w-full rounded-full border border-edge-soft bg-elevated/40 ps-10 pe-9 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-edge"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      aria-label={t("Clear")}
                      className="absolute end-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip
                    label={t("All")}
                    active={typeFilter === "all"}
                    onClick={() => setTypeFilter("all")}
                  />
                  {types.map((ty) => (
                    <Chip
                      key={ty}
                      label={t(TYPE_LABELS[ty] ?? ty)}
                      active={typeFilter === ty}
                      onClick={() => setTypeFilter(ty)}
                    />
                  ))}
                </div>
                {addons.length > 1 && (
                  <AddonFilterSelect
                    addons={addons}
                    value={addonFilter}
                    onChange={setAddonFilter}
                  />
                )}
              </div>
            </div>
          )}
        </header>

        {loading && catalogs.length === 0 ? (
          <ShelfSkeletons />
        ) : catalogs.length === 0 && !isFetching ? (
          <EmptyState onOpenAddons={() => setView("addons")} />
        ) : customize ? (
          filtered.length === 0 ? (
            <NoMatch />
          ) : (
            <CatalogManageList
              filtered={filtered}
              pinnedCats={pinnedCats}
              pinnedSet={pinnedSet}
              hiddenSet={hiddenSet}
              onTogglePin={togglePin}
              onToggleHide={toggleHide}
              onMovePin={movePin}
            />
          )
        ) : pinnedCats.length === 0 && groups.length === 0 ? (
          hiddenCount > 0 ? (
            <AllHidden count={hiddenCount} onCustomize={() => setCustomize(true)} />
          ) : (
            <NoMatch />
          )
        ) : (
          <>
            {pinnedCats.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <Pin size={16} className="text-accent" />
                  <h2 className="text-[15.5px] font-semibold tracking-tight text-ink">
                    {t("Pinned")}
                  </h2>
                  <span className="text-[12px] text-ink-subtle">{pinnedCats.length}</span>
                </div>
                <div className="flex flex-col gap-7">
                  {pinnedCats.map((c) => (
                    <CatalogShelf key={c.key} catalog={c} eager={eagerKeys.has(c.key)} />
                  ))}
                </div>
              </section>
            )}
            {groups.map((g) => (
              <section key={g.name} className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  {g.logo ? (
                    <img
                      src={g.logo}
                      alt=""
                      draggable={false}
                      className="h-6 w-6 rounded-[6px] object-contain"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-elevated text-[11px] font-bold text-ink-subtle ring-1 ring-edge-soft">
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <h2 className="text-[15.5px] font-semibold tracking-tight text-ink">{g.name}</h2>
                  <span className="text-[12px] text-ink-subtle">{g.cats.length}</span>
                </div>
                <div className="flex flex-col gap-7">
                  {g.cats.map((c) => (
                    <CatalogShelf key={c.key} catalog={c} eager={eagerKeys.has(c.key)} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
        active
          ? "bg-ink text-canvas"
          : "bg-elevated/40 text-ink-muted hover:bg-elevated hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ShelfSkeletons() {
  return (
    <div className="flex flex-col gap-10">
      {[0, 1, 2].map((s) => (
        <div key={s} className="flex flex-col gap-3">
          <div className="h-4 w-32 animate-pulse rounded-full bg-elevated/50" />
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-xl bg-elevated/35"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NoMatch() {
  const t = useT();
  return (
    <p className="rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-6 py-12 text-center text-[13.5px] text-ink-muted">
      {t("No catalogs match your search.")}
    </p>
  );
}

function AllHidden({ count, onCustomize }: { count: number; onCustomize: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-14 text-center">
      <p className="text-[13.5px] text-ink-muted">
        {count === 1
          ? t("You've hidden the one catalog that matched.")
          : t("You've hidden every catalog that matched.")}
      </p>
      <button
        onClick={onCustomize}
        className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-elevated/40 px-5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-elevated"
      >
        <SlidersHorizontal size={15} />
        {t("Customize")}
      </button>
    </div>
  );
}

function EmptyState({ onOpenAddons }: { onOpenAddons: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
      <Puzzle size={30} strokeWidth={1.6} className="text-ink-subtle" />
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-semibold text-ink">{t("No catalogs yet")}</h2>
        <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
          {t(
            "Install a Stremio addon and its catalogs show up here as poster rails, ready to browse.",
          )}
        </p>
      </div>
      <button
        onClick={onOpenAddons}
        className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        {t("Browse addons")}
      </button>
    </div>
  );
}
