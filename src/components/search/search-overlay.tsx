import { X, Loader2, CornerDownLeft, CalendarRange, Tag } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { createPortal } from "react-dom";
import { TvModalClose } from "@/components/tv-modal-close";
import { tvFocus } from "@/lib/keyboard-navigation";
import { useT } from "@/lib/i18n";
import type { Meta } from "@/lib/cinemeta";
import { useSearch } from "@/lib/search-context";
import { useView } from "@/lib/view";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { metaLooksAnime, warmAnimeResolution } from "@/lib/anime-detect";
import { AnimeRow } from "./anime-row";
import { AnimeRelations } from "./anime-relations";
import { MangaRow } from "./manga-row";
import { MusicRow } from "./music-row";
import { EBookRow } from "./ebook-row";
import { SportsRow } from "./sports-row";
import { CharacterGroup } from "./character-group";
import { EmptyState } from "./empty-state";
import { GuideModal } from "./guide-modal";
import { LiveTvRow } from "./live-tv-row";
import { TopMatch } from "./top-match";
import { CollectionHitsRow } from "./collection-pane";
import { ExplorePane, type ExploreFrame } from "./explore-pane";
import { matchPersonForQuery, PersonTopMatch } from "./person-top-match";
import { PeopleRow } from "./people-row";
import { collectionForTitle, useCollectionHits } from "./use-collection-hits";
import { MetaList } from "./meta-list";
import {
  SearchFilterBar,
  type SearchFilter,
  type SearchFilterKey,
} from "./search-filter-bar";
import { requestMusicSearch } from "@/lib/music/navigation";
import { AddonHits } from "./addon-hits";
import { AddonResults } from "./addon-results";
import { MagnetCard } from "./magnet-card";
import { UrlCard } from "./url-card";
import { AiSearchSection } from "./ai-search-section";
import { AiModeButton } from "./ai-mode-button";
import { providerTabFor } from "@/lib/ai-models";
import { getSearchDisplayState } from "@/lib/search-display-state";
import { AiExampleHint, SEARCH_EXAMPLES } from "@/components/ai-example-hint";
import { useSettings } from "@/lib/settings";
import { useExitPresence } from "@/lib/use-exit-presence";
import { useWindowFullscreen } from "@/lib/use-window-fullscreen";
import { isMagnetInput, isDirectVideoUrl } from "@/lib/torrent/magnet";
import { useProfiles } from "@/lib/profiles";
import { steamStoreQuery } from "@/lib/games/steam-store-search";
const SteamStoreSearch = lazy(() => import("./steam-store-search").then(module => ({default:module.SteamStoreSearch})));

