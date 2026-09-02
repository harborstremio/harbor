import { Loader2, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { Addon } from "@/lib/addons";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import { languageName } from "@/lib/subtitles/language";
import { HoverTooltip } from "@/components/hover-tooltip";
import { searchSubtitles, type SearchOptions } from "@/lib/subtitles/search";
import { subtitleLoadMetadataOf, subtitleTitleOf } from "@/lib/subtitles/provider-label";
import type { SubResult } from "@/lib/subtitles/types";
import {
  bestCandidate,
  parseTitleQuery,
  searchTitleCandidates,
  type TitleCandidate,
} from "@/lib/subtitles/title-search";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useSubtitleContext } from "./subtitle-context-store";
import type { SubtitleMenuProps } from "./types";
import { isVeryNewRelease } from "./utils";
import { FilterChip, LangGroup } from "./search-results";
import type { StreamHints } from "@/lib/subtitles/stream-hints";
import {
  readSubtitleSearchCacheEntry,
  subtitleSearchCacheKey,
  subtitleSearchResultsMayBeCached,
  type SubtitleSearchCacheEntry,
  type SubtitleSearchCacheScope,
} from "@/lib/subtitles/search-cache";
import { TargetBar, TitleSuggestDropdown } from "./title-suggest";

type TitleTarget = {
  imdbId: string;
  type: "movie" | "series";
  title: string;
  year?: string;
  season?: number;
  episode?: number;
};

function labelOf(t: TitleTarget): string {
  return t.year ? `${t.title} (${t.year})` : t.title;
}

function isPlayingTarget(a: TitleTarget, b: TitleTarget): boolean {
  return (
    a.imdbId === b.imdbId && a.title === b.title && a.season === b.season && a.episode === b.episode
  );
}

const searchCache = new Map<string, SubtitleSearchCacheEntry>();

type SavedSearchState = {
  playingKey: string;
  target: TitleTarget;
  isOverride: boolean;
  query: string;
  hideHI: boolean;
  forcedOnly: boolean;
  sortBySource: boolean;
  filtersOpen: boolean;
  scrollTop: number;
};

let savedState: SavedSearchState | null = null;

function playingKeyOf(
  metaImdbId?: string | null,
  metaTitle?: string | null,
  season?: number | null,
  episode?: number | null,
): string {
  return `${metaImdbId ?? ""}|${metaTitle ?? ""}|${season ?? ""}|${episode ?? ""}`;
}

