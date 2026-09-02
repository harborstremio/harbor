import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSearch } from "@/lib/search-context";
import { getSearchDisplayState } from "@/lib/search-display-state";
import { useSettings } from "@/lib/settings";
import { useParental } from "@/lib/parental";
import { useUiLanguage } from "@/lib/i18n";
import { matchPersonForQuery } from "@/components/search/person-top-match";
import { useCollectionHits } from "@/components/search/use-collection-hits";
import type { TvdbCollectionHit } from "@/lib/providers/tvdb-collections";
import type { CharacterHit, CharacterMediaRef } from "@/lib/anilist/character";
import type { AnimeHit, LiveTvHit, SearchPerson, SearchResults } from "@/lib/search";
import type { AddonQuery, AddonQueryState } from "@/lib/search-addons";
import type { AddonHit } from "@/lib/search-addon-index";
import type { MangaSummary } from "@/lib/manga/model";
import { useBpT } from "./bp-i18n";

type BpT = (key: string, vars?: Record<string, string | number>) => string;

export type BpSearchFilter =
  | "all"
  | "top"
  | "movie"
  | "series"
  | "people"
  | "anime"
  | "manga"
  | "livetv"
  | "collections"
  | "characters"
  | "addons";

export type BpAddonRowState = AddonQueryState;

type BpSectionBase = {
  key: string;
  label: string;
  group: BpSearchFilter;
  // Addon rows only. The addon's own mark, rendered at real size in the header,
  // because provenance is the whole point of the per-addon block. Anything that
  // is not an addon logo goes in `portrait`: the header styles this one square,
  // and falls back to the bundled addon art and then to a monogram of the row
  // name, which turns a character's face into a badge for an addon that does
  // not exist.
  logo?: string;
  // Franchise rows only. A character's own portrait, drawn round.
  portrait?: string;
  addonState?: BpAddonRowState;
  // The slot has nothing yet and something is still expected. The row is pushed
  // either way so its rail index survives; a skeleton holds the height and carries
  // no focusable, so bpRailStep measures zero cells and steps over it.
  pending: boolean;
};

export type BpSearchSection = BpSectionBase &
  (
    | { kind: "top"; meta: Meta | null; backdrop?: string; overview?: string }
    | { kind: "titles"; metas: Meta[] }
    | { kind: "people"; people: SearchPerson[] }
    | { kind: "anime"; anime: AnimeHit[] }
    | { kind: "manga"; manga: MangaSummary[] }
    | { kind: "livetv"; channels: LiveTvHit[] }
    | { kind: "collections"; collections: TvdbCollectionHit[] }
    | { kind: "addonIndex"; addons: AddonHit[] }
  );

export type BpSearchChip = { id: BpSearchFilter; label: string; count: number };

export type BpSearchState = {
  query: string;
  setQuery: (q: string) => void;
  clear: () => void;
  busy: boolean;
  settled: boolean;
  idle: boolean;
  tmdbUnavailable: boolean;
  hasResults: boolean;
  noResults: boolean;
  filterStale: boolean;
  active: BpSearchFilter;
  chips: BpSearchChip[];
  slots: BpSearchSection[];
  total: number;
  retry: () => void;
};

const GROUP_ORDER: Array<Exclude<BpSearchFilter, "all" | "top">> = [
  "movie",
  "series",
  "people",
  "anime",
  "manga",
  "livetv",
  "collections",
  "characters",
  "addons",
];

const GROUP_LABEL: Record<Exclude<BpSearchFilter, "all" | "top">, string> = {
  movie: "Movies",
  series: "Series",
  people: "People",
  anime: "Anime",
  manga: "Manga",
  livetv: "Live TV",
  collections: "Collections",
  characters: "Franchise",
  addons: "Addons",
};

export function bpSectionCount(s: BpSearchSection): number {
  switch (s.kind) {
    case "top": return s.meta ? 1 : 0;
    case "titles": return s.metas.length;
    case "people": return s.people.length;
    case "anime": return s.anime.length;
    case "manga": return s.manga.length;
    case "livetv": return s.channels.length;
    case "collections": return s.collections.length;
    case "addonIndex": return s.addons.length;
  }
}

// A manga ref carries an AniList id, and openManga is keyed by manga source id, so a
// type:"manga" meta out of here must go through resolveMangaIdByTitle before it can
// be opened. Handing the AniList id straight to openManga opens nothing.
function characterMeta(ref: CharacterMediaRef): Meta {
  return {
    id: `anilist:${ref.anilistId}`,
    type: ref.type === "manga" ? "manga" : "anime",
    name: ref.name,
    poster: ref.poster ?? undefined,
    background: ref.background ?? ref.poster ?? undefined,
    description: ref.overview,
    releaseInfo: ref.year ?? undefined,
    imdbRating: ref.score > 0 ? ref.score.toFixed(1) : undefined,
  };
}

function characterMetas(c: CharacterHit): Meta[] {
  return [...c.anime, ...c.manga].map(characterMeta);
}

