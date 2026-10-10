import { isRomHack } from "@/lib/games/hack-catalog";
import { GameHackBaseFilter } from "./game-hack-base-filter";
import { HackVideoProvider } from "./game-hack-video";
import { GameHackHeading, GameHackCard } from "./game-hack-hub";
import { GameSkeleton } from "./game-loading";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, Search, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { loadAtlasPage, readAtlasPageSnapshot } from "@/lib/games/atlas";
import { savedMetadataAt } from "@/lib/games/metadata-records";
import { GameDataStatus } from "./game-data-status";
import { useLiveRefresh } from "./use-live-refresh";
import { DEFAULT_ATLAS_FILTERS, atlasQuery, type AtlasFilters, type AtlasGame, type AtlasRoute } from "@/lib/games/igdb-data";
import { GAME_PLATFORMS } from "@/lib/games/platforms";
import type { GameSummary } from "@/lib/games/types";
import type { GameMediaTarget } from "@/lib/games/cross-media";
import { GameArt } from "./game-art";
import { GameCard, GameMark } from "./game-ui";
import { EMULATION_SYSTEMS } from "@/lib/games/emulation";
import { GameStudioHeading } from "./game-studios";
import { GameStudioCatalogFilters } from "./game-studio-catalog";
import { GameWarhammerWorld } from "./game-warhammer-world";
import { WARHAMMER_40K_FRANCHISE, isKnownWarhammerMisclassification, isWarhammerCrossover } from "@/lib/games/warhammer-data";
import { ROM_PLATFORMS } from '@/lib/games/rom-discovery';
import { GameConsolePage } from './game-console-page';
import { GameAtlasHero, GameAtlasPlatforms, GameAtlasScrollTop } from "./game-atlas-discovery";

export function GamePlatforms({ browse }: { browse: (route: AtlasRoute) => void }) {
  const t = useT();
  const open=(platform:typeof GAME_PLATFORMS[number])=>browse({kind:"platform",...platform,image:platform.device??platform.image});
  return <section className="games-section games-inset games-platform-section">
    <div className="games-section-heading"><div><h2>{t("games.editorial.consoleTitle")}</h2><p>{t("games.editorial.consoleNote")}</p></div><button className="games-text-action" onClick={()=>browse({kind:"all",name:t("games.atlas.title")})}>{t("games.atlas.browseAll")}<ArrowRight size={17}/></button></div>
    <div className="games-platform-cards">{[24,7].map(id=>GAME_PLATFORMS.find(p=>p.id===id)!).map(platform=><button className={`games-platform-feature games-platform-${platform.id}`} key={platform.id} onClick={()=>open(platform)}>
      <span className="games-platform-lineage">{platform.family}</span><span className="games-platform-logo"><GameArt src={platform.device!}/></span>
      <span className="games-platform-feature-copy"><strong>{platform.name}</strong><span>{t("games.editorial.explorePlatform")}<ArrowRight size={18}/></span></span>
    </button>)}</div>
    <div className="games-platform-index">{([ [19,"snes"],[4,"n64"],[21,"gamecube"],[130,"switch"] ] as const).map(([id,mark])=>{const platform=GAME_PLATFORMS.find(p=>p.id===id)!;return <button key={platform.id} onClick={()=>open(platform)}><GameArt className={`games-platform-mark-${mark}`} src={`/games/platforms/${mark}-logo.svg`}/><span>{platform.short}</span><ArrowUpRight size={16}/></button>;})}</div>
    <button className="games-hacks-link" onClick={()=>browse({kind:"hacks",name:t("games.atlas.hacks")})}><GameMark kind="create" size={25}/><span><strong>{t("games.atlas.hacks")}</strong><span>{t("games.atlas.hacksNote")}</span></span><ArrowRight size={20}/></button>
  </section>;
}
type PageState = { key: string; games: AtlasGame[]; nextOffset: number | null; loading: boolean; error: boolean; loaded: boolean; cachedAt?: number; failedOffset?: number };
export function GameAtlasPage(props:Parameters<typeof AtlasPage>[0]&{consoleMenu?:ReactNode}) {
  const platform=props.route.kind==='platform'?ROM_PLATFORMS.find(item=>item.id===props.route.id):undefined;
  return platform?<GameConsolePage key={platform.id} platform={platform} menu={props.consoleMenu} active={props.active} open={props.open} back={props.back} emulate={props.emulate} shellBackAvailable={props.shellBackAvailable}/>:<AtlasPage {...props}/>;
}