export function SearchSection(props: SubtitleMenuProps) {
  const t = useT();
  const { metaImdbId, metaTitle, season, episode, onAddSubtitle } = props;
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const playbackContext = useSubtitleContext();

  const playingTarget = useMemo<TitleTarget>(() => {
    // Context coords are authoritative when present; long-running anime
    // intentionally carry no season (undefined beats the raw prop).
    const hasCoords = playbackContext?.searchEpisode != null;
    const s = hasCoords ? playbackContext!.searchSeason : (season ?? undefined);
    const e = hasCoords ? playbackContext!.searchEpisode : (episode ?? undefined);
    return {
      imdbId: metaImdbId ?? "",
      type: s != null && e != null ? "series" : "movie",
      title: metaTitle ?? "",
      season: s ?? undefined,
      episode: e ?? undefined,
    };
  }, [metaImdbId, metaTitle, season, episode, playbackContext]);

  const playingKey = playingKeyOf(metaImdbId, metaTitle, season, episode);
  const restorableRef = useRef(
    savedState && savedState.playingKey === playingKey ? savedState : null,
  );
  const restorable = restorableRef.current;

  const [target, setTarget] = useState<TitleTarget>(restorable?.target ?? playingTarget);
  const [isOverride, setIsOverride] = useState(restorable?.isOverride ?? false);
  const [query, setQuery] = useState(
    restorable?.query ??
      (metaTitle && playingTarget.season != null && playingTarget.episode != null
        ? `${metaTitle} S${String(playingTarget.season).padStart(2, "0")}E${String(
            playingTarget.episode,
          ).padStart(2, "0")}`
        : (metaTitle ?? "")),
  );
  const [suggestions, setSuggestions] = useState<TitleCandidate[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(restorable?.scrollTop ?? 0);
  const scrollRestored = useRef(false);
  const [results, setResults] = useState<SubResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hideHI, setHideHI] = useState(restorable?.hideHI ?? false);
  const [forcedOnly, setForcedOnly] = useState(restorable?.forcedOnly ?? false);
  const [sortBySource, setSortBySource] = useState(restorable?.sortBySource ?? false);
  const [filtersOpen, setFiltersOpen] = useState(restorable?.filtersOpen ?? true);
  const [addons, setAddons] = useState<Addon[] | null>(null);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const lastAutoSearchKey = useRef<string | null>(null);
  const searchSeq = useRef(0);
  const coordsTouchedRef = useRef(false);
  const [pendingSources, setPendingSources] = useState(0);
  const resultStreamHints = useMemo<StreamHints>(
    () => ({
      release:
        (isPlayingTarget(target, playingTarget) ? playbackContext?.filename : null) ?? target.title,
      season: target.season ?? null,
      episode: target.episode ?? null,
    }),
    [target, playingTarget, playbackContext],
  );

  const cacheScope = (tgt: TitleTarget): SubtitleSearchCacheScope => {
    const enabled = settings.subProvidersEnabled ?? {};
    const titleOnly = !tgt.imdbId && Boolean(tgt.title);
    const subdl = enabled.subdl === true && Boolean(settings.subdlApiKey.trim());
    const subsource = enabled.subsource === true && Boolean(settings.subsourceApiKey.trim());
    return {
      languages: settings.preferredSubLangs ?? [],
      providers: {
        wyzie: titleOnly || enabled.wyzie === true,
        addons: enabled.addons ?? true,
        opensubtitles: enabled.opensubtitles ?? true,
        subdl,
        subsource,
      },
      addonUrls: (addons ?? []).map((addon) => addon.transportUrl),
      credentialBound: subdl || subsource,
    };
  };

  const cacheKeyFor = (tgt: TitleTarget, filename?: string | null) =>
    subtitleSearchCacheKey({ ...tgt, filename, scope: cacheScope(tgt) });

  const latestStateRef = useRef<Omit<SavedSearchState, "scrollTop">>({
    playingKey,
    target,
    isOverride,
    query,
    hideHI,
    forcedOnly,
    sortBySource,
    filtersOpen,
  });
  latestStateRef.current = {
    playingKey,
    target,
    isOverride,
    query,
    hideHI,
    forcedOnly,
    sortBySource,
    filtersOpen,
  };

  useEffect(() => {
    return () => {
      savedState = { ...latestStateRef.current, scrollTop: scrollTopRef.current };
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAddonsLoading(true);
    gatherSubtitleAddons(authKey)
      .then((a) => {
        if (!cancelled) {
          setAddons(a);
          setAddonsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAddons([]);
          setAddonsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  const run = async (tgt: TitleTarget) => {
    setLoading(true);
    setResults(null);
    try {
      const enabled = settings.subProvidersEnabled ?? {};
      const titleOnly = !tgt.imdbId && !!tgt.title;
      const playing = isPlayingTarget(tgt, playingTarget) ? playbackContext : null;
      const scope = cacheScope(tgt);
      const searchQuery = {
        imdbId: tgt.imdbId || undefined,
        title: tgt.title || undefined,
        type: tgt.type,
        season: tgt.season ?? undefined,
        episode: tgt.episode ?? undefined,
        langs: settings.preferredSubLangs ?? [],
        candidateIds: playing?.candidateIds,
        stremioId: playing?.stremioId ?? undefined,
        filename: playing?.filename ?? undefined,
      };
      const searchOpts: SearchOptions = {
        timeoutMs: 8_000,
        providers: {
          wyzie: titleOnly ? true : enabled.wyzie === true,
          addons: enabled.addons ?? true,
          opensubtitles: enabled.opensubtitles ?? true,
        },
        addons: addons ?? [],
        preferredLangs: settings.preferredSubLangs ?? [],
        extra: {
          userAgent: "Harbor",
          netAllowed: true,
          subdlApiKey: settings.subdlApiKey || null,
          subsourceApiKey: settings.subsourceApiKey || null,
          enabled: { subdl: enabled.subdl === true, subsource: enabled.subsource === true },
        },
      };
      const seq = ++searchSeq.current;
      searchOpts.onPartial = (partial, stillFetching) => {
        if (seq !== searchSeq.current) return;
        setResults(partial);
        setPendingSources(stillFetching);
        if (partial.length > 0) setLoading(false);
      };
      const r = await searchSubtitles(searchQuery, searchOpts);
      if (seq !== searchSeq.current) return;
      setResults(r);
      if (subtitleSearchResultsMayBeCached(scope, r)) {
        searchCache.set(cacheKeyFor(tgt, playing?.filename), {
          results: r,
          createdAt: Date.now(),
        });
      }
      setPendingSources(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!playbackContext || isOverride || coordsTouchedRef.current) return;
    const s = playbackContext.searchSeason;
    const e = playbackContext.searchEpisode;
    if (s == null && e == null) return;
    if (s === target.season && e === target.episode) return;
    const next = { ...target, season: s, episode: e };
    setTarget(next);
  }, [playbackContext, isOverride, target]);

  useEffect(() => {
    if (addons === null || addonsLoading) return;
    if (!target.imdbId && !target.title) return;
    const playing = isPlayingTarget(target, playingTarget) ? playbackContext : null;
    const scope = cacheScope(target);
    const key = cacheKeyFor(target, playing?.filename);
    if (lastAutoSearchKey.current === key) return;
    lastAutoSearchKey.current = key;
    const cached = scope.credentialBound
      ? null
      : readSubtitleSearchCacheEntry(searchCache.get(key));
    if (cached) {
      setResults(cached);
      return;
    }
    void run(target);
  }, [addons, addonsLoading, target, playingTarget, playbackContext, settings]);

  useEffect(() => {
    if (!suggestOpen) return;
    const parsed = parseTitleQuery(query);
    if (parsed.title.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    const id = window.setTimeout(() => {
      searchTitleCandidates(query, metaImdbId)
        .then((c) => setSuggestions(c.slice(0, 8)))
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestLoading(false));
    }, 250);
    return () => window.clearTimeout(id);
  }, [query, suggestOpen]);

  const pickCandidate = (c: TitleCandidate) => {
    const parsed = parseTitleQuery(query);
    const next: TitleTarget = {
      imdbId: c.imdbId,
      type: c.type,
      title: c.name,
      year: c.year,
      season: c.type === "series" ? (parsed.season ?? target.season ?? 1) : undefined,
      episode: c.type === "series" ? (parsed.episode ?? target.episode ?? 1) : undefined,
    };
    setTarget(next);
    setIsOverride(true);
    setQuery(labelOf(next));
    setSuggestOpen(false);
    void run(next);
  };

  const runFromQuery = async () => {
    setSuggestOpen(false);
    const parsed = parseTitleQuery(query);
    if (parsed.title.length < 2) {
      void run(target);
      return;
    }
    setLoading(true);
    setResults(null);
    const cands = await searchTitleCandidates(query, metaImdbId).catch(() => []);
    const best = bestCandidate(cands, parsed, metaImdbId);
    const next: TitleTarget = best
      ? {
          imdbId: best.imdbId,
          type: best.type,
          title: best.name,
          year: best.year,
          season: best.type === "series" ? (parsed.season ?? 1) : undefined,
          episode: best.type === "series" ? (parsed.episode ?? 1) : undefined,
        }
      : {
          imdbId: "",
          type: parsed.season != null ? "series" : "movie",
          title: parsed.title,
          season: parsed.season,
          episode: parsed.episode,
        };
    setTarget(next);
    setIsOverride(true);
    await run(next);
  };

  const changeEp = (patch: Partial<Pick<TitleTarget, "season" | "episode">>) => {
    coordsTouchedRef.current = true;
    const next = { ...target, ...patch };
    setTarget(next);
    void run(next);
  };

  const clearOverride = () => {
    setTarget(playingTarget);
    setIsOverride(false);
    coordsTouchedRef.current = false;
    setQuery(
      metaTitle && playingTarget.season != null && playingTarget.episode != null
        ? `${metaTitle} S${String(playingTarget.season).padStart(2, "0")}E${String(
            playingTarget.episode,
          ).padStart(2, "0")}`
        : (metaTitle ?? ""),
    );
    setSuggestOpen(false);
    void run(playingTarget);
  };

  const filtered = useMemo(() => {
    if (!results) return null;
    return results.filter((r) => {
      if (hideHI && r.hearingImpaired) return false;
      if (forcedOnly && !r.forced) return false;
      return true;
    });
  }, [results, hideHI, forcedOnly]);

  const grouped = useMemo(() => {
    if (!filtered) return [] as Array<{ lang: string; items: SubResult[] }>;
    const m = new Map<string, SubResult[]>();
    for (const r of filtered) {
      const key = languageName(r.lang);
      const list = m.get(key) ?? [];
      list.push(r);
      m.set(key, list);
    }
    const out = [...m.entries()].map(([lang, items]) => ({ lang, items }));
    if (sortBySource) {
      for (const g of out) g.items.sort((a, b) => a.source.localeCompare(b.source));
    }
    return out;
  }, [filtered, sortBySource]);

  useLayoutEffect(() => {
    if (scrollRestored.current || !restorable) return;
    if (grouped.length === 0) return;
    const el = resultsRef.current;
    if (el) el.scrollTop = restorable.scrollTop;
    scrollRestored.current = true;
  }, [grouped, restorable]);

  const showTargetBar = target.type === "series" || isOverride;
  const activeFilterCount = (hideHI ? 1 : 0) + (forcedOnly ? 1 : 0) + (sortBySource ? 1 : 0);
  const hasTargetBar = showTargetBar || (results !== null && results.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 py-3">
        <div ref={searchAnchorRef} className="relative flex-1">
          <SearchIcon
            size={14}
            strokeWidth={2.2}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setSuggestOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runFromQuery();
              if (e.key === "Escape") setSuggestOpen(false);
            }}
            placeholder={t("Search any show or movie")}
            className={`h-9 w-full rounded-lg border border-edge-soft bg-canvas/60 ps-9 text-[13.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none ${
              isOverride ? "pe-9" : "pe-3"
            }`}
          />
          {isOverride && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearOverride}
              aria-label={t("Back to what's playing")}
              className="absolute end-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
            >
              <X size={13} strokeWidth={2.4} />
            </button>
          )}
          {suggestOpen && (
            <TitleSuggestDropdown
              anchorRef={searchAnchorRef}
              items={suggestions}
              loading={suggestLoading}
              onPick={pickCandidate}
            />
          )}
        </div>
        <button
          onClick={() => void runFromQuery()}
          disabled={loading || query.trim().length < 2}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-elevated px-4 text-[13px] font-semibold text-ink ring-1 ring-edge transition-colors hover:bg-raised disabled:opacity-40"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : t("Search")}
        </button>
        {hasTargetBar && (
          <HoverTooltip
            label={filtersOpen ? t("Hide filters") : t("Show filters")}
            side="bottom"
            align="end"
          >
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-label={t("Toggle filters")}
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors ${
                filtersOpen
                  ? "bg-elevated text-ink ring-edge"
                  : "text-ink-subtle ring-edge-soft hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              <SlidersHorizontal size={15} strokeWidth={2.2} />
              {activeFilterCount > 0 && (
                <span className="absolute -end-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-canvas">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </HoverTooltip>
        )}
      </div>

      {filtersOpen && hasTargetBar && (
        <TargetBar
          type={target.type}
          season={target.season}
          episode={target.episode}
          onSeason={(n) => changeEp({ season: n })}
          onEpisode={(n) => changeEp({ episode: n })}
        />
      )}

      {filtersOpen && results && results.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
          <FilterChip active={hideHI} onClick={() => setHideHI((v) => !v)}>
            {t("Hide HI/SDH")}
          </FilterChip>
          <FilterChip active={forcedOnly} onClick={() => setForcedOnly((v) => !v)}>
            {t("Forced only")}
          </FilterChip>
          <FilterChip active={sortBySource} onClick={() => setSortBySource((v) => !v)}>
            {t("Sort by source")}
          </FilterChip>
          <span className="ms-auto text-[11px] tabular-nums text-ink-subtle">
            {t("{shown} of {total}", { shown: filtered?.length ?? 0, total: results.length })}
          </span>
        </div>
      )}

      {(loading || pendingSources > 0) && (!results || results.length === 0) && (
        <p className="flex items-center gap-2 px-4 py-3 text-[13px] text-ink-muted">
          <Loader2 size={14} className="animate-spin" />
          {addonsLoading
            ? t("Loading subtitle addons…")
            : t("Searching {count} sources…", { count: 1 + (addons?.length ?? 0) })}
        </p>
      )}
      {pendingSources > 0 && results !== null && results.length > 0 && (
        <p className="flex items-center gap-2 px-4 py-1.5 text-[12px] text-ink-subtle">
          <Loader2 size={12} className="animate-spin" />
          {t("Still searching {count} more…", { count: pendingSources })}
        </p>
      )}
      {results !== null && results.length === 0 && !loading && pendingSources === 0 && (
        <p className="px-4 py-3 text-[13px] text-ink-muted">
          {isVeryNewRelease(props.metaReleaseDate)
            ? t("Too new. Subtitles haven't been published yet.")
            : t("No subtitles found. Try another title above, or adjust the season and episode.")}
        </p>
      )}
      <div
        ref={resultsRef}
        onScroll={(e) => {
          scrollTopRef.current = e.currentTarget.scrollTop;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {grouped.map(({ lang, items }, i) => (
          <LangGroup
            key={lang}
            lang={lang}
            items={items}
            defaultOpen={i === 0}
            streamHints={resultStreamHints}
            onAdd={(r) =>
              onAddSubtitle(r.url, r.lang, subtitleTitleOf(r), subtitleLoadMetadataOf(r))
            }
          />
        ))}
      </div>
    </div>
  );
}
