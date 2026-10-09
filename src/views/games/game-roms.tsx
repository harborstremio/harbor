import { GamePageRows, GamePageRow } from "./game-page-rows";
import { observeWithin } from "@/lib/visibility";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bookmark, Check, Search, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { NavChevron } from "@/components/nav-arrow";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { EMULATION_SYSTEMS } from "@/lib/games/emulation";
import { detailEditionTarget } from "@/lib/games/detail-edition";
import { DEFAULT_ROM_FILTERS, ROM_PLATFORMS, ROM_PLATFORM_IDS, type RomDiscoveryFilters } from "@/lib/games/rom-discovery";
import { releasedOn } from "@/lib/games/release-data";
import { loadHackSpotlights } from "@/lib/games/hack-discovery";
import type { AtlasGame, AtlasRoute } from "@/lib/games/igdb-data";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GameDataStatus } from "./game-data-status";
import { GamePosterSkeletons } from "./game-loading";
import { useGameAccess } from "./game-access";
import { RatingMark } from "./game-discovery-ratings";
import { RomHero } from "./game-rom-hero";
import { RomContinuation, RomPendingCards } from "./rom-continuation";
import { RomStudioFilter } from "./rom-studio-filter";
import { useRomPage } from "./use-rom-page";
import { HackVideoProvider } from "./game-hack-video";
import { RomMark } from "./game-rom-mark";
import { RomConsoles, RomCollections, RomPopular, RomVideos, RomLibraryEntry } from "./game-rom-sections";
import { RomDownloads } from "./game-rom-downloads";
import { romCollections } from "@/lib/games/rom-presentation";
import "./game-roms.css";

function RomScore({ game }: { game: AtlasGame }) {
  const t = useT(), value = game.userRating ?? game.rating, count = game.userRating !== undefined ? game.userRatingCount : game.ratingCount;
  if (value === undefined) return null;
  return <HoverTooltip label={t(game.userRating !== undefined ? "games.roms.playerScore" : "games.roms.combinedScore", { count: count ?? 0 })} mark={<RatingMark source="igdb-users"/>} arrow>
    <span className="games-rom-score" dir="ltr" data-tone={value >= 75 ? "good" : value >= 50 ? "mixed" : "low"} tabIndex={0} aria-label={`${Math.round(value)}/100 · IGDB`}>{Math.round(value)}<small>/100</small></span>
  </HoverTooltip>;
}

export function RomCard({ game, open, platform, landscape }: { landscape?: boolean; game: AtlasGame; platform?: number; open: (game: GameSummary) => void }) {
  const { saved, save } = useGameAccess(), t = useT(), selected = saved.some(item => item.id === game.id);
  const release = game.releaseHistory?.find(item => releasedOn([item], platform ? [platform] : ROM_PLATFORM_IDS));
  const system = ROM_PLATFORMS.find(item => item.id === (platform ?? release?.platform.id)) ?? ROM_PLATFORMS.find(item => game.platformLinks.some(link => link.id === item.id));
  const date = release?.date ?? game.release;
  return <article className={`games-rom-card${landscape ? " is-landscape" : ""}`}><button className="games-rom-card-main" data-game={game.id} onClick={() => open(game)}><div className="games-rom-cover"><GameArt src={landscape ? game.screenshots[0] || game.hero : game.portrait ?? game.capsule} fallback={game.portrait ?? game.capsule}/></div><h3>{game.name}</h3><span>{[date && new Date(date * 1000).getUTCFullYear(), system?.short].filter(Boolean).join(" · ")}</span></button><div className="games-rom-card-meta"><RomScore game={game}/><span>{game.genres[0]?.name}</span><button className="games-icon-button" aria-pressed={selected} aria-label={`${t(selected ? "games.saved" : "games.save")}: ${game.name}`} onClick={() => save(detailEditionTarget(game))}>{selected ? <Check size={15}/> : <Bookmark size={15}/>}</button></div></article>;
}