function AtlasPage({ route, filters, setFilters, browse, open, back, active, emulate, openMedia, shellBackAvailable = false }: {
  route: AtlasRoute; filters: AtlasFilters; setFilters: (filters: AtlasFilters) => void; browse: (route: AtlasRoute) => void; open: (game: GameSummary) => void; back: () => void; active: boolean; emulate:(system:number)=>void; openMedia?: (target: GameMediaTarget) => void; shellBackAvailable?: boolean;
}) {
  const t = useT();
  const isHackHub = route.kind === "hacks" || route.kind === "romhacks";
  const isWarhammer = route.kind === "franchise" && route.id === WARHAMMER_40K_FRANCHISE;
  const isStudio = route.kind === "company", isAtlas = route.kind === "all", infinite = isWarhammer || isStudio || isHackHub || isAtlas;
  const key = atlasQuery(route, filters);
  const platformArt = route.kind === "platform" ? GAME_PLATFORMS.find(p => p.id === route.id)?.device ?? route.image : route.image;
  const [state, setState] = useState<PageState>({ key: "", games: [], nextOffset: null, loading: false, error: false, loaded: false });
  const [attempt, setAttempt] = useState(0);
  const revision = useLiveRefresh(active, 31 * 60_000);
  const lastRequest = useRef("");
  const held = useRef(state); held.current = state;
  const pages = useRef(new Map<string, PageState>());
  if (state.loaded && !state.loading && !state.error) {
    pages.current.set(state.key, state);
    if (pages.current.size > 24) pages.current.delete(pages.current.keys().next().value!);
  }
  const parameters = useRef({ route, filters }); parameters.current = { route, filters };
  const controller = useRef<AbortController | null>(null);
  const continuation = useRef<HTMLDivElement>(null), pagePending = useRef<AbortController | null>(null);
  useEffect(() => {
    pagePending.current?.abort(); pagePending.current = null;
    if (!active) { controller.current?.abort(); setState(s => s.loading ? { ...s, loading: false } : s); return; }
    const requestKey = `${attempt}:${revision}`, refresh = lastRequest.current !== requestKey;
    lastRequest.current = requestKey;
    if (!refresh && held.current.key === key && held.current.loaded && !held.current.error) return;
    const restored = pages.current.get(key);
    if (!refresh && restored && held.current.key !== key) { setState(restored); return; }
    const request = new AbortController(); controller.current = request;
    let received = false;
    setState(previous => previous.key === key ? { ...previous, loading: true, error: false } : { key, games: [], nextOffset: null, loading: true, error: false, loaded: false });
    const p = parameters.current;
    void readAtlasPageSnapshot(p.route, p.filters).then(page => {
      if (page && !received && !request.signal.aborted) setState(previous => previous.games.length ? previous : { ...page, key, loading: true, error: false, loaded: true });
    });
    const timer = setTimeout(() => { const p = parameters.current; void loadAtlasPage(p.route, p.filters, 0, request.signal).then(page => {
      received = true;
      if (!request.signal.aborted) setState({ ...page, key, loading: false, error: false, loaded: true });
    }, () => { if (!request.signal.aborted) setState(s => ({ ...s, loading: false, error: true, failedOffset: 0 })); }); }, filters.query.trim() ? 280 : 0);
    return () => { clearTimeout(timer); request.abort(); controller.current?.abort(); setState(s => s.key === key ? { ...s, loading: false } : s); };
  }, [key, active, attempt, revision]);
  useEffect(() => () => controller.current?.abort(), []);
  const more = async () => {
    if (pagePending.current || state.key !== key || state.loading || state.nextOffset === null || !active) return;
    const request = new AbortController(); pagePending.current = request; controller.current?.abort(); controller.current = request;
    setState(s => ({ ...s, loading: true, error: false }));
    try { const page = await loadAtlasPage(route, filters, state.nextOffset, request.signal); if (!request.signal.aborted) setState(s => ({ ...page, key, cachedAt: savedMetadataAt([s, page]), games: [...new Map([...s.games, ...page.games].map(g => [g.igdbId, g])).values()], loading: false, loaded: true, error: false })); }
    catch { if (!request.signal.aborted) setState(s => ({ ...s, loading: false, error: true, failedOffset: state.nextOffset! })); }
    finally { if (pagePending.current === request) pagePending.current = null; }
  };
  const current = key === state.key, games = current ? state.games.filter(game => (!isWarhammer || !isKnownWarhammerMisclassification(game.igdbId)) && (route.kind !== "romhacks" || isRomHack(game))) : [], loading = !current || state.loading;
  const highlights = useRef<AtlasGame[]>([]);
  if (isAtlas && !highlights.current.length && games.length) highlights.current = games.slice(0, 24);
  const [hiddenRows, setHiddenRows] = useState<string[]>([]);
  const loadNext = useRef(more); loadNext.current = more;
  useEffect(() => {
    if ((isHackHub && hiddenRows.includes("catalog")) || !infinite || !active || !current || loading || state.error || state.nextOffset === null || !continuation.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void loadNext.current(); }, { root: continuation.current.closest(".games-view"), rootMargin: "600px 0px" });
    observer.observe(continuation.current);
    return () => observer.disconnect();
  }, [infinite, active, current, loading, state.error, state.nextOffset, key, hiddenRows, isHackHub]);
  const catalogContent = <>
    {isStudio ? <GameStudioCatalogFilters filters={filters} setFilters={setFilters}/> : <div className="games-atlas-toolbar">{isHackHub ? <GameHackBaseFilter route={route} browse={browse}/> : <div className="games-search"><Search size={17} /><input value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value })} placeholder={t("games.atlas.search")} aria-label={t("games.atlas.search")} />{filters.query && <button className="games-icon-button" aria-label={t("games.clear")} onClick={() => setFilters({ ...filters, query: "" })}><X size={16} /></button>}</div>}{isHackHub ? <Dropdown ariaLabel={t("games.platforms")} value={String(filters.platform ?? "all")} onChange={value=>setFilters({...filters,platform:value === "all" ? undefined : Number(value)})} options={[{value:"all",label:t("games.hub.allSystems")},...EMULATION_SYSTEMS.map(system=>({value:String(system.id),label:system.short}))]}/> : <Dropdown ariaLabel={t("games.atlas.era")} value={filters.era} onChange={era => setFilters({ ...filters, era: era as AtlasFilters["era"] })} options={["all","before1990","1990","2000","2010","2020"].map(value => ({ value, label: t(`games.atlas.era.${value}`) }))} />}{filters.query.trim() ? <span className="games-atlas-search-sort">{t("games.atlas.searchOrder")}</span> : <Dropdown ariaLabel={t("games.catalog.sort")} value={filters.sort} onChange={sort => setFilters({ ...filters, sort: sort as AtlasFilters["sort"] })} options={["discussed","rated","newest","oldest"].map(value => ({ value, label: t(`games.atlas.sort.${value}`) }))} />}</div>}
    {route.kind === "platform" && EMULATION_SYSTEMS.some(system => system.id === route.id) && <div className="games-patch-entry"><span>{t("games.emulation.ownGames")}</span><button className="games-button" onClick={() => emulate(route.id!)}>{t("games.emulation.openLibrary")}<ArrowRight size={17}/></button></div>}
    <div className="games-atlas-result-heading"><span role="status">{current && state.loaded ? t("games.catalog.showing", { count: games.length }) : t("games.atlas.loading")}</span>{!isStudio && filters.query.trim() && <span>{t("games.atlas.searchOrder")}</span>}</div>
    {current && <GameDataStatus at={state.cachedAt} refresh={() => setAttempt(value => value + 1)} busy={loading} />}
    {isHackHub && !!games.length && <div className="games-hack-grid">{games.map(game=><GameHackCard key={game.id} game={game} open={open} browse={browse}/>)}</div>}
    {!isHackHub && !!games.length && <div className="games-atlas-grid">{games.map(game => <div key={game.igdbId} className="games-atlas-result"><GameCard game={game} open={open} portrait compactPlatforms={isStudio || isAtlas} catalogRating={isStudio || isAtlas ? { score: game.rating, count: game.ratingCount } : undefined}/><div className="games-atlas-result-meta">{game.release !== undefined && <span>{new Date(game.release * 1000).getUTCFullYear()}</span>}{isWarhammer && isWarhammerCrossover(game.igdbId) && <span className="games-warhammer-crossover">{t("games.warhammer.crossover")}</span>}{game.gameType === 5 && <span>{t("games.atlas.mod")}</span>}{!isStudio && !isAtlas && game.rating !== undefined && <span title={t("games.atlas.ratingNote", { count: game.ratingCount })}>{Math.round(game.rating)}<small>/ 100</small></span>}</div></div>)}</div>}
    {loading && !games.length && <div className={isHackHub ? "games-hack-grid" : "games-atlas-grid"} aria-busy="true">{Array.from({ length: 12 }, (_, i) => <div key={i} className={isHackHub ? "games-hack-skeleton" : ""}><GameSkeleton className="games-skeleton-poster"/><GameSkeleton className="games-skeleton-title"/><GameSkeleton className="games-skeleton-meta"/></div>)}</div>}
    {current && state.error && <div className="games-state" role="alert"><h3>{t("games.atlas.error")}</h3><p>{t("games.retryNote")}</p><button className="games-button" onClick={() => state.failedOffset ? void more() : setAttempt(a => a + 1)}>{t("common.retry")}</button></div>}
    {current && state.loaded && !loading && !state.error && !games.length && <div className="games-state"><h3>{t("games.noResults")}</h3><p>{t("games.atlas.empty")}</p><button className="games-button" onClick={() => setFilters(DEFAULT_ATLAS_FILTERS)}>{t("games.catalog.reset")}</button></div>}
    {infinite && current && state.nextOffset !== null && !state.error && <div ref={continuation} className={isHackHub ? "games-hack-continuation" : isStudio || isAtlas ? "games-studio-catalog-continuation" : "wh-catalog-continuation"} aria-busy={loading}>{loading && games.length > 0 && <><span className="wh-source-note" role="status">{t("common.loading")}</span><div className={isHackHub ? "games-hack-grid" : "games-atlas-grid"} aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i}><GameSkeleton className="games-skeleton-poster"/><GameSkeleton className="games-skeleton-title"/><GameSkeleton className="games-skeleton-meta"/></div>)}</div></>}{(isStudio || isAtlas) && <button className="games-button games-studio-catalog-next" onClick={()=>void more()} disabled={loading}>{t("games.catalog.more")}</button>}</div>}
    {!infinite && current && state.nextOffset !== null && !state.error && <button className="games-button games-catalog-more" onClick={() => void more()} disabled={loading}>{t(loading ? "common.loading" : "games.catalog.more")}<ChevronDown size={16} /></button>}
  </>;
  return <HackVideoProvider active={active}><article className={`games-atlas-page games-inset${isHackHub ? " games-hack-hub" : ""}${isWarhammer ? " is-warhammer" : ""}${isStudio ? " games-studio-catalog" : ""}${isAtlas ? " is-discovery-atlas" : ""}`}>
    {!shellBackAvailable && <button className="games-button games-catalog-back games-atlas-back" onClick={back}><ArrowLeft size={17} />{t("common.back")}</button>}
    {isAtlas ? <><GameAtlasHero games={highlights.current} active={active} loading={loading} open={open}/><GameAtlasPlatforms browse={browse}/></> : isWarhammer ? <GameWarhammerWorld active={active} image={route.image} open={open} openMedia={openMedia}/> : isHackHub ? <GameHackHeading onVisibilityChange={setHiddenRows} route={route} games={games} browse={browse} open={open} emulate={emulate} active={active}>{catalogContent}</GameHackHeading> : route.kind === "company" ? <GameStudioHeading route={route} active={active} browse={browse} showStatus={state.cachedAt === undefined}/> : <div className="games-atlas-heading">{platformArt && <span className="games-atlas-platform-logo"><GameArt src={platformArt} eager /></span>}<div><span className="games-section-kicker">{t(`games.atlas.kind.${route.kind}`)}</span><h1 tabIndex={-1}>{route.name}</h1><p>{t((route.kind === "hacks" || route.kind === "romhacks") ? "games.atlas.hacksDescription" : ["greats","coop"].includes(route.kind) ? `games.collectionsLive.${route.kind}Note` : "games.atlas.description")}</p></div></div>}
    {!isHackHub && catalogContent}
    <p className="games-catalog-source">{t("games.atlas.source")}</p>
    {isAtlas && <GameAtlasScrollTop active={active}/>}
  </article></HackVideoProvider>;
}
