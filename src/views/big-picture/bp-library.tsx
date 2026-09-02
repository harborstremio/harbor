import { useEffect, useMemo, useState } from "react";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import type { Meta } from "@/lib/cinemeta";
import { SFX } from "@/lib/sfx";
import { useSettings } from "@/lib/settings";
import { applyFilter, countByType, type SortKey, type TypeKey } from "@/views/library/shared";
import { BpCollectionSkeleton } from "./bp-collection-shell";
import { BpGridScroller } from "./bp-grid";
import { BpChip, BpChipRow } from "./bp-library-chips";
import { BpLibraryFilters, type BpFilterGroup } from "./bp-library-filters";
import { BpLibrarySearch } from "./bp-library-search";
import { BpLibrarySections } from "./bp-library-sections";
import {
  buildBpSections,
  capBpSections,
  useBpLibraryFeed,
  useBpLibraryTabs,
} from "./use-bp-library";
import type { BpLibEntry, BpLibSection, BpLibStatus, BpLibTab } from "./bp-library-types";
import type { LocalSortKey, SortDir } from "@/views/library/local-tab/toolbar";
import {
  readLibraryFilterPreferences,
  writeLibraryFilterPreferences,
} from "@/views/library/filter-preferences";
import { useBpT } from "./bp-i18n";
import { useBpPersistedState } from "./bp-view-state";

const PAGE = 40;

const NETWORK_TABS = new Set<BpLibTab>([
  "library",
  "watchlist",
  "history",
  "trakt",
  "anilist",
  "mal",
  "simkl",
  "letterboxd",
]);

const SERVICE_NAMES: Partial<Record<BpLibTab, string>> = {
  trakt: "Trakt",
  anilist: "AniList",
  mal: "MyAnimeList",
  simkl: "Simkl",
  letterboxd: "Letterboxd",
};

const TYPES: Array<{ id: TypeKey; label: string }> = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "Shows" },
];

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "recent", label: "Recent" },
  { id: "title", label: "A-Z" },
  { id: "year", label: "Year" },
];

const OWNED_SORTS: Array<{ id: LocalSortKey; label: string }> = [
  { id: "added", label: "Date added" },
  { id: "title", label: "Title" },
  { id: "year", label: "Year" },
  { id: "rating", label: "Rating" },
  { id: "runtime", label: "Duration" },
];