// Distinct things found, not cells drawn. Fifteen addons each carrying the same film
// is the fan-out working, but reporting it as fifteen results makes the count a lie.
function bpDistinctCount(sections: BpSearchSection[]): number {
  const seen = new Set<string>();
  let n = 0;
  for (const s of sections) {
    if (s.group === "top") continue;
    if (s.kind !== "titles") {
      n += bpSectionCount(s);
      continue;
    }
    for (const m of s.metas) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      n += 1;
    }
  }
  return n;
}

// Which sources this profile actually asked for. A slot for a source that was
// never queried must not pulse: search-context resolves manga, anime and live TV
// to a synchronous [] when they are switched off, so a skeleton there promises,
// in a designed loading state, content no request was ever issued for.
type BpSourceGates = { anime: boolean; manga: boolean; liveTv: boolean };

type SlotInput = {
  t: BpT;
  r: SearchResults | null;
  addonQueries: AddonQuery[];
  collections: TvdbCollectionHit[];
  fixedSettled: boolean;
  promotePerson: boolean;
  gates: BpSourceGates;
};

// The row set is decided before any network call. Fixed slots are constant and the
// addon slots come from the installed addon list, which searchAddonGroups announces
// as "pending" before it fetches anything. Only row contents arrive progressively,
// which is what lets the rail keep contiguous indices while it fills.
function buildBpSearchSlots(input: SlotInput): BpSearchSection[] {
  const { t, r, addonQueries, collections, fixedSettled, promotePerson, gates } = input;
  const filling = (count: number, queried = true) => queried && count === 0 && !fixedSettled;
  const out: BpSearchSection[] = [];

  const top = r?.topMatch ?? null;
  out.push({
    key: "top", label: t("Top match"), group: "top", pending: filling(top ? 1 : 0),
    kind: "top", meta: top?.meta ?? null, backdrop: top?.backdrop, overview: top?.overview,
  });

  const movies = r?.movies ?? [];
  const series = r?.series ?? [];
  const people = r?.people ?? [];
  const movieSlot: BpSearchSection = {
    key: "movies", label: t("Movies"), group: "movie",
    pending: filling(movies.length), kind: "titles", metas: movies,
  };
  const seriesSlot: BpSearchSection = {
    key: "series", label: t("Series"), group: "series",
    pending: filling(series.length), kind: "titles", metas: series,
  };
  const peopleSlot: BpSearchSection = {
    key: "people", label: t("People"), group: "people",
    pending: filling(people.length), kind: "people", people,
  };
  if (promotePerson) out.push(peopleSlot, movieSlot, seriesSlot);
  else out.push(movieSlot, seriesSlot, peopleSlot);

  const anime = r?.anime ?? [];
  out.push({
    key: "anime", label: t("Anime"), group: "anime",
    pending: filling(anime.length, gates.anime), kind: "anime", anime,
  });

  const manga = r?.manga ?? [];
  out.push({
    key: "manga", label: t("Manga"), group: "manga",
    pending: filling(manga.length, gates.manga), kind: "manga", manga,
  });

  const channels = r?.liveTv ?? [];
  out.push({
    key: "livetv", label: t("Live TV"), group: "livetv",
    pending: filling(channels.length, gates.liveTv), kind: "livetv", channels,
  });

  out.push({
    key: "collections", label: t("Collections"), group: "collections",
    pending: filling(collections.length), kind: "collections", collections,
  });

  // Exactly one franchise slot is reserved. anilistCharacterSearch returns at most one
  // hit, so this keeps the slot count constant for the whole query. If it ever returns
  // more, the extra rows land mid-rail and renumber every addon row below them, so
  // reserve for them here rather than appending them when they arrive.
  const chars = r?.characters ?? [];
  const franchiseQueried = gates.anime || gates.manga;
  if (chars.length === 0) {
    out.push({
      key: "character:reserved", label: t("Franchise"), group: "characters",
      pending: franchiseQueried && !fixedSettled, kind: "titles", metas: [],
    });
  } else {
    for (const c of chars) {
      out.push({
        key: `character:${c.id}`, label: c.name, group: "characters",
        portrait: c.image ?? undefined, pending: false, kind: "titles", metas: characterMetas(c),
      });
    }
  }

  // addonQueries, never addonGroups. search-context strips from each group every id
  // already promoted into the fused Movies and Series rows, which is exactly why a
  // well-matching addon looks like it answered with nothing.
  for (const q of addonQueries) {
    out.push({
      key: `addon:${q.id}`, label: q.name, group: "addons", logo: q.logo,
      addonState: q.state, pending: q.state === "pending", kind: "titles", metas: q.metas,
    });
  }

  const index = r?.addons ?? [];
  out.push({
    key: "addon-index", label: t("Addons you could install"), group: "addons",
    pending: filling(index.length), kind: "addonIndex", addons: index,
  });

  return out;
}

type QueryLatch = { q: string; promote: boolean; decided: boolean; groups: Set<BpSearchFilter> };

