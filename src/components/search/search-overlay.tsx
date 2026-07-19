import { Search, X, Loader2, CornerDownLeft, CalendarRange, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TvModalClose } from "@/components/tv-modal-close";
import { useT } from "@/lib/i18n";
import { useSearch } from "@/lib/search-context";
import { useView } from "@/lib/view";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { AnimeRow } from "./anime-row";
import { EmptyState } from "./empty-state";
import { GuideModal } from "./guide-modal";
import { LiveTvRow } from "./live-tv-row";
import { TopMatch } from "./top-match";
import { PeopleRow } from "./people-row";
import { MetaList } from "./meta-list";
import { AddonHits } from "./addon-hits";
import { AddonResults } from "./addon-results";
import { MagnetCard } from "./magnet-card";
import { UrlCard } from "./url-card";
import { AiSearchSection } from "./ai-search-section";
import { AiModeButton } from "./ai-mode-button";
import { AiExampleHint, SEARCH_EXAMPLES } from "@/components/ai-example-hint";
import { useSettings } from "@/lib/settings";
import { isMagnetInput, isDirectVideoUrl } from "@/lib/torrent/magnet";
import { getSearchDisplayState } from "@/lib/search-display-state";

export function SearchOverlay() {
  const { open, setOpen, query, setQuery, results, status, clear, recordRecent } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const { openFilter, openMeta } = useView();
  const t = useT();
  const [guideOpen, setGuideOpen] = useState(false);
  const [aiActive, setAiActive] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiRunSignal, setAiRunSignal] = useState(0);
  const { settings, update } = useSettings();

  useEffect(() => {
    if (!open) return;

    const id = window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;

      // Search Overlay opens directly in typing mode. It must never inherit
      // the read-only TV navigation state used by Settings/Home text fields.
      input.readOnly = false;
      input.removeAttribute("data-search-nav-mode");
      input.removeAttribute("data-tv-focused");
      input.setAttribute("data-search-editing", "true");
      input.focus({ preventScroll: true });

      const len = input.value.length;
      try {
        input.setSelectionRange(len, len);
      } catch {}
    }, 30);

    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(id);
      inputRef.current?.removeAttribute("data-search-editing");
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const close = () => {
    if (query.trim() && results) recordRecent(query);
    setOpen(false);
  };

  const onIntent = () => {
    const intent = currentResults?.intent;
    if (!intent) return;
    if (intent.kind === "genre") {
      const id = (intent.mediaType === "movie" ? MOVIE_GENRES : TV_GENRES)[intent.genre];
      if (typeof id === "number") {
        recordRecent(query);
        openFilter({ kind: "genre", mediaType: intent.mediaType, name: intent.genre, id });
        setOpen(false);
      }
      return;
    }
    if (intent.kind === "year") {
      recordRecent(query);
      openFilter({ kind: "year", mediaType: "movie", value: intent.year });
      setOpen(false);
    }
  };

  const trimmed = query.trim();
  const { currentResults, hasResults, noResults, tmdbUnavailable } = getSearchDisplayState(
    results,
    query,
    status,
  );
  const magnetInput = !!trimmed && isMagnetInput(trimmed);
  const urlInput = !!trimmed && !magnetInput && isDirectVideoUrl(trimmed);
  const directInput = magnetInput || urlInput;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={t("Search")}
      data-search-overlay
      data-tv-focus-scope
    >
      <TvModalClose onClose={close} label={t("common.close")} />
      <div
        role="presentation"
        aria-hidden="true"
        onClick={close}
        data-tauri-drag-region
        className="harbor-search-backdrop absolute inset-0 cursor-default"
      />

      <div
        data-tauri-drag-region
        className="relative mx-auto flex h-full w-full max-w-[1080px] flex-col px-6 py-6 sm:px-10 sm:py-10"
      >
        <div
          className={`modal-panel relative flex shrink-0 items-center gap-3 rounded-2xl border bg-elevated/70 px-5 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.7)] transition-colors ${
            aiMode ? "border-accent/55" : "border-edge-soft/80"
          }`}
        >
          <Search
            size={22}
            className={`shrink-0 transition-colors ${aiMode ? "text-accent" : "text-ink-muted"}`}
            strokeWidth={1.9}
          />
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="search"
              aria-label={t("Search")}
              data-tv-text-auto
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
                if (currentResults?.topMatch) {
                  e.preventDefault();
                  recordRecent(query);
                  const meta = currentResults.topMatch.meta;
                  setOpen(false);
                  openMeta(meta);
                }
              }}
              placeholder={aiMode ? "" : t("Search movies, shows, people, genres, years...")}
              className="h-16 w-full bg-transparent text-[20px] text-ink placeholder:text-ink-subtle focus:outline-none sm:text-[22px]"
              spellCheck={false}
              autoComplete="off"
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
          {status === "loading" && (
            <Loader2 size={18} className="shrink-0 animate-spin text-ink-subtle" />
          )}
          <Hint />
          {(settings.aiSearchKey.trim() || settings.aiGroqKey.trim()) && (
            <AiModeButton
              active={aiMode}
              currentModel={settings.aiSearchModel}
              onToggle={() => setAiMode((v) => !v)}
              onSelectModel={(id) => {
                update({ aiSearchModel: id });
                setAiMode(true);
              }}
            />
          )}
          {query && (
            <button
              type="button"
              aria-label={t("Clear")}
              onClick={clear}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
            >
              <X size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>

        <div className="relative mt-6 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!trimmed && <EmptyState onClose={close} onOpenGuide={() => setGuideOpen(true)} />}

          {magnetInput && (
            <div className="mb-5">
              <MagnetCard raw={trimmed} onClose={close} />
            </div>
          )}

          {urlInput && (
            <div className="mb-5">
              <UrlCard raw={trimmed} onClose={close} />
            </div>
          )}

          {trimmed && !directInput && currentResults?.intent && (
            <button
              onClick={onIntent}
              className="mb-5 flex h-14 w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-5 text-start transition-colors hover:bg-accent/15"
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

          {trimmed && !directInput && (
            <AiSearchSection
              query={trimmed}
              onClose={close}
              onActive={setAiActive}
              runSignal={aiRunSignal}
            />
          )}

          {tmdbUnavailable && !directInput && !aiActive && (
            <div className="mb-5 rounded-2xl border border-edge-soft bg-elevated/60 px-5 py-4 text-[13px] text-ink-muted">
              {hasResults
                ? t("TMDB is temporarily unavailable. These results may be incomplete.")
                : t("TMDB is temporarily unavailable. Try your search again shortly.")}
            </div>
          )}

          {trimmed && !directInput && hasResults && !aiActive && currentResults && (
            <div className="flex flex-col gap-8 pb-12">
              {currentResults.topMatch && (
                <TopMatch match={currentResults.topMatch} onClose={close} />
              )}
              <LiveTvRow items={currentResults.liveTv} onClose={close} />
              <AddonHits hits={currentResults.addons} onClose={close} />
              <PeopleRow people={currentResults.people} onClose={close} />
              <div className="grid gap-8 lg:grid-cols-2">
                <MetaList title={t("Movies")} items={currentResults.movies} onClose={close} />
                <MetaList title={t("Series")} items={currentResults.series} onClose={close} />
              </div>
              <AnimeRow items={currentResults.anime} onClose={close} />
              <AddonResults groups={currentResults.addonGroups} onClose={close} />
            </div>
          )}

          {noResults && !directInput && !aiActive && (
            <div className="flex flex-col items-center gap-3 pt-16 text-center">
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

          {trimmed && !directInput && !currentResults && status !== "done" && (
            <div className="flex flex-col items-center gap-3 pt-16 text-ink-muted">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-[13.5px]">{t("Looking…")}</span>
            </div>
          )}
        </div>
      </div>
      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    </div>,
    document.body,
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