function RomStatus({ data }: { data: ReturnType<typeof useRomPage> }) {
  const t = useT();
  return <>{data.failed && <div className="games-inline-status" role="alert"><span>{t("games.atlas.error")}</span><button className="games-text-action" onClick={data.retry}>{t("common.retry")}</button></div>}<GameDataStatus at={data.page?.cachedAt} busy={data.busy} refresh={data.retry}/></>;
}

function RomHacksEntry({ active, browse, open }: { active: boolean; browse: () => void; open: (game: GameSummary) => void }) {
  const t = useT(), root = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false), [games, setGames] = useState<AtlasGame[]>([]);
  useEffect(() => { const node = root.current; if (!node) return; return observeWithin(node, "400px", entry => { if (entry.isIntersecting) setNear(true); }); }, []);
  useEffect(() => {
    if (!active || !near || games.length) return;
    const request = new AbortController();
    void loadHackSpotlights(request.signal).then(rows => { if (!request.signal.aborted) setGames(rows.slice(0, 3)); }, () => {});
    return () => request.abort();
  }, [active, near, games.length]);
  return <section className="games-rom-hacks-entry" ref={root}>
    <div className="games-rom-hacks-copy"><span>{t("games.roms.community")}</span><h2>{t("games.hub.title")}</h2><p>{t("games.roms.hacksNote")}</p><button className="games-button" onClick={browse}>{t("games.hub.title")}</button></div>
    {!!games.length && <div className="games-rom-hacks-art">{games.map(game => <button key={game.id} data-game={game.id} onClick={() => open(game)}><span className="games-rom-hack-scene"><GameArt src={game.screenshots[0] || game.hero} fallback={game.portrait}/><GameArt className="games-rom-hack-cover" src={game.portrait ?? game.capsule}/></span><strong>{game.name}</strong><span>{game.platforms.join(" · ")}</span></button>)}</div>}
  </section>;
}

function RomShelf({ kind, platform, active, open, browse }: { kind: "rated" | "coop" | "rpg" | "platformer"; platform?: number; active: boolean; open: (game: GameSummary) => void; browse: (collection: RomDiscoveryFilters["collection"], year?: number) => void }) {
  const t = useT(), root = useRef<HTMLElement>(null), [near, setNear] = useState(false), [page, setPage] = useState(0), [slots, setSlots] = useState(6), [year, setYear] = useState<number>();
  useEffect(() => { const node = root.current; if (!node) return; return observeWithin(node, "400px", entry => { if (entry.isIntersecting) setNear(true); }); }, []);
  useLayoutEffect(() => { const node = root.current; if (!node) return; const measure = () => setSlots(Math.max(2, Math.min(6, Math.floor((node.clientWidth + 20) / 170)))); measure(); const observer = new ResizeObserver(measure); observer.observe(node); return () => observer.disconnect(); }, []);
  const landscape = kind === "coop" || kind === "platformer";
  const displaySlots = landscape ? Math.max(2, Math.ceil(slots / 2)) : slots;
  const data = useRomPage({ ...DEFAULT_ROM_FILTERS, collection: kind, year, sort: kind === "rated" ? "rated" : "discussed", platform, scope: "classics" }, active && near), games = data.page?.games ?? [], pages = Math.ceil(games.length / displaySlots), current = Math.min(page, Math.max(0, pages - 1));
  useEffect(() => setPage(0), [platform, year]);
  return <section ref={root} className={`games-section games-rom-shelf games-rom-shelf-${kind}`}><div className="games-section-heading"><div><h2>{t(`games.roms.${kind}`)}</h2>{kind === "rated" && <p>{t("games.roms.ratedNote")}</p>}</div><div className="games-page-controls">{kind === "rated" && <Dropdown ariaLabel={t("games.roms.year")} value={String(year ?? "all")} onChange={value => setYear(value === "all" ? undefined : Number(value))} options={[{value:"all",label:t("games.roms.allYears")}, ...Array.from({length:new Date().getUTCFullYear()-1969},(_,i)=>({value:String(new Date().getUTCFullYear()-i),label:String(new Date().getUTCFullYear()-i)}))]}/>}<button className="games-text-action" onClick={() => browse(kind, year)}>{t("games.roms.seeAll")}</button>{(pages > 1 || data.page?.nextOffset != null) && <><button className="games-icon-button" aria-label={t("common.previous")} disabled={!current} onClick={() => setPage(current - 1)}><NavChevron dir="left" size={19}/></button><button className="games-icon-button" aria-label={t("common.next")} disabled={data.busy || (current >= pages - 1 && data.page?.nextOffset == null)} onClick={async () => { if (current < pages - 1 || await data.more()) setPage(current + 1); }}><NavChevron dir="right" size={19}/></button></>}</div></div>{!games.length && data.busy ? <GamePosterSkeletons/> : <div className="games-rom-grid" style={{ gridTemplateColumns: `repeat(${displaySlots},minmax(0,1fr))` }}>{games.slice(current * displaySlots, (current + 1) * displaySlots).map(game => <RomCard key={game.id} game={game} platform={platform} open={open} landscape={landscape}/>)}</div>}{!data.busy && !data.failed && !games.length && <p className="games-inline-status">{t("games.roms.noCollection")}</p>}<RomStatus data={data}/></section>;
}