export function SearchOverlay() {
  const {
    open,
    setOpen,
    query,
    setQuery,
    results,
    status,
    clear,
    closeForNavigation,
    recordRecent,
    setAiHold,
  } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropGesture = useRef<(() => void) | null>(null);
  const { openFilter, openMeta, openPerson, setView } = useView();
  const [explore, setExplore] = useState<ExploreFrame[]>([]);
  const t = useT();
  const [guideOpen, setGuideOpen] = useState(false);
  const [aiActive, setAiActive] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiRunSignal, setAiRunSignal] = useState(0);
  const [mediaFilter, setMediaFilter] = useState<SearchFilter>("all");
  const {activeProfile}=useProfiles();
  const { settings, update } = useSettings();
  const storeQuery=activeProfile?.kid?null:steamStoreQuery(query, settings.steamSearchShortcut);
  useEffect(() => {
    setMediaFilter("all");
  }, [query]);
  const { mounted, closing } = useExitPresence(open, 150);
  const fullscreen = useWindowFullscreen();

  useEffect(
    () => () => backdropGesture.current?.(),
    [open, closing, settings.dragAnywhere, fullscreen],
  );

  // Warm the anime identity resolution for the top match only — one resolution
  // per search, for the result the user is most likely to open.
  const topMatchId = results?.topMatch?.meta.id ?? "";
  useEffect(() => {
    const top = results?.topMatch?.meta;
    if (top) warmAnimeResolution(top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topMatchId]);

  const close = () => {
    backdropGesture.current?.();
    if (query.trim() && (results || storeQuery !== null)) recordRecent(query);
    setOpen(false);
  };

  const handleModalClose = () => {
    if (explore.length > 0) {
      setExplore((s) => s.slice(0, -1));
      return;
    }
    close();
  };

  const commit = () => {
    backdropGesture.current?.();
    if (query.trim() && results) recordRecent(query);
    closeForNavigation();
  };

  useEffect(() => {
    if (!open) return;
    const prevFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = "";
      if (prevFocused && document.body.contains(prevFocused)) {
        tvFocus(prevFocused);
      }
    };
  }, [open]);

  useEffect(() => {
    setExplore((s) => (s.length === 0 ? s : []));
  }, [query]);

  useEffect(() => {
    setAiHold(aiMode || storeQuery !== null);
  }, [aiMode, storeQuery !== null, setAiHold]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      handleModalClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, explore.length]);

  // Modal Tab trap: cycle input -> actions -> results in DOM order. Native Tab
  // can skip result stops and drop focus onto the page behind the scrim, after
  // which arrows drive TV nav on the home page instead of the overlay.
  useEffect(() => {
    if (!open || closing || !mounted) return;
    const root = panelRef.current;
    if (!root) return;
    const tabbables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.defaultPrevented) return;
      if (!(e.target instanceof Node) || !root.contains(e.target)) return;
      const els = tabbables();
      if (els.length === 0) return;
      e.preventDefault();
      const idx = els.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? idx <= 0
          ? els[els.length - 1]
          : els[idx - 1]
        : idx === -1 || idx === els.length - 1
          ? els[0]
          : els[idx + 1];
      next.focus();
    };
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [open, closing, mounted]);

  const trimmedQ = query.trim();
  const collectionsQuery =
    !trimmedQ || storeQuery !== null || isMagnetInput(trimmedQ) || isDirectVideoUrl(trimmedQ) ? "" : trimmedQ;
  const collectionHits = useCollectionHits(collectionsQuery);

  if (!mounted) return null;

  const beginDragOrClose = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget || e.button !== 0 || !open || closing) return;
    e.preventDefault();
    backdropGesture.current?.();
    const startX = e.clientX;
    const startY = e.clientY;
    const canDrag = isTauri() && settings.dragAnywhere && !fullscreen;
    let active = true;
    let moved = false;
    let dragStarted = false;
    const cleanup = () => {
      active = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", cleanup);
      if (backdropGesture.current === cleanup) backdropGesture.current = null;
    };
    const onMove = (ev: MouseEvent) => {
      if (!(ev.buttons & 1)) {
        cleanup();
        return;
      }
      if (dragStarted) return;
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (dx <= 6 && dy <= 6) return;
      moved = true;
      if (!canDrag) return;
      dragStarted = true;
      import("@tauri-apps/api/window")
        .then(async ({ getCurrentWindow }) => {
          if (!active) return;
          const win = getCurrentWindow();
          if (await win.isFullscreen().catch(() => true)) return;
          // Releasing, closing or leaving the window cancels a pending native request.
          if (!active) return;
          cleanup();
          await win.startDragging();
        })
        .catch(() => {});
    };
    const onUp = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      cleanup();
      if (!moved) close();
    };
    backdropGesture.current = cleanup;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", cleanup);
  };

  const pushExplore = (frame: ExploreFrame) => {
    if (query.trim()) recordRecent(query);
    setExplore((s) => [...s, frame]);
  };

  const exploreOpenDetail = (m: Meta) => {
    commit();
    openMeta(m);
  };

  const { currentResults, hasResults, noResults, tmdbUnavailable } = getSearchDisplayState(
    results,
    query,
    status,
  );

  const onIntent = () => {
    const intent = currentResults?.intent;
    if (!intent) return;
    if (intent.kind === "genre") {
      const id = (intent.mediaType === "movie" ? MOVIE_GENRES : TV_GENRES)[intent.genre];
      if (typeof id === "number") {
        recordRecent(query);
        closeForNavigation();
        openFilter({ kind: "genre", mediaType: intent.mediaType, name: intent.genre, id });
      }
      return;
    }
    if (intent.kind === "year") {
      recordRecent(query);
      closeForNavigation();
      openFilter({ kind: "year", mediaType: "movie", value: intent.year });
    }
  };

  const trimmed = query.trim();
  const filterCounts: Partial<Record<SearchFilterKey, number>> = currentResults
    ? {
        movies: currentResults.movies.length,
        shows: currentResults.series.length,
        people: currentResults.people.length,
        live: currentResults.liveTv.length,
        anime: currentResults.anime.length,
        manga: currentResults.manga.length,
        music: currentResults.music.length,
        ebooks: currentResults.ebooks.length,
        sports: currentResults.sports.length,
      }
    : {};
  const addonFilter = mediaFilter.startsWith("addon:") ? mediaFilter.slice(6) : null;
  const showKind = (key: SearchFilterKey) =>
    !addonFilter && (mediaFilter === "all" || mediaFilter === key);
  const addonPills = (currentResults?.addonGroups ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    logo: group.logo,
    count: group.metas.length,
  }));
  const shownAddonGroups = (currentResults?.addonGroups ?? []).filter(
    (group) => !addonFilter || group.id === addonFilter,
  );
  const personMatch = matchPersonForQuery(currentResults?.people, trimmed);
  const topMatchIsAnime =
    !personMatch &&
    !!currentResults?.topMatch &&
    currentResults.anime.length > 0 &&
    metaLooksAnime(currentResults.topMatch.meta);
  const topAnime = topMatchIsAnime && currentResults ? currentResults.anime[0] : null;
  const magnetInput = !!trimmed && isMagnetInput(trimmed);
  const urlInput = !!trimmed && !magnetInput && isDirectVideoUrl(trimmed);
  const directInput = magnetInput || urlInput;

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed inset-0 z-[200] flex flex-col overflow-hidden ${closing ? "pointer-events-none" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("Search")}
      data-search-overlay="true"
      data-tv-focus-scope={closing ? undefined : "true"}
    >
      <TvModalClose onClose={handleModalClose} label={t("Close search")} />
      <button
        tabIndex={-1}
        aria-label={t("Close search")}
        onMouseDown={beginDragOrClose}
        className={`harbor-search-backdrop no-press absolute -inset-6 cursor-default ${
          closing ? "harbor-search-scrim-out" : "harbor-search-scrim-in"
        }`}
      />

      <div
        onMouseDown={beginDragOrClose}
        className="relative mx-auto flex h-full w-full max-w-[1200px] flex-col px-6 py-6 sm:px-10 sm:py-10"
      >
        <div
          className={`modal-panel relative flex max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-transparent bg-elevated/70 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.7)] ${
            closing ? "harbor-search-panel-out" : "harbor-search-panel-in"
          }`}
        >
          <div
            data-tv-focus-container
            className="flex shrink-0 items-center gap-3 border-b border-edge-soft/60 px-6"
          >
            <Search
              size={22}
              className={`shrink-0 transition-colors ${aiMode ? "text-accent" : "text-ink-muted"}`}
              strokeWidth={1.9}
            />
            <div className="relative min-w-0 flex-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleModalClose();
                    return;
                  }
                  if (e.key === "Enter" && storeQuery !== null) {
                    e.preventDefault();
                    panelRef.current?.querySelector<HTMLAnchorElement>(".steam-store-result-title")?.focus();
                    return;
                  }
                  if (e.key === "Enter" && e.shiftKey) {
                    if (!query.trim()) return;
                    e.preventDefault();
                    if (!aiMode) setAiMode(true);
                    setAiRunSignal((n) => n + 1);
                    return;
                  }
                  if (e.key !== "Enter") return;
                  if (aiMode) {
                    if (query.trim()) {
                      e.preventDefault();
                      setAiRunSignal((n) => n + 1);
                    }
                    return;
                  }
                  if (personMatch) {
                    e.preventDefault();
                    pushExplore({ kind: "person", id: personMatch.id, name: personMatch.name });
                    return;
                  }
                  if (currentResults?.topMatch) {
                    e.preventDefault();
                    const meta = currentResults.topMatch.meta;
                    commit();
                    openMeta(meta);
                  }
                }}
                placeholder={storeQuery !== null ? t("games.storeSearch.empty") : aiMode ? "" : t("Search movies, shows, people, genres, years...")}
                className="h-16 w-full bg-transparent text-[20px] text-ink placeholder:text-ink-subtle focus:outline-none sm:text-[22px]"
                spellCheck={false}
                autoComplete="off"
                data-tv-text-auto="true"
              />
              {aiMode && storeQuery === null && (
                <AiExampleHint
                  hidden={query.trim().length > 0}
                  examples={SEARCH_EXAMPLES}
                  prefix=""
                  sizeClass="text-[20px] sm:text-[22px]"
                />
              )}
            </div>
            {status === "loading" && storeQuery === null && (
              <Loader2 size={18} className="shrink-0 animate-spin text-ink-subtle" />
            )}
            <Hint />
            {storeQuery === null && (settings.aiSearchKey.trim() || settings.aiGroqKey.trim()) && (
              <AiModeButton
                active={aiMode}
                currentModel={settings.aiSearchModel}
                onToggle={() => setAiMode((v) => !v)}
                onSelectModel={(id) => {
                  update({ aiSearchModel: id, aiSearchProvider: providerTabFor(id) });
                  setAiMode(true);
                }}
              />
            )}
            {query && (
              <button
                type="button"
                aria-label={t("Clear")}
                onClick={clear}
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-subtle transition-[color,background-color,transform] duration-150 hover:bg-canvas/60 hover:text-ink active:scale-90"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            )}
          </div>

          <div className="harbor-search-body relative isolate min-h-0 overflow-x-hidden overflow-y-auto px-7 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {storeQuery !== null ? <Suspense fallback={<p role="status">{t("common.loading")}</p>}><SteamStoreSearch key={activeProfile?.id ?? "default"} profile={activeProfile?.id ?? "default"} query={storeQuery} active={open&&!closing} onAction={()=>recordRecent(query)}/></Suspense> : explore.length > 0 ? (
              <ExplorePane
                key={explore.length}
                frame={explore[explore.length - 1]}
                depth={explore.length}
                tmdbKey={settings.tmdbKey}
                onBack={() => setExplore((s) => s.slice(0, -1))}
                onOpenPerson={(id, name) => pushExplore({ kind: "person", id, name })}
                onOpenTitle={(m) => pushExplore({ kind: "title", meta: m })}
                onOpenDetail={exploreOpenDetail}
                onOpenPersonDetail={(id) => {
                  commit();
                  openPerson(id);
                }}
                onOpenMusic={(q) => {
                  commit();
                  requestMusicSearch(q);
                  setView("music");
                }}
              />
            ) : (
              <>
                {!trimmed && (
                  <EmptyState onClose={close} onOpenGuide={() => setGuideOpen(true)} />
                )}

                {magnetInput && (
                  <div className="harbor-search-section mb-5">
                    <MagnetCard raw={trimmed} onClose={commit} />
                  </div>
                )}

                {urlInput && (
                  <div className="harbor-search-section mb-5">
                    <UrlCard raw={trimmed} onClose={commit} />
                  </div>
                )}

                {trimmed && !directInput && !aiMode && currentResults?.intent && (
                  <button
                    onClick={onIntent}
                    className="harbor-search-section mb-5 flex h-14 w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-5 text-start transition-colors hover:bg-accent/15"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-accent">
                      {currentResults.intent.kind === "year" ? (
                        <CalendarRange size={16} strokeWidth={2.1} />
                      ) : (
                        <Tag size={16} strokeWidth={2.1} />
                      )}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                        {t("Browse")}
                      </span>
                      <span className="text-[15px] font-semibold text-ink">
                        {currentResults.intent.label}
                      </span>
                    </span>
                    <CornerDownLeft size={15} className="ms-auto text-ink-subtle" />
                  </button>
                )}

                {tmdbUnavailable && !directInput && !aiActive && !aiMode && (
                  <div className="harbor-search-section mb-5 rounded-2xl border border-edge-soft bg-elevated/60 px-5 py-4 text-[13px] text-ink-muted">
                    {hasResults
                      ? t("TMDB is temporarily unavailable, so these results may be incomplete.")
                      : t("TMDB is temporarily unavailable. Try your search again shortly.")}
                  </div>
                )}

                {trimmed && !directInput && (
                  <AiSearchSection
                    query={trimmed}
                    aiMode={aiMode}
                    onClose={commit}
                    onActive={setAiActive}
                    runSignal={aiRunSignal}
                  />
                )}

                {trimmed &&
                  !directInput &&
                  hasResults &&
                  !aiActive &&
                  !aiMode &&
                  currentResults && (
                    <div className="harbor-search-section flex flex-col gap-6 pb-2">
                      <SearchFilterBar
                        counts={filterCounts}
                        addons={addonPills}
                        value={mediaFilter}
                        onChange={setMediaFilter}
                      />
                      {mediaFilter === "all" && personMatch ? (
                        <PersonTopMatch
                          person={personMatch}
                          onClose={commit}
                          onOpenPerson={(p) =>
                            pushExplore({ kind: "person", id: p.id, name: p.name })
                          }
                        />
                      ) : (
                        mediaFilter === "all" && currentResults.topMatch && (
                          <TopMatch
                            match={currentResults.topMatch}
                            onClose={commit}
                            collection={(() => {
                              const hit = collectionForTitle(
                                currentResults.topMatch.meta.name,
                                collectionHits,
                              );
                              return hit
                                ? {
                                    name: hit.name,
                                    onOpen: () =>
                                      pushExplore({
                                        kind: "collection",
                                        id: hit.id,
                                        name: hit.name,
                                        image: hit.image,
                                      }),
                                  }
                                : undefined;
                            })()}
                          />
                        )
                      )}
                      {showKind("anime") && topAnime && (
                        <AnimeRelations anime={topAnime} onClose={commit} />
                      )}
                      <LiveTvRow
                        items={showKind("live") ? currentResults.liveTv : []}
                        onClose={commit}
                      />
                      <AddonHits hits={currentResults.addons} onClose={commit} />
                      <PeopleRow
                        people={
                          !showKind("people")
                            ? []
                            : personMatch
                              ? currentResults.people.filter((p) => p.id !== personMatch.id)
                              : currentResults.people
                        }
                        onClose={commit}
                        onOpenPerson={(p) =>
                          pushExplore({ kind: "person", id: p.id, name: p.name })
                        }
                      />
                      <div
                        className={`grid gap-8 ${
                          showKind("movies") && showKind("shows") ? "lg:grid-cols-2" : ""
                        }`}
                      >
                        <MetaList
                          title={t("Movies")}
                          items={showKind("movies") ? currentResults.movies : []}
                          onClose={commit}
                          stagger
                        />
                        <MetaList
                          title={t("Series")}
                          items={showKind("shows") ? currentResults.series : []}
                          onClose={commit}
                          stagger
                        />
                      </div>
                      {collectionHits.length > 0 && (
                        <CollectionHitsRow
                          hits={collectionHits}
                          onOpen={(h) =>
                            pushExplore({
                              kind: "collection",
                              id: h.id,
                              name: h.name,
                              image: h.image,
                            })
                          }
                        />
                      )}
                      <AnimeRow items={showKind("anime") ? currentResults.anime : []} onClose={commit} />
                      <MangaRow items={showKind("manga") ? currentResults.manga : []} onClose={commit} />
                      <MusicRow items={showKind("music") ? currentResults.music : []} onClose={commit} />
                      <EBookRow items={showKind("ebooks") ? currentResults.ebooks : []} onClose={commit} />
                      <SportsRow items={showKind("sports") ? currentResults.sports : []} onClose={commit} />
                      <CharacterGroup items={currentResults.characters} onClose={commit} />
                      <AddonResults groups={shownAddonGroups} onClose={commit} />
                    </div>
                  )}

                {noResults && !directInput && !aiActive && !aiMode && (
                  <div className="harbor-search-section flex flex-col items-center gap-3 py-12 text-center">
                    <span className="text-[17px] font-semibold text-ink">
                      {t('No matches for "{query}"', { query: trimmed })}
                    </span>
                    <span className="max-w-[44ch] text-[14px] text-ink-muted">
                      {t(
                        'Try a different spelling, a person\'s name, a year like "1972", or a genre like "Horror".',
                      )}
                    </span>
                  </div>
                )}

                {trimmed && !directInput && !aiMode && !results && status !== "done" && (
                  <LoadingRows />
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    </div>,
    document.body,
  );
}

function LoadingRows() {
  return (
    <div className="harbor-search-section flex flex-col gap-3">
      <div className="h-[128px] animate-pulse rounded-2xl bg-raised/50 ring-1 ring-edge-soft/40" />
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[60px] animate-pulse rounded-xl bg-raised/35 ring-1 ring-edge-soft/30"
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}

function Hint() {
  return (
    <span className="hidden shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-subtle sm:flex">
      <kbd className="rounded-md border border-edge-soft bg-canvas/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
        Esc
      </kbd>
    </span>
  );
}
