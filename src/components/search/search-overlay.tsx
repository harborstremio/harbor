import { Search, X, Loader2, CornerDownLeft, CalendarRange, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import type { Meta } from "@/lib/cinemeta";
import { useSearch } from "@/lib/search-context";
import { useView } from "@/lib/view";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { AnimeRow } from "./anime-row";
import { MangaRow } from "./manga-row";
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
import { isMagnetInput, isDirectVideoUrl } from "@/lib/torrent/magnet";

export function SearchOverlay() {
  const { open, setOpen, query, setQuery, results, status, clear, closeForNavigation, recordRecent, setAiHold } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const { openFilter, openMeta, openPerson } = useView();
  const [explore, setExplore] = useState<ExploreFrame[]>([]);
  const t = useT();
  const [guideOpen, setGuideOpen] = useState(false);
  const [aiActive, setAiActive] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiRunSignal, setAiRunSignal] = useState(0);
  const { settings, update } = useSettings();
  const { mounted, closing } = useExitPresence(open, 150);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setExplore((s) => (s.length === 0 ? s : []));
  }, [query]);

  useEffect(() => {
    setAiHold(aiMode);
  }, [aiMode, setAiHold]);

  useEffect(() => {
    if (explore.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setExplore((s) => s.slice(0, -1));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [explore.length]);

  const trimmedQ = query.trim();
  const collectionsQuery =
    !trimmedQ || isMagnetInput(trimmedQ) || isDirectVideoUrl(trimmedQ) ? "" : trimmedQ;
  const collectionHits = useCollectionHits(collectionsQuery);

  if (!mounted) return null;

  const close = () => {
    if (query.trim() && results) recordRecent(query);
    setOpen(false);
  };

  const commit = () => {
    if (query.trim() && results) recordRecent(query);
    closeForNavigation();
  };

  const beginDragOrClose = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    let dragStarted = false;
    const onMove = (ev: MouseEvent) => {
      if (dragStarted) return;
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (dx <= 6 && dy <= 6) return;
      moved = true;
      if (!settings.dragAnywhere) return;
      dragStarted = true;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      import("@tauri-apps/api/window")
        .then(({ getCurrentWindow }) => getCurrentWindow().startDragging())
        .catch(() => {});
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!dragStarted && !moved) close();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
  const personMatch = matchPersonForQuery(currentResults?.people, trimmed);
  const magnetInput = !!trimmed && isMagnetInput(trimmed);
  const urlInput = !!trimmed && !magnetInput && isDirectVideoUrl(trimmed);
  const directInput = magnetInput || urlInput;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex flex-col ${closing ? "pointer-events-none" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("Search")}
    >
      <button
        aria-label={t("Close search")}
        onMouseDown={beginDragOrClose}
        className={`harbor-search-backdrop no-press absolute inset-0 cursor-default ${
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
        <div className="flex shrink-0 items-center gap-3 border-b border-edge-soft/60 px-6">
          <Search
            size={22}
            className={`shrink-0 transition-colors ${aiMode ? "text-accent" : "text-ink-muted"}`}
            strokeWidth={1.9}
          />
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
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
              placeholder={aiMode ? "" : t("Search movies, shows, people, genres, years...")}
              className="h-16 w-full bg-transparent text-[20px] text-ink placeholder:text-ink-subtle focus:outline-none sm:text-[22px]"
              spellCheck={false}
              autoComplete="off"
              data-tv-text-auto="true"
            />
            {aiMode && (
              <AiExampleHint
                hidden={query.trim().length > 0}
                examples={SEARCH_EXAMPLES}
                prefix=""
                sizeClass="text-[20px] sm:text-[22px]"
              />
            )}
          </div>
          {status === "loading" && <Loader2 size={18} className="shrink-0 animate-spin text-ink-subtle" />}
          <Hint />
          {(settings.aiSearchKey.trim() || settings.aiGroqKey.trim()) && (
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

        <div className="relative isolate min-h-0 overflow-x-hidden overflow-y-auto px-7 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {explore.length > 0 ? (
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
            />
          ) : (
            <>
          {!trimmed && (
            <div className="harbor-search-section">
              <EmptyState onClose={close} onOpenGuide={() => setGuideOpen(true)} />
            </div>
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
                <span className="text-[15px] font-semibold text-ink">{currentResults.intent.label}</span>
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
            <AiSearchSection query={trimmed} aiMode={aiMode} onClose={commit} onActive={setAiActive} runSignal={aiRunSignal} />
          )}

          {trimmed && !directInput && hasResults && !aiActive && !aiMode && currentResults && (
            <div className="harbor-search-section flex flex-col gap-6 pb-2">
              {personMatch ? (
                <PersonTopMatch
                  person={personMatch}
                  onClose={commit}
                  onOpenPerson={(p) => pushExplore({ kind: "person", id: p.id, name: p.name })}
                />
              ) : (
                currentResults.topMatch && (
                  <TopMatch
                    match={currentResults.topMatch}
                    onClose={commit}
                    collection={(() => {
                      const hit = collectionForTitle(currentResults.topMatch.meta.name, collectionHits);
                      return hit
                        ? {
                            name: hit.name,
                            onOpen: () =>
                              pushExplore({ kind: "collection", id: hit.id, name: hit.name, image: hit.image }),
                          }
                        : undefined;
                    })()}
                  />
                )
              )}
              <LiveTvRow items={currentResults.liveTv} onClose={commit} />
              <AddonHits hits={currentResults.addons} onClose={commit} />
              <PeopleRow
                people={personMatch ? currentResults.people.filter((p) => p.id !== personMatch.id) : currentResults.people}
                onClose={commit}
                onOpenPerson={(p) => pushExplore({ kind: "person", id: p.id, name: p.name })}
              />
              <div className="grid gap-8 lg:grid-cols-2">
                <MetaList title={t("Movies")} items={currentResults.movies} onClose={commit} />
                <MetaList title={t("Series")} items={currentResults.series} onClose={commit} />
              </div>
              {collectionHits.length > 0 && (
                <CollectionHitsRow
                  hits={collectionHits}
                  onOpen={(h) => pushExplore({ kind: "collection", id: h.id, name: h.name, image: h.image })}
                />
              )}
              <AnimeRow items={currentResults.anime} onClose={commit} />
              <MangaRow items={currentResults.manga} onClose={commit} />
              <CharacterGroup items={currentResults.characters} onClose={commit} />
              <AddonResults groups={currentResults.addonGroups} onClose={commit} />
            </div>
          )}

          {noResults && !directInput && !aiActive && !aiMode && (
            <div className="harbor-search-section flex flex-col items-center gap-3 py-12 text-center">
              <span className="text-[17px] font-semibold text-ink">{t("No matches for \"{query}\"", { query: trimmed })}</span>
              <span className="max-w-[44ch] text-[14px] text-ink-muted">
                {t("Try a different spelling, a person's name, a year like \"1972\", or a genre like \"Horror\".")}
              </span>
            </div>
          )}

          {trimmed && !directInput && !aiMode && !results && status !== "done" && <LoadingRows />}
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
