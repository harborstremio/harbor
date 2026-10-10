import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Dices, LayoutGrid, Rows3, Search, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { loadGameCatalog } from "@/lib/games/catalog";
import { hasSteamSearchFilters, loadUnifiedGameSearch, readUnifiedGameSearchSnapshot, type GameSearchCursor, type UnifiedGameSearchPage } from "@/lib/games/unified-game-search";
import { mergeCatalogContinuation, missingSearchCursor } from "@/lib/games/catalog-recovery";
import { GameDataStatus } from "./game-data-status";
import { useLiveRefresh } from "./use-live-refresh";
import { DEFAULT_CATALOG_FILTERS, catalogParameters, type CatalogFilters } from "@/lib/games/catalog-filters";
import type { GameSummary } from "@/lib/games/types";
import { GameCatalogFilters } from "./game-catalog-filters";
import { GameAiSearch } from "./game-ai-search";
import { GameSearchResults } from "./game-search-results";
import { HoverTooltip } from "@/components/hover-tooltip";
import "./game-search.css";

type CatalogFailure = false | { kind: "initial" } | { kind: "append" | "recover"; cursor: GameSearchCursor };
type CatalogState = UnifiedGameSearchPage & { key: string; error: CatalogFailure; loading: boolean; loaded: boolean; validated: string | null };
export type CatalogRequests = { load: typeof loadUnifiedGameSearch; snapshot: typeof readUnifiedGameSearchSnapshot };
const CATALOG_REQUESTS: CatalogRequests = { load: loadUnifiedGameSearch, snapshot: readUnifiedGameSearchSnapshot };
export function GameCatalog({ query, filters, setFilters, active, open, back, shellBackAvailable = false, embedded = false, lockedTags = [], aiMode = false, runSignal = 0, profile = "default", requests = CATALOG_REQUESTS }: {
  query: string; filters: CatalogFilters; setFilters: (filters: CatalogFilters) => void; active: boolean; open: (game: GameSummary, origin?: HTMLElement) => void; back: () => void;
  shellBackAvailable?: boolean; embedded?: boolean; lockedTags?: readonly number[]; aiMode?: boolean; runSignal?: number; profile?: string; requests?: CatalogRequests;
}) {
  const t = useT();
  const [resultView, setResultView] = useState<"grid" | "rows">(() => { try { return localStorage.getItem(`harbor.games.search-view:${profile}`) === "rows" ? "rows" : "grid"; } catch { return "grid"; } });
  const changeView = (value: "grid" | "rows") => { setResultView(value); try { localStorage.setItem(`harbor.games.search-view:${profile}`, value); } catch { /* Retain the session choice. */ } };
  const [attempt, setAttempt] = useState(0);
  const [randomBusy, setRandomBusy] = useState(false), [randomError, setRandomError] = useState(false), [aiGames, setAiGames] = useState<GameSummary[]>([]);
  const randomRequest = useRef<AbortController|null>(null);
  const randomOrigin = useRef<HTMLElement|null>(null);
  const revision = useLiveRefresh(active);
  const [state, setState] = useState<CatalogState>({ key: "", games: [], total: 0, nextOffset: null, error: false, loading: false, loaded: false, validated: null });
  const savedState = useRef(state);
  savedState.current = state;
  const pages = useRef(new Map<string, CatalogState>());
  if (state.validated && !state.loading && !state.error && !state.unavailable?.length) {
    pages.current.set(state.key, state);
    if (pages.current.size > 24) pages.current.delete(pages.current.keys().next().value!);
  }
  const controller = useRef<AbortController | null>(null);
  const continuation = useRef<AbortController | null>(null), sentinel = useRef<HTMLDivElement>(null);
  const key = catalogParameters(query, filters).toString();
  const unified = !!query.trim() && !hasSteamSearchFilters(filters);
  useEffect(() => { randomRequest.current?.abort(); setRandomBusy(false); setRandomError(false); return () => randomRequest.current?.abort(); }, [active, key, aiMode]);
  const filterRef = useRef(filters); filterRef.current = filters;
  const queryRef = useRef(query); queryRef.current = query;
  useEffect(() => {
    if (!active || aiMode) { controller.current?.abort(); setState(s => s.loading ? { ...s, loading: false } : s); return; }
    const requestKey = `${attempt}:${revision}`;
    // Back must retain accumulated pages and the exact failed continuation.
    // Only a new validation generation (or an unvalidated snapshot) restarts page one.
    if (savedState.current.key === key && savedState.current.validated === requestKey) return;
    const restored = pages.current.get(key);
    if (restored?.validated === requestKey && savedState.current.key !== key) { setState(restored); return; }
    const request = new AbortController(); controller.current = request;
    let received = false;
    setState(previous => {
      const held = previous.key === key ? previous : restored;
      return held ? { ...held, error: false, loading: true } : { key, games: [], total: 0, nextOffset: null, error: false, loading: true, loaded: false, validated: null };
    });
    void requests.snapshot(queryRef.current, filterRef.current).then(page => {
      if (page && !received && !request.signal.aborted) setState(previous => previous.games.length ? previous : { ...page, key, error: false, loading: true, loaded: true, validated: null });
    }, () => {});
    const timer = setTimeout(() => {
      void requests.load(queryRef.current, filterRef.current, undefined, request.signal,games=>{
        if(!request.signal.aborted)setState(previous=>previous.key===key&&(!previous.loaded||!previous.games.length)?{...previous,games,total:games.length}:previous);
      }).then(page => {
        received = true;
        if (!request.signal.aborted) setState({ ...page, key, error: false, loading: false, loaded: true, validated: requestKey });
      }, () => { received = true; if (!request.signal.aborted) setState(value => ({ ...value, loading: false, error: { kind: "initial" } })); });
    }, query.trim() ? 280 : 0);
    return () => { clearTimeout(timer); request.abort(); controller.current?.abort(); setState(value => value.key === key ? { ...value, loading: false } : value); };
  }, [active, aiMode, key, attempt, revision, requests]);
  useEffect(() => () => controller.current?.abort(), []);
  const continueSearch = async (cursor: GameSearchCursor, kind: "append" | "recover") => {
    if (!active || state.loading || state.key !== key || continuation.current && !continuation.current.signal.aborted) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request; continuation.current = request;
    setState(value => ({ ...value, loading: true, error: false }));
    try {
      const page = await requests.load(query, filters, cursor, request.signal);
      if (!request.signal.aborted) setState(previous => previous.key === key ? ({
        ...previous, ...mergeCatalogContinuation(query, filters.sort, previous, page, cursor, kind === "recover"),
        loading: false, loaded: true, error: false,
      }) : previous);
    } catch { if (!request.signal.aborted) setState(previous => ({ ...previous, loading: false, error: { kind, cursor } })); }
    finally { if (continuation.current === request) continuation.current = null; }
  };
  const loadMore = () => state.nextOffset === null ? undefined : continueSearch(state.searchCursor ?? { steam: state.nextOffset, igdb: state.nextOffset }, "append");
  const nextPage = useRef(loadMore); nextPage.current = loadMore;
  useEffect(() => {
    if (!active || aiMode || state.key !== key || !state.loaded || state.loading || state.error || state.unavailable?.length || state.nextOffset === null || !sentinel.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void nextPage.current();
    }, { root: sentinel.current.closest('.games-view'), rootMargin: '700px 0px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [active, aiMode, key, state]);
  const retry = () => {
    if (state.error && state.error.kind !== "initial") void continueSearch(state.error.cursor, state.error.kind);
    else setAttempt(value => value + 1);
  };
  const retryMissing = () => {
    const cursor = missingSearchCursor(state);
    if (cursor) void continueSearch(cursor, "recover");
    else setAttempt(value => value + 1);
  };
  const current = state.key === key;
  const games = current ? state.games : [];
  const loading = !current || state.loading;
  const activeCount = filters.tags.filter(tag => !lockedTags.includes(tag)).length + (filters.features?.length ?? 0) + Number(filters.platform !== "all") + Number(filters.mode !== "all") + Number(filters.price !== "all") + Number(filters.controller);
  const title = filters.developer ?? filters.publisher ?? (filters.features?.length ? filters.features.map(feature => feature.name).join(" · ") : query.trim() ? t("games.results") : t("games.catalog.title"));
  const random = async () => {
    if (randomBusy || !active) return;
    const request = new AbortController(); randomRequest.current = request; setRandomBusy(true); setRandomError(false);
    try {
      const pool = aiMode ? aiGames : games;
      if (!pool.length) return;
      // Choose across matching catalog results, without loading the whole catalog.
      const offset = Math.floor(Math.random() * (aiMode || unified ? pool.length : state.total));
      const candidates = aiMode || unified || offset < pool.length ? [pool[offset % pool.length]] : (await loadGameCatalog(query, filters, offset, request.signal)).games;
      if (!request.signal.aborted && candidates[0]) open(candidates[0], randomOrigin.current ?? undefined);
    } catch { if (!request.signal.aborted) setRandomError(true); }
    finally { if (!request.signal.aborted) setRandomBusy(false); }
  };

  return <section className={`games-catalog games-inset${embedded ? " is-embedded" : ""}`} aria-label={t("games.catalog.title")}>
    {!shellBackAvailable && !embedded && <button className="games-button games-catalog-back" onClick={back}><ArrowLeft size={20} />{t("common.back")}</button>}
    <div className={embedded ? "games-catalog-embedded-actions" : "games-catalog-heading"}>{!embedded && <h2 tabIndex={-1}>{title}</h2>}<div className="games-catalog-actions"><HoverTooltip label={t("games.searchUi.randomHint")} side="top"><button className="games-button games-random" data-rolling={randomBusy} aria-label={t("games.searchUi.random")} disabled={randomBusy || !(aiMode ? aiGames.length : games.length)} onClick={event => { randomOrigin.current = event.currentTarget; void random(); }}><Dices size={20}/>{t(randomBusy ? "games.searchUi.picking" : "games.searchUi.random")}</button></HoverTooltip><GameCatalogFilters filters={filters} setFilters={setFilters} active={active} lockedTags={lockedTags}/></div></div>
    {randomError && <p role="alert" className="games-catalog-error">{t("games.catalog.error")}</p>}
    {activeCount > 0 && <div className="games-catalog-active"><span>{t("games.catalog.activeFilters", { count: activeCount })}</span><button onClick={() => setFilters({ ...DEFAULT_CATALOG_FILTERS, developer: filters.developer, publisher: filters.publisher, sort: filters.sort })}><X size={13} />{t("games.catalog.reset")}</button></div>}
    {!embedded && !aiMode && !!query.trim() && !unified && <div className="games-catalog-active games-search-scope"><span>{t("games.searchUi.steamScope")}</span><button onClick={() => setFilters({ ...DEFAULT_CATALOG_FILTERS })}>{t("games.searchUi.allCatalogs")}</button></div>}
    <div className="games-catalog-toolbar">{!aiMode && <span role="status">{current && state.loaded ? t("games.catalog.showing", { count: games.length }) : t("games.catalog.searching")}</span>}<div className="games-catalog-layout"><div className="games-search-view-switch" role="group" aria-label={t("games.searchUi.view")}><HoverTooltip label={t("games.library.grid")}><button aria-label={t("games.library.grid")} aria-pressed={resultView === "grid"} onClick={() => changeView("grid")}><LayoutGrid size={18}/></button></HoverTooltip><HoverTooltip label={t("games.searchUi.rows")}><button aria-label={t("games.searchUi.rows")} aria-pressed={resultView === "rows"} onClick={() => changeView("rows")}><Rows3 size={20}/></button></HoverTooltip></div>{!aiMode && <Dropdown value={filters.sort} onChange={value => setFilters({ ...filters, sort: value as CatalogFilters["sort"] })} ariaLabel={t("games.catalog.sort")} size="sm" options={["_ASC", "Released_DESC", "Name_ASC", "Price_ASC", "Reviews_DESC"].map(value => ({ value, label: t(`games.catalog.sort.${value}`) }))} />}</div></div>
    {aiMode ? <GameAiSearch resultView={resultView} query={query} filters={filters} active={active} runSignal={runSignal} open={open} onResults={setAiGames}/> : <>
    {current && <GameDataStatus at={state.cachedAt} busy={loading} refresh={() => setAttempt(value => value + 1)} />}
    {current && !!state.unavailable?.length && <div className="games-catalog-active" role="status"><span>{t("games.searchUi.partial", { providers: state.unavailable.join(" · ") })}</span><button disabled={loading} onClick={retryMissing}>{t("common.retry")}</button></div>}
    {!!games.length && <GameSearchResults view={resultView} games={games} active={active} open={open} loadingMore={loading && state.nextOffset !== null}/>}
    {loading && !games.length && <div className="games-grid" aria-busy="true">{Array.from({ length: 9 }, (_, index) => <div key={index} className="games-card-skeleton" />)}</div>}
    {current && state.error && <div className="games-catalog-error" role="alert"><p>{t("games.catalog.error")}</p><button className="games-button" onClick={retry}>{t("common.retry")}</button></div>}
    {current && state.loaded && !games.length && !loading && !state.error && !state.unavailable?.length && state.nextOffset === null && <div className="games-state"><Search size={28} /><h3>{t("games.noResults")}</h3><p>{t("games.catalog.noResultsNote")}</p></div>}
    {current && state.nextOffset !== null && !state.error && <div className="games-catalog-continuation" ref={sentinel}><button className="games-button games-catalog-load-more" onClick={() => void loadMore()} disabled={loading}>{t(loading ? "common.loading" : "games.catalog.more")}</button></div>}
    {current && state.loaded && <p className="games-catalog-source">{t(unified ? "games.searchUi.sources" : "games.catalog.source")}</p>}</>}
  </section>;
}