function numericMeta(entry: BpLibEntry, key: LocalSortKey): number | null {
  const raw =
    key === "year"
      ? entry.meta.releaseInfo?.match(/\d{4}/)?.[0]
      : key === "rating"
        ? entry.meta.imdbRating
        : key === "runtime"
          ? entry.meta.runtime?.match(/\d+/)?.[0]
          : entry.date;
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function sortOwned(entries: BpLibEntry[], key: LocalSortKey, dir: SortDir): BpLibSection[] {
  const mul = dir === "asc" ? 1 : -1;
  const items = [...entries].sort((a, b) => {
    if (key === "title")
      return mul * a.meta.name.localeCompare(b.meta.name, undefined, { sensitivity: "base" });
    const av = numericMeta(a, key);
    const bv = numericMeta(b, key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return mul * (av - bv);
  });
  return [{ label: "", items, total: items.length }];
}

type T = (key: string, vars?: Record<string, string | number>) => string;

function emptyCopy(params: {
  t: T;
  tab: BpLibTab;
  status: BpLibStatus;
  signedIn: boolean;
  total: number;
  hidden: number;
}): string {
  const { t, tab, status, signedIn, total, hidden } = params;
  if (status === "error") {
    const name = SERVICE_NAMES[tab];
    return name
      ? t("Couldn't reach {name}. Try refreshing.", { name })
      : t("Couldn't load your library. Try refreshing.");
  }
  if (total > 0) return t("No matches for these filters.");
  if (tab === "library") {
    return signedIn
      ? t("Nothing saved yet. Add a title from any details page.")
      : t("Sign in to Stremio or connect Trakt in Settings to see your library here.");
  }
  if (tab === "watchlist") return t("Your watchlist is empty.");
  if (tab === "history") {
    return signedIn
      ? t("Nothing watched yet. Press play on something.")
      : t("Sign in to Stremio or connect Trakt in Settings to see what you have been watching.");
  }
  if (tab === "local") return t("No files from your computer yet. Add a folder in Settings.");
  if (tab === "lists") return t("You have no lists yet.");
  if (tab === "favorites") {
    return hidden > 0
      ? t("Your {n} character and manga favorites live on the desktop Favorites tab.", {
          n: hidden,
        })
      : t("No favorites yet. Save a movie or show to see it here.");
  }
  return t("Nothing here yet.");
}

export function BpLibrary({ onSelect }: { onSelect: (m: Meta) => void }) {
  const t = useBpT();
  const { settings, update } = useSettings();
  const tabs = useBpLibraryTabs();
  const [stored, setTab] = useBpPersistedState<BpLibTab>("libraryTab", "library");
  const tab = tabs.some((x) => x.id === stored) ? stored : tabs[0].id;

  const [type, setType] = useState<TypeKey>("all");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [library, setLibrary] = useState("");
  const [genres, setGenres] = useState<Set<string>>(() => new Set());
  const [ownedSort, setOwnedSort] = useState<LocalSortKey>("added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [flat, setFlat] = useState(false);
  const [episodes, setEpisodes] = useState(true);
  const [searching, setSearching] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [filterPrefsSection, setFilterPrefsSection] = useState<"local" | "media-servers" | null>(
    null,
  );

  const feed = useBpLibraryFeed(tab);
  const sort: SortKey = settings.librarySort;

  useEffect(() => {
    const section = tab === "local" || tab === "media-servers" ? tab : null;
    const saved = section ? readLibraryFilterPreferences(section) : {};
    setGroup(
      section === "media-servers" && saved.server && saved.server !== "all" ? saved.server : "",
    );
    setLibrary(
      section === "media-servers" && saved.library && saved.library !== "all" ? saved.library : "",
    );
    setGenres(new Set(saved.genres ?? []));
    setQuery("");
    setType(saved.type ?? "all");
    setOwnedSort(saved.sort ?? "added");
    setSortDir(saved.sortDir ?? "desc");
    setFilterPrefsSection(section);
  }, [tab]);

  useEffect(() => {
    if (filterPrefsSection == null || filterPrefsSection !== tab) return;
    writeLibraryFilterPreferences(filterPrefsSection, {
      type,
      genres: [...genres],
      sort: ownedSort,
      sortDir,
      ...(filterPrefsSection === "media-servers"
        ? { server: group || "all", library: library || "all" }
        : {}),
    });
  }, [filterPrefsSection, tab, type, genres, ownedSort, sortDir, group, library]);

  useEffect(() => {
    setLimit(PAGE);
  }, [tab, type, query, group, library, genres, sort, ownedSort, sortDir, flat, episodes]);

  const scoped = useMemo(
    () =>
      feed.entries.filter(
        (e) =>
          (!group || e.group === group || e.groups?.includes(group)) &&
          (!library || e.libraries?.includes(library)),
      ),
    [feed.entries, group, library],
  );

  const counts = useMemo(() => countByType(scoped), [scoped]);
  const visible = useMemo(
    () =>
      applyFilter(scoped, type, query).filter((entry) => {
        if (genres.size === 0) return true;
        if (tab === "local") return entry.meta.genres?.some((genre) => genres.has(genre)) ?? false;
        return [...genres].every((genre) => entry.meta.genres?.includes(genre));
      }),
    [scoped, type, query, genres, tab],
  );
  const dated = useMemo(() => visible.some((e) => e.date != null), [visible]);
  const years = useMemo(() => visible.some((e) => e.meta.releaseInfo), [visible]);
  const ownedTab = tab === "local" || tab === "media-servers";
  const sections = useMemo(
    () =>
      ownedTab ? sortOwned(visible, ownedSort, sortDir) : buildBpSections(visible, sort, flat),
    [visible, ownedTab, ownedSort, sortDir, sort, flat],
  );
  const paged = useMemo(() => capBpSections(sections, limit), [sections, limit]);

  const groupCount = useMemo(() => {
    const out = new Map<string, number>();
    for (const e of feed.entries) {
      const memberships = e.groups ?? (e.group ? [e.group] : []);
      for (const membership of memberships) out.set(membership, (out.get(membership) ?? 0) + 1);
    }
    return out;
  }, [feed.entries]);
  const libraryCount = useMemo(() => {
    const out = new Map<string, number>();
    for (const entry of feed.entries)
      for (const id of entry.libraries ?? []) out.set(id, (out.get(id) ?? 0) + 1);
    return out;
  }, [feed.entries]);
  const genreOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of scoped)
      for (const genre of entry.meta.genres ?? []) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [scoped]);

  const first = feed.status === "loading" && feed.entries.length === 0;
  const showEmpty = visible.length === 0 && !first;

  const tabLabel = tabs.find((x) => x.id === tab)?.label ?? "";
  const sorts = SORTS.filter((item) => item.id !== "year" || years);

  const filterGroups: BpFilterGroup[] = [];
  if (feed.groups.length > 0) {
    filterGroups.push({
      key: "group",
      heading: t(tabLabel),
      active: group,
      onPick: setGroup,
      options: [
        { id: "", label: t("All"), count: feed.entries.length },
        ...feed.groups.map((g) => ({
          id: g.id,
          label: t(g.label),
          count: groupCount.get(g.id) ?? 0,
        })),
      ],
    });
  }
  if (tab === "media-servers" && (feed.libraries?.length ?? 0) > 0) {
    filterGroups.push({
      key: "library",
      heading: t("Library"),
      active: library,
      onPick: setLibrary,
      options: [
        { id: "", label: t("All libraries"), count: feed.entries.length },
        ...feed.libraries!.map((item) => ({
          id: item.id,
          label: item.label,
          count: libraryCount.get(item.id) ?? 0,
        })),
      ],
    });
  }
  filterGroups.push({
    key: "type",
    heading: t("Type"),
    active: type,
    onPick: (id) => setType(id as TypeKey),
    options: TYPES.map((item) => ({ id: item.id, label: t(item.label), count: counts[item.id] })),
  });
  if (ownedTab && genreOptions.length > 0) {
    filterGroups.push({
      key: "genre",
      heading: t("Genre"),
      active: "",
      selected: (id) => genres.has(id),
      onPick: (id) =>
        setGenres((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      options: genreOptions.map(([label, count]) => ({ id: label, label, count })),
    });
  }
  filterGroups.push(
    ownedTab
      ? {
          key: "sort",
          heading: t("Sort"),
          active: ownedSort,
          onPick: (id) => setOwnedSort(id as LocalSortKey),
          options: OWNED_SORTS.map((item) => ({ id: item.id, label: t(item.label) })),
        }
      : {
          key: "sort",
          heading: t("Sort"),
          active: sort,
          onPick: (id) => update({ librarySort: id as SortKey }),
          options: sorts.map((item) => ({ id: item.id, label: t(item.label) })),
        },
  );
  if (ownedTab) {
    filterGroups.push({
      key: "direction",
      heading: t("Direction"),
      active: sortDir,
      onPick: (id) => setSortDir(id as SortDir),
      options: [
        { id: "asc", label: t("Ascending") },
        { id: "desc", label: t("Descending") },
      ],
    });
  }
  if (!ownedTab && sort === "recent" && dated) {
    filterGroups.push({
      key: "grouping",
      heading: t("View"),
      active: flat ? "flat" : "grouped",
      onPick: (id) => setFlat(id === "flat"),
      options: [
        { id: "grouped", label: t("Grouped") },
        { id: "flat", label: t("One list") },
      ],
    });
  }
  if (tab === "history") {
    filterGroups.push({
      key: "cards",
      heading: t("Episodes"),
      active: episodes ? "episodes" : "posters",
      onPick: (id) => setEpisodes(id === "episodes"),
      options: [
        { id: "posters", label: t("Posters") },
        { id: "episodes", label: t("Episodes") },
      ],
    });
  }

  // The chip prints its own state, so the current filter is readable across a
  // room without opening anything. Group first because it is the one a viewer
  // sets deliberately; type and sort read as the standing state.
  const summary = [
    group ? (feed.groups.find((g) => g.id === group)?.label ?? "") : "",
    library ? (feed.libraries?.find((item) => item.id === library)?.label ?? "") : "",
    TYPES.find((x) => x.id === type)?.label ?? "",
    ownedTab
      ? (OWNED_SORTS.find((x) => x.id === ownedSort)?.label ?? "")
      : (sorts.find((x) => x.id === sort)?.label ?? ""),
    ownedTab ? (sortDir === "asc" ? "Ascending" : "Descending") : "",
  ]
    .filter(Boolean)
    .map((label) => t(label))
    .join("  ·  ");

  return (
    <div className="flex h-full flex-col gap-[clamp(6px,0.8vh,14px)] px-[var(--bp-gutter)] pt-[var(--bp-page-top)]">
      <BpChipRow
        trailing={
          <span className="ms-auto shrink-0 text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {visible.length > 0 ? t("{n} titles", { n: visible.length }) : ""}
          </span>
        }
      >
        {tabs.map((item) => (
          <BpChip
            key={item.id}
            label={t(item.label)}
            selected={tab === item.id}
            // The one state with no grid to seed. Named here rather than left to
            // recoverBpFocus, which lands on whatever bpFocusables(scope)[0]
            // happens to be and moves the day the markup is reordered.
            autofocus={(showEmpty || first) && tab === item.id}
            onSelect={() => setTab(item.id)}
          />
        ))}
      </BpChipRow>

      {/* Three stops, not eighteen, and each of the three is a different KIND of
          thing: what you are looking at, what you are looking for, and go get it
          again. Refresh is an action rather than a filter, so it stays out of
          the filter panel however tempting the tidiness is. */}
      <BpChipRow>
        <BpChip
          label={summary}
          ariaLabel={`${t("Filters")}: ${summary}`}
          icon={<SlidersHorizontal size={16} strokeWidth={2.3} />}
          selected={Boolean(group) || Boolean(library) || genres.size > 0 || type !== "all"}
          onSelect={() => {
            SFX.open();
            setFiltering(true);
          }}
        />

        <BpChip
          label={query || t("Search")}
          icon={<Search size={16} strokeWidth={2.3} />}
          selected={Boolean(query)}
          onSelect={() => setSearching(true)}
        />

        {NETWORK_TABS.has(tab) && (
          <BpChip
            label={t("Refresh")}
            icon={
              <RefreshCw
                size={16}
                strokeWidth={2.3}
                className={
                  feed.status === "loading" ? "animate-spin motion-reduce:animate-none" : ""
                }
              />
            }
            onSelect={() => {
              SFX.open();
              feed.refresh();
            }}
          />
        )}
      </BpChipRow>

      <BpGridScroller>
        {first && <BpCollectionSkeleton />}

        {!showEmpty && !first && (
          <BpLibrarySections
            sections={paged.sections}
            episodes={tab === "history" && episodes}
            shown={paged.shown}
            hasMore={paged.shown < visible.length}
            onMore={() => setLimit((n) => n + PAGE)}
            onSelect={onSelect}
          />
        )}

        {showEmpty && (
          <div className="flex h-full min-h-[40vh] items-center justify-center">
            <p className="max-w-[46ch] text-center text-[clamp(13.5px,1.95vh,22px)] font-medium text-ink-subtle">
              {emptyCopy({
                t,
                tab,
                status: feed.status,
                signedIn: feed.signedIn,
                total: scoped.length,
                hidden: feed.hidden ?? 0,
              })}
            </p>
          </div>
        )}
      </BpGridScroller>

      {filtering && <BpLibraryFilters groups={filterGroups} onClose={() => setFiltering(false)} />}

      {searching && (
        <BpLibrarySearch query={query} onChange={setQuery} onClose={() => setSearching(false)} />
      )}
    </div>
  );
}