export function useBpSearch(filter: BpSearchFilter): BpSearchState {
  const t = useBpT();
  const lang = useUiLanguage();
  const { query, setQuery, results, addonQueries, status, clear, setAiHold, retry } = useSearch();
  const { currentResults, hasResults, tmdbUnavailable } = getSearchDisplayState(results, query, status);
  const collections = useCollectionHits(query.trim());
  const { settings } = useSettings();
  const { hiddenTabs } = useParental();

  // Mirrors search-context's own gating exactly. Read it from there if these ever
  // need to change: a slot that pulses for a source nobody asked for is worse than
  // no slot at all, because the screen is promising something that is never coming.
  const gates = useMemo<BpSourceGates>(
    () => ({
      anime: !hiddenTabs.anime && !settings.hideContent.anime,
      manga: settings.mangaEnabled && !settings.hideContent.manga,
      liveTv: !hiddenTabs.liveTv && settings.iptvPlaylists.length > 0,
    }),
    // length, not the array. Only the count is read, and depending on the array
    // identity would rebuild every slot on any unrelated settings write.
    [hiddenTabs.anime, hiddenTabs.liveTv, settings.hideContent.anime, settings.hideContent.manga, settings.mangaEnabled, settings.iptvPlaylists.length],
  );

  useEffect(() => {
    // Big Picture shares the provider with the desktop overlay, and an armed AI hold
    // blanks every consumer of it, so BP search would return nothing at all.
    setAiHold(false);
  }, [setAiHold]);

  const r = currentResults;
  const trimmed = query.trim();
  const idle = trimmed.length === 0;

  const addonsPending = addonQueries.some((q) => q.state === "pending");
  // status flips to done when the 8s outer guard resolves, but searchAddonGroups keeps
  // answering under its own budget. Reading status alone prints a final count and then
  // grows more rows underneath it, which reads as the app finishing and then glitching.
  // The engine's ALL_GROUPS_BUDGET_MS is what stops this waiting forever.
  const fixedSettled = status === "done";
  const settled = !idle && fixedSettled && !addonsPending;
  const busy = !idle && (!fixedSettled || addonsPending);

  const latchRef = useRef<QueryLatch | null>(null);
  if (!latchRef.current || latchRef.current.q !== trimmed) {
    latchRef.current = { q: trimmed, promote: false, decided: false, groups: new Set() };
  }
  const latch = latchRef.current;
  if (!latch.decided) {
    latch.promote = !!matchPersonForQuery(r?.people, trimmed);
    // Decided once per query. People only ever arrive on the TMDB response, so the
    // answer is final as soon as that lands. Re-deciding later swaps the People row
    // from slot 3 to slot 1 and renumbers the rail under whoever is navigating it.
    if ((r?.people.length ?? 0) > 0 || fixedSettled) latch.decided = true;
  }
  const promote = latch.promote;

  const tRef = useRef(t);
  tRef.current = t;
  const tt = useCallback<BpT>((key, vars) => tRef.current(key, vars), []);

  const all = useMemo<BpSearchSection[]>(
    () =>
      idle
        ? []
        : buildBpSearchSlots({ t: tt, r, addonQueries, collections, fixedSettled, promotePerson: promote, gates }),
    // lang stands in for tt, which is stable by design so labels would otherwise
    // never re-translate on a language change.
    [idle, tt, lang, r, addonQueries, collections, fixedSettled, promote, gates],
  );

  const counts = new Map<BpSearchFilter, number>();
  for (const s of all) {
    if (s.group === "top") continue;
    counts.set(s.group, (counts.get(s.group) ?? 0) + bpSectionCount(s));
  }
  for (const [group, n] of counts) {
    if (n > 0) latch.groups.add(group);
  }

  const chips: BpSearchChip[] = [];
  if (!idle && latch.groups.size > 0) {
    chips.push({ id: "all", label: t("All"), count: bpDistinctCount(all) });
    for (const id of GROUP_ORDER) {
      // A chip is never withdrawn mid-query. dedupeByTitle can shrink a count back to
      // zero when a late source lands, and a chip vanishing under the ring is a dead end.
      if (!latch.groups.has(id) && id !== filter) continue;
      chips.push({ id, label: t(GROUP_LABEL[id]), count: counts.get(id) ?? 0 });
    }
  }

  // The active filter is whatever the viewer chose, never re-derived from the counts.
  // Snapping back to "all" because a late publish emptied the group rebuilds the whole
  // rail on its own, which is the one thing progressive arrival must never do.
  const active = filter;
  const sections = useMemo(
    () => (active === "all" ? all : all.filter((s) => s.group === active)),
    [all, active],
  );

  const total = bpDistinctCount(sections);

  const anyAddonHit = addonQueries.some((q) => q.metas.length > 0);
  const anything = hasResults || anyAddonHit;

  return {
    query,
    setQuery,
    clear,
    busy,
    settled,
    idle,
    tmdbUnavailable,
    hasResults: anything,
    noResults: !!r && settled && !anything && !tmdbUnavailable,
    filterStale: settled && active !== "all" && (counts.get(active) ?? 0) === 0,
    active,
    chips,
    slots: sections,
    total,
    retry,
  };
}