type RomMode = "discover" | "consoles" | "collections" | "browse";
type RomProps = { active: boolean; query: string; clearQuery: () => void; open: (game: GameSummary) => void; hacks: (route: AtlasRoute, platform?: number) => void; emulate: (system: number) => void };
export function GameRoms(props: RomProps) {
  return <HackVideoProvider active={props.active}><RomDiscovery {...props}/></HackVideoProvider>;
}
function RomDiscovery({ active, query, clearQuery, open: openDetail, hacks, emulate }: RomProps) {
  const t = useT();
  const [mode, setMode] = useState<RomMode>("discover"), [filters, setFilters] = useState<RomDiscoveryFilters>({ ...DEFAULT_ROM_FILTERS, scope: "classics" }), [relationshipName, setRelationshipName] = useState("");
  const root = useRef<HTMLElement>(null), shelfTop = useRef<HTMLDivElement>(null);
  const returns = useRef<Array<{ mode: RomMode; filters: RomDiscoveryFilters; name: string; top: number; label: string }>>([]);
  const restore = useRef<{ top: number; label: string } | null>(null);
  const detailReturn = useRef<{ gameId: string; top: number } | null>(null);
  const open = (game: GameSummary) => {
    detailReturn.current = { gameId: game.id, top: root.current?.closest(".games-view")?.scrollTop ?? 0 };
    openDetail(game);
  };
  useEffect(() => {
    if (!active || !detailReturn.current) return;
    const target = detailReturn.current;
    // Retained data hooks settle after the shell's layout restoration. Restore
    // against the visible card after that commit, not a hidden hero duplicate.
    const frame = requestAnimationFrame(() => {
      const button = [...(root.current?.querySelectorAll<HTMLButtonElement>("button[data-game]") ?? [])].find(item => item.dataset.game === target.gameId && !item.closest("[hidden]"));
      if (button) { root.current?.closest(".games-view")?.scrollTo({ top: target.top, behavior: "instant" }); button.focus({ preventScroll: true }); detailReturn.current = null; }
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);
  const searching = !!query.trim(), browseMode = mode === "browse" || searching, discovering = mode === "discover" && !searching;
  const [searchOrder, setSearchOrder] = useState<RomDiscoveryFilters["sort"]>("relevance");
  const searchSort = searching ? searchOrder : filters.sort;
  const catalog = useRomPage({ ...filters, query, sort: searchSort }, active && browseMode);
  const editorial = useRomPage({ ...DEFAULT_ROM_FILTERS, platform: filters.platform, studio: filters.studio, directory: true, scope: "classics" }, active && !browseMode && mode !== "consoles");
  const popular = useRomPage({ ...DEFAULT_ROM_FILTERS, collection: "rated", platform: filters.platform, studio: filters.studio, scope: "classics" }, active && discovering);
  const hero = popular;
  const featured = (hero.page?.games ?? []).filter(game => game.hero || game.screenshots.length).slice(0, 24);
  const [genreOptions, setGenreOptions] = useState<Array<{ id: number; name: string }>>([]);
  useEffect(() => {
    const received = [...(editorial.page?.genres ?? []), ...(catalog.page?.genres ?? [])];
    if (received.length) setGenreOptions(previous => [...new Map([...previous, ...received].map(genre => [genre.id, genre])).values()].sort((a, b) => a.name.localeCompare(b.name)));
  }, [editorial.page, catalog.page]);
  const collectionGames = editorial.page?.games ?? [];
  const franchises = romCollections(collectionGames);
  const scrollToContent = () => requestAnimationFrame(() => shelfTop.current?.scrollIntoView({ block: "start", behavior: "instant" }));
  const rememberSection = () => {
    const origin = document.activeElement;
    returns.current.push({ mode, filters, name: relationshipName, top: root.current?.closest(".games-view")?.scrollTop ?? 0, label: origin?.getAttribute("aria-label") || origin?.textContent?.trim() || "" });
    if (returns.current.length > 20) returns.current.shift();
  };
  const showMode = (next: RomMode) => { if (next === "discover") returns.current = []; else if (next !== mode) rememberSection(); clearQuery(); setMode(next); if (next === "discover") root.current?.closest(".games-view")?.scrollTo({ top: 0, behavior: "instant" }); else scrollToContent(); };
  const showCatalog = (changes: Partial<RomDiscoveryFilters> = {}, name = "") => { rememberSection(); clearQuery(); setFilters(value => ({ ...DEFAULT_ROM_FILTERS, scope: "classics", platform: value.platform, ...changes })); setRelationshipName(name); setMode("browse"); scrollToContent(); };
  useSectionBack(() => {
    if (searching) { clearQuery(); return; }
    const previous = returns.current.pop();
    restore.current = previous ?? { top: 0, label: t("games.roms.discover") };
    setMode(previous?.mode ?? "discover"); setFilters(previous?.filters ?? { ...DEFAULT_ROM_FILTERS, scope: "classics" }); setRelationshipName(previous?.name ?? "");
  }, active && (mode !== "discover" || searching));
  useLayoutEffect(() => {
    if (!active || !restore.current) return;
    const target = restore.current; restore.current = null;
    const frame = requestAnimationFrame(() => {
      root.current?.closest(".games-view")?.scrollTo({ top: target.top, behavior: "instant" });
      [...(root.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(button => !button.closest("[hidden]") && (button.getAttribute("aria-label") === target.label || button.textContent?.trim() === target.label))?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, mode, filters, searching]);
  const changePlatform = (platform?: number) => { setFilters(value => ({ ...value, platform })); };
  const openHacks = () => hacks({ kind: "romhacks", name: t("games.hub.title") }, filters.platform);
  const openLibrary = () => emulate(EMULATION_SYSTEMS.some(system => system.id === filters.platform) ? filters.platform! : 24);
  const systems = ROM_PLATFORMS;
  const nav = [
    { kind: "discover", label: "games.roms.discover", action: () => showMode("discover") },
    { kind: "consoles", label: "games.roms.consoles", action: () => showMode("consoles") },
    { kind: "collections", label: "games.roms.collections", action: () => showMode("collections") },
    { kind: "hacks", label: "games.hub.title", action: openHacks },
    { kind: "library", label: "games.roms.yourLibrary", action: openLibrary },
  ] as const;
  return <article ref={root} className={`games-roms${!discovering ? " is-browsing" : ""}`}>
    <RomHero games={featured} active={active && discovering} busy={hero.busy} failed={hero.failed} retry={hero.retry} browse={() => showCatalog()} open={open} platform={filters.platform} score={game => <RomScore game={game}/>}/>
    <div className="games-inset games-rom-body">
      <nav className="games-rom-destinations" aria-label={t("games.roms.navigation")} ref={shelfTop}>
        {nav.map(item => <button key={item.kind} aria-current={!browseMode && mode === item.kind ? "page" : undefined} onClick={item.action}><RomMark kind={item.kind}/><span>{t(item.label)}</span></button>)}
      </nav>
      <div className="games-rom-toolbar">
        <button className="games-text-action" aria-current={browseMode ? "page" : undefined} onClick={() => showCatalog()}>{t("games.roms.allGames")}</button>
        <div className="games-rom-toolbar-filters"><RomStudioFilter value={filters.studio} games={[...collectionGames, ...(catalog.page?.games ?? [])]} onChange={studio => setFilters(previous => ({ ...previous, studio }))}/><Dropdown value={String(filters.platform ?? "all")} ariaLabel={t("games.roms.console")} onChange={value => changePlatform(value === "all" ? undefined : Number(value))} options={[{ value: "all", label: t("games.roms.allConsoles") }, ...systems.map(system => ({ value: String(system.id), label: system.name }))]}/></div>
      </div>
      {!browseMode && mode === "consoles" && <RomConsoles all={mode === "consoles"} platform={filters.platform} change={platform => showCatalog({ platform })} more={() => showMode("consoles")}/>}
      {!browseMode && mode === "collections" && <><RomCollections groups={franchises} all={mode === "collections"} busy={editorial.busy} pending={mode === "collections" && !editorial.failed && (editorial.busy || editorial.page?.nextOffset != null)} choose={group => showCatalog({ studio: filters.studio, relationship: { kind: group.kind, id: group.id } }, group.name)} more={() => showMode("collections")}/><RomStatus data={editorial}/><RomContinuation active={active && mode === "collections"} busy={editorial.busy} failed={editorial.failed} cursor={editorial.page?.nextOffset} more={editorial.more}/></>}
      <div hidden={!discovering}>
        <GamePageRows page="games-roms" active={active && discovering}>
          <GamePageRow id="consoles" title={t("games.roms.pickConsole")}>{discovering && <RomConsoles all={false} platform={filters.platform} change={platform => showCatalog({ platform })} more={() => showMode("consoles")}/>}</GamePageRow>
          <GamePageRow id="popular" title={t("games.roms.popular")}>{discovering && <><RomPopular games={popular.page?.games ?? []} busy={popular.busy} open={open} browse={() => showCatalog({ sort: "discussed" })}/><RomStatus data={popular}/></>}</GamePageRow>
          <GamePageRow id="collections" title={t("games.roms.franchises")}>{discovering && <><RomCollections groups={franchises} all={false} busy={editorial.busy} pending={false} choose={group => showCatalog({ studio: filters.studio, relationship: { kind: group.kind, id: group.id } }, group.name)} more={() => showMode("collections")}/><RomStatus data={editorial}/></>}</GamePageRow>
          <GamePageRow id="rated" title={t("games.roms.rated")}><RomShelf kind="rated" platform={filters.platform} active={active && discovering} open={open} browse={(collection, year) => showCatalog({ collection, year })}/></GamePageRow>
          <GamePageRow id="videos" title={t("games.roms.watchTitle")}><RomVideos games={collectionGames} platform={filters.platform} active={active && discovering}/></GamePageRow>
          <GamePageRow id="hacks" title={t("games.hub.title")}><RomHacksEntry active={active && discovering} browse={openHacks} open={open}/></GamePageRow>
          <GamePageRow id="downloads" title={t("games.roms.downloadCharts")}>{!filters.platform && <RomDownloads active={active && discovering} open={open}/>}</GamePageRow>
          <GamePageRow id="coop" title={t("games.roms.coop")}><RomShelf kind="coop" platform={filters.platform} active={active && discovering} open={open} browse={(collection, year) => showCatalog({ collection, year })}/></GamePageRow>
          <GamePageRow id="rpg" title={t("games.roms.rpg")}><RomShelf kind="rpg" platform={filters.platform} active={active && discovering} open={open} browse={(collection, year) => showCatalog({ collection, year })}/></GamePageRow>
          <GamePageRow id="platformer" title={t("games.roms.platformer")}><RomShelf kind="platformer" platform={filters.platform} active={active && discovering} open={open} browse={(collection, year) => showCatalog({ collection, year })}/></GamePageRow>
          <GamePageRow id="library" title={t("games.roms.yourLibrary")}><RomLibraryEntry open={openLibrary}/></GamePageRow>
        </GamePageRows>
      </div>
      <section className="games-rom-catalog" hidden={!browseMode}><div className="games-section-heading"><div><h2 tabIndex={-1}>{relationshipName || t(`games.roms.${filters.collection && filters.collection !== "all" ? filters.collection : "allGames"}`)}</h2><p>{filters.year ? `${t("games.roms.year")}: ${filters.year}` : t("games.roms.catalogNote")}</p></div>{(filters.studio || filters.genre || filters.relationship || filters.year || filters.era !== "all" || filters.collection && filters.collection !== "all") && <button className="games-text-action" onClick={() => showCatalog()}><X size={15}/>{t("games.roms.reset")}</button>}</div>
        <div className="games-rom-filters"><Dropdown ariaLabel={t("games.roms.genre")} value={String(filters.genre ?? "all")} onChange={value => setFilters(previous => ({ ...previous, genre: value === "all" ? undefined : Number(value) }))} options={[{ value: "all", label: t("games.roms.allGenres") }, ...genreOptions.map(genre => ({ value: String(genre.id), label: genre.name }))]}/><Dropdown ariaLabel={t("games.roms.era")} value={filters.era} onChange={value => setFilters(previous => ({ ...previous, era: value as RomDiscoveryFilters["era"] }))} options={["all", "before1990", "1990", "2000", "2010", "2020"].map(value => ({ value, label: t(`games.atlas.era.${value}`) }))}/><Dropdown ariaLabel={t("games.catalog.sort")} value={searchSort} onChange={value => searching ? setSearchOrder(value as RomDiscoveryFilters["sort"]) : setFilters(previous => ({ ...previous, sort: value as RomDiscoveryFilters["sort"] }))} options={[...(searching ? ["relevance"] : []), "discussed", "rated", "newest", "oldest", "name"].map(value => ({ value, label: t(`games.roms.sort.${value}`) }))}/><span role="status">{t(catalog.page ? "games.catalog.showing" : "games.atlas.loading", { count: catalog.page?.games.length ?? 0 })}</span></div>
        <div className="games-rom-grid games-rom-catalog-grid" aria-busy={catalog.busy}>{catalog.page?.games.map(item => <RomCard key={item.id} game={item} platform={filters.platform} open={open}/>)}{!catalog.failed && (catalog.busy || catalog.page?.nextOffset != null) && <RomPendingCards/>}</div>
        <RomContinuation active={active && browseMode} busy={catalog.busy} failed={catalog.failed} cursor={catalog.page?.nextOffset} more={catalog.more}/><RomStatus data={catalog}/>
        {!catalog.busy && !catalog.failed && !catalog.page?.games.length && <div className="games-state"><Search size={28}/><h3>{t("games.noResults")}</h3><p>{t("games.roms.empty")}</p><button className="games-button" onClick={() => showCatalog()}>{t("games.roms.reset")}</button></div>}
      </section>
      <footer className="games-rom-source">{t("games.roms.source")}</footer>
    </div>
  </article>;
}
