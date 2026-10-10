import { GameSteamStatus } from "./game-steam-status";
import { GamePageRows, GamePageRow } from "./game-page-rows";
import { gameSeason } from "@/lib/games/seasons";
import { GameHackMast } from "./game-hack-mast";
import type { ModsRoute } from "@/lib/games/mod-workspace";
import { BackToTop } from "@/components/back-to-top";
import { GameExploreShortcuts } from "./game-explore-shortcuts";
import "./game-explore-flow.css";
import { simsInstallations } from "@/lib/games/sims-installations";
import { GameAvailabilityScope } from "./game-availability";
import {unifiedLibrary, type UnifiedSource} from "@/lib/games/unified-library";
import type {LauncherDiscoveryId} from "@/lib/games/launcher-discovery";
import {GameLaunchers} from "./game-launchers";
import { GameDiscoveryCollection, GameMilestones } from "./game-discovery-collections";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useSectionBack } from "@/lib/section-back";
import { enrichGameDiscovery, loadGameArtwork, loadGameDiscovery, readGameDiscoverySnapshot } from "@/lib/games/catalog";
import { GameDataStatus } from "./game-data-status";
import { DEFAULT_CATALOG_FILTERS, type CatalogFilters } from "@/lib/games/catalog-filters";
import { GameAccessProvider } from "./game-access-context";
import { useGameAccess, useOptionalGameAccess, type LibraryDestination } from "./game-access";
import type { GameArtwork, GameDiscovery, GameSummary } from "@/lib/games/types";
import type { GameCollection } from "@/lib/games/collections";
import type { CloudKeys } from "@/lib/games/cloud-files";
import { GamesIcon } from "@/components/icons/games-icon";
import { useSteamAccount } from "@/hooks/use-steam-account";
import { useGameTransfers } from "@/hooks/use-game-transfers";
import { useGameSetup } from "@/hooks/use-game-setup";
import { useGameArchives } from "@/hooks/use-game-archives";
import { downloadSetup, downloadSetupSummary } from "@/lib/games/download-setup";
import { GameLibraryPreferenceDialog } from "./game-library-personal";

import { GameCustomLibrary } from "./game-custom-library";
import { useGameSources } from "@/hooks/use-game-sources";
import { GameSourcesModal } from "./game-sources";
import { GameSourceLinkScope } from "./game-source-links";
import { GameRecommendations } from "./game-recommendations";
import { GameDiscoveryPicker } from "./game-discovery-picker";
import type { GameMediaTarget } from "@/lib/games/cross-media";
import type { PersonalCollectionGame } from "@/lib/games/personal-collections";
import { usePersonalGameCollections } from "@/hooks/use-personal-game-collections";
import { GameCollectionPicker, GamePersonalCollections } from "./game-personal-collections";

import { GameTorrentDialog } from "./game-torrent";
import type { GameTorrent } from "@/lib/games/torrents";

import { GameLibrary } from "./game-library";

import { GameLibrarySidebar } from "./game-library-sidebar";
import { GameCatalog } from "./game-catalog";
import { GameSearchControl } from "./game-search-control";

import { GameGuidesScope } from "./game-guides";
import { GameShowcase } from "./game-showcase";
import { GameNavigation, type GameDestination } from "./game-navigation";
import { createExploreVisit } from "@/lib/games/explore-visit";
import { GameCollections, GameCollectionPage } from "./game-collections";
import { DiscoveryDesk, NewReleases } from "./game-discovery";
import { GameUpcoming } from "./game-store-row";
import { GameSavedWatchlist } from "./game-saved-watchlist";
import { GameAtlasPage, GamePlatforms } from "./game-atlas";
import { GameHighlights } from "./game-highlights";
import { DEFAULT_FAVORITE_REVIEWS, type FavoriteReviewFilters, type GameFavoriteFilter } from "@/lib/games/favorites-data";
import { GameStoryFeature } from "./game-story-feature";
import { GameSeasonal } from "./game-seasonal";
import { GameRomShowcase } from "./game-rom-showcase";

import { GameNewsFeed } from "./game-news-feed";
import { GameStudios } from "./game-studios";
import { GameActivePlayers } from "./game-active-players";
import { GameFranchiseWorlds } from "./game-franchise-worlds";
import { GameEsports } from "./game-esports";
import { GameMajorTournaments } from "./game-major-tournaments";
import { GameRecentSources } from "./game-recent-sources";
import { GameSteamSale } from "./game-steam-sale";
import type { EsportsMatch } from "@/lib/sports/esports-feeds";
import { useGameReveal } from "./use-game-reveal";
import { useLiveRefresh } from "./use-live-refresh";
import { DEFAULT_ATLAS_FILTERS, type AtlasFilters, type AtlasRoute } from "@/lib/games/igdb-data";
import "./games.css";
import "./games-editorial.css";
import "./games-loading.css";
import "./game-explore-polish.css";

import { deferredGameView, GameVisited } from "./game-deferred";

const ModsWorkspace = deferredGameView(async () => ({ default: (await import("./mods-workspace")).ModsWorkspace }));
const GameDownloads = deferredGameView(async () => ({ default: (await import("./game-downloads")).GameDownloads }));
const GameEmulation = deferredGameView(async () => ({ default: (await import("./game-emulation")).GameEmulation }));
const GameUnifiedLibrary = deferredGameView(async () => ({ default: (await import("./game-unified-library")).GameUnifiedLibrary }));
const GameRoms = deferredGameView(async () => ({ default: (await import("./game-roms")).GameRoms }));
const GameDetailPage = deferredGameView(async () => ({ default: (await import("./game-detail")).GameDetailPage }));

type ReturnFocus = { top: number; element: HTMLElement | null; gameId?: string; label?: string };

type GamesViewProps = { harborNavigationOpen?: boolean; onHarborNavigationChange?: (open: boolean) => void; shellBackAvailable?: boolean; active?: boolean; profileId?: string; openMedia?:(target:GameMediaTarget)=>void; cloudKeys?: CloudKeys; openSourceSettings?:()=>void; openEsports?:(match:EsportsMatch)=>void; openSports?:()=>void };
export function GamesView(props: GamesViewProps) {
  const shared = useOptionalGameAccess();
  return shared ? <GamesViewContent {...props}/> : <GameAccessProvider profile={props.profileId ?? "default"} gamesActive={props.active ?? true}><GamesViewContent {...props}/></GameAccessProvider>;
}
function GamesViewContent({ harborNavigationOpen = false, onHarborNavigationChange, shellBackAvailable = false, active = true, profileId = "default", openMedia, cloudKeys = {}, openSourceSettings, openEsports, openSports }: GamesViewProps) {
  const t = useT();
  const access = useGameAccess();
  const { library, libraryPreferences, customLibrary, emulation, saved, save, saveFailed, setSaveFailed } = access;
  const externalReturn = useRef(false);
  const mediaReturn = useRef<ReturnFocus | null>(null);
  const [leavingExternal, setLeavingExternal] = useState(false);
  const { settings } = useSettings();
  const gamesHomeTab = settings.gamesOpenInLibrary ? "library" : "explore";
  const [tab, setTab] = useState<GameDestination>(gamesHomeTab);
  useEffect(() => { if (!active && !mediaReturn.current && settings.gamesOpenInLibrary) setTab("library"); }, [active, settings.gamesOpenInLibrary]);
  const steamAccount = useSteamAccount(profileId, active);
  const collectionLibrary=useMemo(()=>unifiedLibrary({steamImports:access.steamImports.data.games,installed:library.scan?.games??[],steamKnown:!!library.scan&&!library.error,steamComplete:!library.scan?.warnings.length,account:steamAccount.status.snapshot,
    custom:customLibrary.data.games,customHealth:customLibrary.health,retro:emulation.data,launchers:access.launchers.scan,launchersKnown:!!access.launchers.scan&&!access.launchers.error,preferences:libraryPreferences.data}),
    [access.steamImports.data.games,library.scan,library.error,steamAccount.status.snapshot,customLibrary.data.games,customLibrary.health,emulation.data,access.launchers.scan,access.launchers.error,libraryPreferences.data]);
  const downloads=useGameTransfers(profileId,active);
  const setupState=useGameSetup(profileId,true,customLibrary);
  const archiveState=useGameArchives(profileId,true);
  const sources=useGameSources(profileId);
  const personalCollections=usePersonalGameCollections(profileId);
  const [collectGame,setCollectGame]=useState<PersonalCollectionGame|PersonalCollectionGame[]|null>(null);
  useEffect(()=>{setCollectGame(null);},[profileId]);
  useEffect(()=>{if(!active)setCollectGame(null);},[active]);
  const [sourcesOpen,setSourcesOpen]=useState(false);
  const [startedDownload,setStartedDownload]=useState<string>();
  useEffect(()=>{if(!active)setSourcesOpen(false);},[active]);
  useEffect(()=>setSourcesOpen(false),[profileId]);
  const [modsRoute, setModsRoute] = useState<ModsRoute>({ game: null });
  const [libraryMode, setLibraryMode] = useState<LibraryDestination>("all");
  const [emulationSystem, setEmulationSystem] = useState(0);
  const [data, setData] = useState<GameDiscovery | null>(null);
  const [artwork, setArtwork] = useState<Record<number, GameArtwork>>({});
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [aiSearch, setAiSearch] = useState(false), [searchRun, setSearchRun] = useState(0);
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const [launcherChoice,setLauncherChoice]=useState<LauncherDiscoveryId>("steam");
  const [librarySourceRequest,setLibrarySourceRequest]=useState<{source:UnifiedSource;revision:number}>();
  const launcherInstalls=useMemo(()=>{
    const counts:Partial<Record<LauncherDiscoveryId,number>>={};
    if(library.available&&library.scan&&!library.error)counts.steam=library.scan.games.filter(game=>game.state==="installed").length;
    if(access.launchers.available&&access.launchers.scan&&!access.launchers.error){
      for(const client of access.launchers.scan.clients)counts[client.launcher]=0;
      for(const game of access.launchers.scan.games)if(game.state==="installed")counts[game.launcher]=(counts[game.launcher]??0)+1;
    }
    return counts;
  },[library.available,library.scan,library.error,access.launchers.available,access.launchers.scan,access.launchers.error]);
  const [favoritesFilter, setFavoritesFilter] = useState<GameFavoriteFilter>("all");
  const [favoriteReviews, setFavoriteReviews] = useState<FavoriteReviewFilters>(DEFAULT_FAVORITE_REVIEWS);
  useEffect(()=>setFavoritesFilter("all"),[profileId]);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [selected, setSelected] = useState<GameSummary | null>(null);
  const [collection, setCollection] = useState<GameCollection | null>(null);
  const [recentOpen,setRecentOpen]=useState(false);
  const [atlasRoute, setAtlasRoute] = useState<AtlasRoute | null>(null);
  const [atlasFilters, setAtlasFilters] = useState<AtlasFilters>(DEFAULT_ATLAS_FILTERS);
  const scroll = useRef<HTMLElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const libraryContext = tab === "library" && !collection && !atlasRoute && !recentOpen;
  const [sidebarQuery, setSidebarQuery] = useState("");
  useGameReveal(scroll);
  const openConnectedMedia = openMedia ? (target:GameMediaTarget) => { mediaReturn.current = { top:scroll.current?.scrollTop??0,element:document.activeElement as HTMLElement }; openMedia(target); } : undefined;
  const openConnectedEsports = openEsports ? (match:EsportsMatch) => { mediaReturn.current = { top:scroll.current?.scrollTop??0,element:document.activeElement as HTMLElement }; openEsports(match); } : undefined;
  const openConnectedSports = openSports ? () => { mediaReturn.current = { top:scroll.current?.scrollTop??0,element:document.activeElement as HTMLElement }; openSports(); } : undefined;
  useEffect(()=>{
    if(!active || !mediaReturn.current) return;
    const restore=mediaReturn.current;mediaReturn.current=null;
    let frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{scroll.current?.scrollTo({top:restore.top,behavior:"instant"});if(restore.element?.isConnected)restore.element.focus({preventScroll:true});});});
    return()=>cancelAnimationFrame(frame);
  },[active]);
  const returnStack = useRef<Array<ReturnFocus & { selected: GameSummary | null; collection: GameCollection | null; tab: GameDestination; modsRoute: ModsRoute; libraryMode: typeof libraryMode; query: string; catalogOpen: boolean; aiSearch: boolean; catalogFilters: CatalogFilters; atlasRoute: AtlasRoute | null; atlasFilters: AtlasFilters; recentOpen: boolean }>>([]);
  const pendingRestore = useRef<ReturnFocus | null>(null);
  const pendingHeading = useRef<string | null>(null);
  const searchMode = query.trim().length >= 2;
  const homeActive = active && tab === "explore" && !searchMode && !catalogOpen && !selected && !collection && !atlasRoute && !recentOpen;
  const [exploreVisit, setExploreVisit] = useState(() => createExploreVisit(profileId));
  const previousActive = useRef(active);
  useLayoutEffect(() => {
    // Detail/genre Back is the same visit. Returning from another Harbor section
    // at Explore's root is a new one; linked-media Back keeps its saved position.
    if (exploreVisit.profile !== profileId || (active && !previousActive.current && homeActive && !mediaReturn.current)) setExploreVisit(createExploreVisit(profileId));
    previousActive.current = active;
  }, [active, homeActive, profileId, exploreVisit.profile]);
  const discoveryRefresh = useLiveRefresh(homeActive);

  const previousProfile = useRef(profileId);
  useEffect(() => { if (previousProfile.current === profileId) return; previousProfile.current = profileId; setSelected(null); setCollection(null); setAtlasRoute(null); setRecentOpen(false); setSaveFailed(false); externalReturn.current = false; returnStack.current = []; }, [profileId]);
  useEffect(() => {
    if (!homeActive) return;
    let current = true, received = false;
    setFailed(false);
    void readGameDiscoverySnapshot().then(value => { if (current && !received && value) setData(previous => previous ?? value); });
    void loadGameDiscovery().then(value => { received = true; if (current) setData(value); }, () => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [homeActive, attempt, discoveryRefresh]);
  useEffect(() => {
    if (!active || !data || data.enriched) return;
    let current = true;
    void enrichGameDiscovery(data).then(value => { if (current) setData(value); }, () => {});
    return () => { current = false; };
  }, [active, data?.fetchedAt, data?.enriched, data?.cachedAt]);
  useEffect(() => {
    if (!active || !data) return;
    let current = true;
    void loadGameArtwork(data.shelves.flatMap(shelf => shelf.games.filter(game => !game.portrait).flatMap(game => game.steamId ? [game.steamId] : []))).then(value => { if (current) setArtwork(value); }, () => {});
    return () => { current = false; };
  }, [active, data]);
  const remember = (origin = document.activeElement as HTMLElement) => returnStack.current.push({ top: scroll.current?.scrollTop ?? 0, element: origin, gameId: origin?.dataset.game, label: origin?.getAttribute("aria-label") || origin?.textContent?.trim(), selected, collection, tab, modsRoute, libraryMode, query, catalogOpen, aiSearch, catalogFilters, atlasRoute, atlasFilters, recentOpen });
  const open = (game: GameSummary, origin?: HTMLElement) => { remember(origin); setSelected(game); };
  useEffect(() => {
    access.setActivity({ custom: active && tab === "library", retro: active && tab === "library" });
    return () => access.setActivity({ custom: false, retro: false });
  }, [active, tab, libraryMode, access.setActivity]);
  useLayoutEffect(() => {
    const intent = access.intent;
    if (!active || !intent || access.consumed.current === intent.id) return;
    access.consumed.current = intent.id;
    if (intent.external) { returnStack.current = []; externalReturn.current = true; }
    else remember(intent.origin && scroll.current?.contains(intent.origin) ? intent.origin : scroll.current?.querySelector<HTMLElement>(".games-mast button") ?? undefined);
    setCollection(null); setAtlasRoute(null); setRecentOpen(false);
    if ("game" in intent.target) setSelected(intent.target.game);
    else { setSelected(null); setTab(intent.target.library === "mods" ? "mods" : "library"); setLibraryMode(intent.target.library); if (intent.target.library === "mods") setModsRoute({ game: "minecraft" }); setQuery(""); }
    scroll.current?.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => workspace.current?.querySelector<HTMLElement>(".games-detail h1, .games-library-destinations button[aria-current=page]")?.focus({ preventScroll: true }));
  }, [active, access.intent]);
  const browseRecent = () => { remember(); setSelected(null); setCollection(null); setAtlasRoute(null); setRecentOpen(true); };
  const openCollection = (value: GameCollection) => { remember(); setRecentOpen(false); setCollection(value); };
  const browse = (filters: Partial<CatalogFilters> = {}, term="") => { remember(); setSelected(null); setCollection(null); setAtlasRoute(null); setRecentOpen(false); setTab("explore"); setAiSearch(false); setQuery(term); setCatalogFilters({ ...DEFAULT_CATALOG_FILTERS, ...filters }); setCatalogOpen(true); };
  const browseAtlas = (route: AtlasRoute, origin?: HTMLElement, filters?: AtlasFilters) => { remember(origin); setSelected(null); setCollection(null); setRecentOpen(false); setAtlasRoute(route); setAtlasFilters(filters??{...DEFAULT_ATLAS_FILTERS,...(["greats","coop"].includes(route.kind)?{sort:"rated" as const}:{})}); };
  const launcherLibrary = (source: UnifiedSource | "manual", origin: HTMLElement) => {
    remember(origin);setSelected(null);setCollection(null);setAtlasRoute(null); setRecentOpen(false);setTab("library");setQuery("");
    setLibraryMode(source==="manual"?"custom":"all");
    if(source!=="manual")setLibrarySourceRequest(previous=>({source,revision:(previous?.revision??0)+1}));
    scroll.current?.scrollTo({top:0,behavior:"instant"});
  };
  const emulate = (system: number) => { remember(); setSelected(null); setCollection(null); setAtlasRoute(null); setRecentOpen(false); setTab("library"); setLibraryMode("retro"); setEmulationSystem(system); setQuery(""); scroll.current?.scrollTo(0,0); };
  const back = () => {
    const previous = returnStack.current.pop();
    if (!previous && externalReturn.current && access.leave) { externalReturn.current = false; setSelected(null); setLeavingExternal(true); return; }
    setRecentOpen(previous?.recentOpen??false);
    setLibraryMode(previous?.libraryMode ?? "all");
    setModsRoute(previous?.modsRoute ?? { game: null });
    pendingRestore.current = previous ?? { top: 0, element: null };
    setAiSearch(previous?.aiSearch ?? false);
    setSelected(previous?.selected ?? null); setCollection(previous?.collection ?? null); setTab(previous?.tab ?? "explore"); setQuery(previous?.query ?? ""); setCatalogOpen(previous?.catalogOpen ?? false); setCatalogFilters(previous?.catalogFilters ?? DEFAULT_CATALOG_FILTERS); setAtlasRoute(previous?.atlasRoute ?? null); setAtlasFilters(previous?.atlasFilters ?? DEFAULT_ATLAS_FILTERS);
  };
  useSectionBack(back, active && !leavingExternal && !guidesOpen && (selected !== null || collection !== null || (atlasRoute !== null || recentOpen) || (tab === "explore" && (catalogOpen || searchMode)) || ((tab === "library" || tab === "downloads" || tab === "mods") && returnStack.current.length > 0)));
  useEffect(() => {
    if (!leavingExternal) return;
    setLeavingExternal(false);
    access.leave?.();
  }, [leavingExternal, access.leave]);
  useLayoutEffect(() => {
    const restore = pendingRestore.current;
    pendingHeading.current = null;
    if (restore) {
      pendingRestore.current = null;
      const container = scroll.current;
      if (!container) return;
      let frame = 0;
      let finished = false;
      const findTarget = () => {
        if (restore.element?.isConnected && !restore.element.closest("[hidden]")) return restore.element;
        const root = container.querySelector(selected ? ".games-detail" : atlasRoute ? ".games-atlas-page" : recentOpen ? ".games-recent-page" : collection ? ".games-collection-page" : ".games-browser");
        return [...(root?.querySelectorAll<HTMLElement>("button, a, input") ?? [])].find(el => !el.closest("[hidden]") && (restore.gameId ? el.dataset.game === restore.gameId : restore.label && (el.getAttribute("aria-label") === restore.label || el.textContent?.trim() === restore.label)));
      };
      const stop = () => {
        finished = true; cancelAnimationFrame(frame); observer.disconnect(); clearTimeout(deadline);
        for (const event of ["pointerdown", "wheel", "keydown", "touchstart"]) container.removeEventListener(event, stop);
      };
      const apply = (force = false) => {
        if (finished) return;
        const target = findTarget();
        if (!force && ((restore.gameId || restore.label) && !target || container.scrollHeight - container.clientHeight < restore.top - 2)) return;
        container.scrollTo({ top: restore.top, behavior: "instant" }); target?.focus({ preventScroll: true }); stop();
      };
      const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => apply()); });
      observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "data-game"] });
      const deadline = window.setTimeout(() => apply(true), 3000);
      for (const event of ["pointerdown", "wheel", "keydown", "touchstart"]) container.addEventListener(event, stop, { once: true, passive: true });
      // Retained browse layers can be restored before the first paint.
      apply();
      return stop;
    } else if (selected || collection || catalogOpen || atlasRoute || recentOpen) {
      const container = scroll.current;
      if (!container) return;
      container.scrollTo({ top: 0, behavior: "instant" });
      if (!(selected || collection || atlasRoute || recentOpen) && document.activeElement?.tagName === "INPUT") return;
      pendingHeading.current = selected ? ".games-detail h1" : collection ? ".games-collection-page h1" : atlasRoute ? ".games-atlas-page h1" : recentOpen ? ".games-recent-page h1" : ".games-catalog-heading h2";
    }
  }, [selected, collection, catalogOpen, atlasRoute, recentOpen, tab, libraryMode, modsRoute]);
  useLayoutEffect(() => {
    const container = scroll.current, selector = pendingHeading.current;
    if (!active || !container || !selector) return;
    let finished = false;
    const stop = () => {
      finished = true; observer.disconnect(); clearTimeout(deadline);
      for (const event of ["pointerdown", "wheel", "keydown", "touchstart"]) document.removeEventListener(event, cancel, true);
    };
    const cancel = () => { pendingHeading.current = null; stop(); };
    const focusHeading = () => {
      const heading = container.querySelector<HTMLElement>(selector);
      if (finished || !heading || heading.closest("[hidden], [inert], [data-layer-inactive]") || !heading.getClientRects().length) return;
      heading.focus({ preventScroll: true });
      if (document.activeElement === heading) cancel();
    };
    // Re-arm on return to Games without resetting its retained scroll position.
    const observer = new MutationObserver(focusHeading);
    observer.observe(container, { childList: true, subtree: true });
    const deadline = window.setTimeout(cancel, 10000);
    for (const event of ["pointerdown", "wheel", "keydown", "touchstart"]) document.addEventListener(event, cancel, { once: true, capture: true, passive: true });
    focusHeading();
    return stop;
  }, [active, selected, collection, catalogOpen, atlasRoute, recentOpen, tab, libraryMode, modsRoute]);
  const isSaved = (game: GameSummary) => saved.some(item => item.id === game.id);
  const shelves = data?.shelves.map(shelf => ({ ...shelf, games: shelf.games.map(game => ({ ...game, ...(game.steamId ? artwork[game.steamId] : {}) })) }));
  const shelfGames = (id: string) => shelves?.find(shelf => shelf.id === id)?.games ?? [];
  const catalogVisible = tab === "explore" && (catalogOpen || searchMode);
  const home = tab === "explore" && !catalogVisible;
  const libraryHome = () => { setTab("library"); setSidebarQuery(""); setSelected(null); setCollection(null); setAtlasRoute(null); setRecentOpen(false); setQuery(""); returnStack.current = []; scroll.current?.scrollTo({ top: 0, behavior: "instant" }); };
  const exploreHome = () => { libraryHome(); setExploreVisit(createExploreVisit(profileId)); setTab("explore"); setAiSearch(false); setCatalogOpen(false); requestAnimationFrame(() => scroll.current?.querySelector<HTMLElement>(".games-mast nav button")?.focus({ preventScroll: true })); };

  const openMods = (route: ModsRoute, origin?: HTMLElement) => {
    remember(origin); setSelected(null); setCollection(null); setAtlasRoute(null); setRecentOpen(false); setTab("mods"); setModsRoute(route); setQuery(""); setCatalogOpen(false);
    scroll.current?.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => scroll.current?.querySelector<HTMLElement>(".mods-game-identity h2, .games-navigation-button[aria-current=page]")?.focus({ preventScroll: true }));
  };
  const navigate = (destination: GameDestination) => {
    setSelected(null); setCollection(null); setAtlasRoute(null); setRecentOpen(false);
    if (destination === "mods") { openMods({ game: null }); return; }
    if (destination === "explore") { exploreHome(); return; }
    setTab(destination); setQuery("");
    if (destination === "roms") { setCatalogOpen(false); returnStack.current = []; scroll.current?.scrollTo({ top: 0, behavior: "instant" }); }
  };
  const torrentStarted = (record:Pick<GameTorrent,"id">) => {
    setStartedDownload(record.id);
    if (tab !== "downloads" || selected || collection || atlasRoute) remember();
    setSourcesOpen(false); setSelected(null); setCollection(null); setAtlasRoute(null); setRecentOpen(false);
    setTab("downloads"); setQuery(""); setAiSearch(false); setCatalogOpen(false);
    requestAnimationFrame(() => {
      scroll.current?.scrollTo({ top: 0, behavior: "instant" });
      scroll.current?.querySelector<HTMLElement>('.games-navigation button[aria-current="page"]')?.focus({ preventScroll: true });
    });
  };

  const navigation = (destination: GameDestination, navigationActive: boolean) => <GameNavigation tab={destination} romHacks={destination === "roms" && atlasRoute?.kind === "romhacks"} downloads={downloadSetupSummary([...downloads.records.map(record => ({ kind: "direct" as const, record })), ...downloads.torrents.records.map(record => ({ kind: "torrent" as const, record }))], item => downloadSetup(item, profileId, setupState.jobs, customLibrary.data.games, setupState.registering, setupState.registrationErrors, archiveState.jobs), archiveState.jobs)} active={navigationActive} navigate={navigate} openConsole={(platform,origin)=>browseAtlas({kind:"platform",id:platform.id,name:platform.name,image:platform.image},origin)} modGame={modsRoute.game} openMods={game => openMods({ game })} openHacks={origin => browseAtlas({ kind: "romhacks", name: t("games.hub.title") }, origin)}/>;

  return <GameAvailabilityScope profile={profileId} library={collectionLibrary} downloads={downloads}><GameSourceLinkScope downloads={downloads} keys={cloudKeys} openDownload={id => torrentStarted({id})} openSettings={openSourceSettings ? () => {setSourcesOpen(false);openSourceSettings();} : undefined} profile={profileId} active={active}><div ref={workspace} className={`games-workspace${libraryContext ? " is-library" : ""}`}>
    <GameLibrarySidebar harborNavigationOpen={harborNavigationOpen} onHarborNavigationChange={onHarborNavigationChange} active={active} destination={tab} query={tab === "library" ? query : sidebarQuery} setQuery={tab === "library" ? setQuery : setSidebarQuery} mode={libraryMode} setMode={value => { if (value === "mods") { openMods({ game: "minecraft" }); return; } libraryHome(); setLibraryMode(value); }} selected={selected?.id} open={open} home={libraryHome} explore={exploreHome}/>
    <main className="games-view" ref={scroll} aria-label={t("nav.games")}>
    {/* Keep each browse layer mounted so Back restores its exact card and scroll position. */}
    <div key={"games-browser-v2:" + profileId} className={`games-browser${home ? " games-browser-home" : ""}${tab === "roms" ? " games-browser-roms" : ""}${tab === "mods" ? " games-browser-mods" : ""}`} hidden={selected !== null || collection !== null || (atlasRoute !== null || recentOpen)}>
      <header className="games-mast games-inset">
        <div className="games-mast-title"><h1 tabIndex={-1}>{t("nav.games")}</h1></div>
        {navigation(tab, active && !selected && !collection && !atlasRoute && !recentOpen)}
        {tab === "explore" ? <GameSearchControl key={profileId} profile={profileId} query={query} change={value => { if (value.trim().length >= 2) setCatalogOpen(true); setQuery(value); }} expanded={catalogVisible} ai={aiSearch} setAi={value => { setAiSearch(value); setCatalogOpen(true); }} submit={() => { setCatalogOpen(true); setSearchRun(value => value + 1); }}/> : <div className="games-search"><Search size={17} /><input aria-label={t(tab === "mods" ? "games.modHub.search" : tab === "roms" ? "games.roms.search" : tab === "downloads" ? "games.download.search" : tab === "library" ? libraryMode === "mods" ? "games.mods.search" : "games.library.search" : "games.search")} placeholder={t(tab === "mods" ? "games.modHub.search" : tab === "roms" ? "games.roms.search" : tab === "downloads" ? "games.download.search" : tab === "library" ? libraryMode === "mods" ? "games.mods.search" : "games.library.search" : "games.search")} value={query} onChange={event => setQuery(event.target.value)} />{query && <button className="games-icon-button" aria-label={t("games.clear")} onClick={() => setQuery("")}><X size={16} /></button>}</div>}
        <GameSteamStatus active={active && !selected && !collection && !atlasRoute && !recentOpen}/>
      </header>
      {home ? <>
        <GameShowcase key={exploreVisit.id} visit={exploreVisit} active={homeActive} open={open} save={save} isSaved={isSaved} browse={browse} />
        <GamePageRows page="games-explore" active={homeActive} inset intro={hidden => <GameExploreShortcuts scrollRef={scroll} hiddenRows={hidden}/>} >
          <GamePageRow id="picker" title={t("games.pick.title")}>{homeActive&&<GameDiscoveryPicker key={"discovery-picker:" + profileId} profile={profileId} saved={saved} installed={library.scan?.games??[]} emulation={emulation.data} libraryContext={{steam:steamAccount.status.connected?steamAccount.status.snapshot:null,custom:customLibrary.data.games,launchers:access.launchers.scan}} active={homeActive} open={open}/>}</GamePageRow>
          <GamePageRow id="recent" title={t("games.recent.title")}><GameRecentSources key={"recent-sources:" + profileId} sources={sources} downloads={downloads} active={homeActive} manage={()=>setSourcesOpen(true)} open={open} browse={browseRecent}/></GamePageRow>
          <GamePageRow id="favorites" title={t("games.editorial.favorites")}><GameHighlights visit={exploreVisit.id} active={homeActive} open={open} browse={browse} filter={favoritesFilter} setFilter={setFavoritesFilter} reviews={favoriteReviews} setReviews={setFavoriteReviews}/></GamePageRow>
          <GamePageRow id="greats" title={t("games.collectionsLive.greats")}><GameDiscoveryCollection visit={exploreVisit.id} kind="greats" active={homeActive} open={open} browse={(route,filters)=>browseAtlas(route,undefined,filters)}/></GamePageRow>
          <GamePageRow id="season" title={t(gameSeason() === "halloween" ? "games.discovery.spooktober" : `games.season.${gameSeason()}.title`)}><GameSeasonal active={homeActive} open={open} browse={browse}/></GamePageRow>
          <GamePageRow id="recommendations" title={t("games.recommend.title")}><GameRecommendations key={"recommendations:" + profileId} profile={profileId} saved={saved} installed={library.scan?.games??[]} emulation={emulation.data} libraryContext={{steam:steamAccount.status.connected?steamAccount.status.snapshot:null,custom:customLibrary.data.games,launchers:access.launchers.scan}} active={homeActive} open={open} save={save} browse={()=>browse()}/></GamePageRow>
          <GamePageRow id="collections" title={t("games.discovery.collections")}><GameCollections open={openCollection} active={homeActive}/></GamePageRow>
          <GamePageRow id="worlds" title={t("games.discovery.worldsTitle")}><GameFranchiseWorlds active={homeActive} open={open} browse={browseAtlas}/></GamePageRow>
          <GamePageRow id="story" title={t("games.editorial.connected")}><GameStoryFeature active={homeActive} openMedia={openConnectedMedia}/></GamePageRow>
          <GamePageRow id="releases" title={t("games.new_releases")}><NewReleases active={homeActive} games={shelfGames("new_releases")} open={open} /></GamePageRow>
          <GamePageRow id="sales" title={t("games.discovery.sale.title")}><GameSteamSale active={homeActive}/></GamePageRow>
          <GamePageRow id="studios" title={t("games.studios.title")}><GameStudios active={homeActive} open={open} browse={browseAtlas}/></GamePageRow>
          <GamePageRow id="coop" title={t("games.collectionsLive.coop")}><GameDiscoveryCollection visit={exploreVisit.id} kind="coop" active={homeActive} open={open} browse={(route,filters)=>browseAtlas(route,undefined,filters)}/></GamePageRow>
          <GamePageRow id="records" title={t("games.collectionsLive.records")}><GameMilestones active={homeActive} open={open}/></GamePageRow>
          <GamePageRow id="platforms" title={t("games.editorial.consoleTitle")}><GamePlatforms browse={browseAtlas} /></GamePageRow>
          <GamePageRow id="rom-hacks" title={t("games.romShowcase.title")}><GameRomShowcase active={homeActive} open={open} browse={browseAtlas}/></GamePageRow>
          <GamePageRow id="launchers" title={t("games.launchers.explore")}><GameLaunchers active={homeActive} selected={launcherChoice} select={setLauncherChoice} open={open} installed={launcherInstalls} library={launcherLibrary}/></GamePageRow>
          <GamePageRow id="upcoming" title={t("games.coming_soon")}><GameUpcoming active={homeActive} games={shelfGames("coming_soon")} open={open} /></GamePageRow>
          <GamePageRow id="players" title={t("games.discovery.activeTitle")}><GameActivePlayers active={homeActive} open={open} search={name=>browse({},name)}/></GamePageRow>
          <GamePageRow id="news" title={t("games.feed.title")}><GameNewsFeed active={homeActive} open={open}/></GamePageRow>
          <GamePageRow id="tournaments" title={t("games.tournaments.title")}><GameMajorTournaments active={homeActive}/></GamePageRow>
          <GamePageRow id="esports" title={t("games.discovery.esportsTitle")}><GameEsports active={homeActive} openEsports={openConnectedEsports} openSports={openConnectedSports}/></GamePageRow>
          <GamePageRow id="charts" title={t("games.charts.title")}><DiscoveryDesk open={open} active={homeActive} /></GamePageRow>
        </GamePageRows>
        {failed && !data && <div className="games-state" role="alert"><h2>{t("games.loadError")}</h2><p>{t("games.retryNote")}</p><button className="games-button" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></div>}
        {data?.cachedAt !== undefined && <div className="games-inset"><GameDataStatus at={data.cachedAt} refresh={() => setAttempt(value => value + 1)} /></div>}
        {data && <footer className="games-source-note games-inset"><GamesIcon size={21} /><span>{t("games.storeSource")}<small>{t("games.updatedAt")} {new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></span></footer>}
      </> : tab === "saved" && <GameSavedWatchlist key={profileId} games={saved} query={query} active={active&&!selected&&!collection&&!atlasRoute && !recentOpen} open={open} save={save} sources={sources.sources}/>}
      <div hidden={tab !== "mods"}><GameVisited active={active && tab === "mods" && !selected && !collection && !atlasRoute && !recentOpen}><ModsWorkspace key={profileId} route={modsRoute} active={active && tab === "mods" && !selected && !collection && !atlasRoute && !recentOpen} profile={profileId} query={query} navigate={openMods} installations={simsInstallations(library.scan?.games ?? [], access.launchers.scan?.games ?? [], customLibrary.data.games)}/></GameVisited></div>
      {tab==="downloads"&&<GameDownloads archiveState={archiveState} sourceArtwork={sources.sources} setupState={setupState} customLibrary={customLibrary} revealId={startedDownload} cloudKeys={cloudKeys} openSourceSettings={openSourceSettings} downloads={downloads} query={query} active={active && !selected && !collection && !atlasRoute && !recentOpen} manageSources={()=>setSourcesOpen(true)} openLibrary={()=>{setTab("library");setLibraryMode("custom");setQuery("");scroll.current?.scrollTo(0,0);requestAnimationFrame(()=>scroll.current?.querySelector<HTMLElement>('.games-library-switch button[aria-pressed="true"]')?.focus({preventScroll:true}));}}/>}
      <div hidden={tab !== "roms"}><GameVisited active={active && !selected && !collection && !atlasRoute && !recentOpen && (tab === "roms")}><GameRoms key={profileId} active={active && tab === "roms" && !selected && !collection && !atlasRoute && !recentOpen} query={tab === "roms" ? query : ""} clearQuery={() => setQuery("")} open={open} hacks={(route, platform) => { browseAtlas(route); setAtlasFilters({ ...DEFAULT_ATLAS_FILTERS, platform }); }} emulate={emulate}/></GameVisited></div>
      <div hidden={!catalogVisible}><GameVisited active={active && !selected && !collection && !atlasRoute && !recentOpen && (catalogVisible)}><GameCatalog profile={profileId} query={query} filters={catalogFilters} setFilters={setCatalogFilters} active={active && catalogVisible && !selected && !collection && !atlasRoute && !recentOpen} open={open} back={back} shellBackAvailable={shellBackAvailable} aiMode={aiSearch} runSignal={searchRun}/></GameVisited></div>
      <div hidden={tab !== "library"}><div className="games-library-switch games-inset" aria-label={t("games.emulation.librarySource")}><button aria-pressed={libraryMode === "all"} onClick={() => setLibraryMode("all")}>{t("games.sidebar.allGames")}</button><button aria-pressed={libraryMode === "steam"} onClick={() => setLibraryMode("steam")}>Steam</button><button aria-pressed={libraryMode === "custom"} onClick={()=>setLibraryMode("custom")}>{t("games.custom.nav")}</button><button aria-pressed={libraryMode === "retro"} onClick={() => setLibraryMode("retro")}>{t("games.emulation.library")}</button><button aria-pressed={libraryMode === "mods"} onClick={()=>openMods({ game: "minecraft" })}>{t("games.mods.nav")}</button><button aria-pressed={libraryMode === "collections"} onClick={()=>setLibraryMode("collections")}>{t("games.collections.title")}</button></div><div hidden={libraryMode !== "all"}><GameVisited active={active && !selected && !collection && !atlasRoute && !recentOpen && (tab === "library" && libraryMode === "all")}><GameUnifiedLibrary requestedSource={librarySourceRequest} collect={setCollectGame} account={steamAccount} query={query} active={active && tab === "library" && libraryMode === "all" && !selected && !collection && !atlasRoute && !recentOpen} open={open} manage={(mode,term="")=>{remember();setLibraryMode(mode);setQuery(term);scroll.current?.scrollTo({top:0,behavior:"instant"});}}/></GameVisited></div><div hidden={libraryMode !== "steam"}><GameVisited active={active && !selected && !collection && !atlasRoute && !recentOpen && (tab === "library" && libraryMode === "steam")}><GameLibrary steamImports={access.steamImports} shortcuts={access.shortcuts} openShortcut={access.openShortcut} collect={setCollectGame} preferences={libraryPreferences} account={steamAccount} library={library} query={tab === "library" ? query : ""} active={active && tab === "library" && libraryMode === "steam" && !selected && !collection && !atlasRoute && !recentOpen} open={open} /></GameVisited></div><div hidden={libraryMode!=="custom"}><GameVisited active={active && !selected && !collection && !atlasRoute && !recentOpen && (tab === "library" && libraryMode === "custom")}><GameCustomLibrary collect={setCollectGame} library={customLibrary} query={query} active={active && tab==="library" && libraryMode==="custom" && !selected && !collection && !atlasRoute && !recentOpen} open={open}/></GameVisited></div><div hidden={libraryMode!=="collections"}><GameVisited active={active && !selected && !collection && !atlasRoute && !recentOpen && (tab === "library" && libraryMode === "collections")}><GamePersonalCollections key={profileId} onQueryChange={setQuery} unified={collectionLibrary} libraryPending={customLibrary.checking||library.loading||access.launchers.loading||emulation.busy==="scan"} libraryPartial={Object.values(customLibrary.health).some(result=>result.state==="unknown")||!!library.error||!!access.launchers.error||!!library.scan?.warnings.length||!!access.launchers.scan?.warnings.length||emulation.data.folders.some(folder=>folder.unavailable)} library={{customLibrary,emulation,preferences:libraryPreferences,manageRom:emulate}} state={personalCollections} query={query} active={active && tab==="library" && libraryMode==="collections" && !selected && !collection && !atlasRoute && !recentOpen && !collectGame} open={open} addGames={()=>browse()}/></GameVisited></div>{libraryMode === "retro" && <GameEmulation collect={setCollectGame} active={active && tab === "library" && !selected && !collection && !atlasRoute && !recentOpen} preferences={libraryPreferences} open={open} library={emulation} systemId={emulationSystem} setSystem={setEmulationSystem} query={query} changeQuery={setQuery} />}</div>
    </div>
    <div hidden={!recentOpen || selected !== null || collection !== null || atlasRoute !== null}><GameVisited active={recentOpen}><GameRecentSources key={"recent-page:"+profileId} full sources={sources} downloads={downloads} active={active&&recentOpen&&!selected} manage={()=>setSourcesOpen(true)} open={open} back={back} shellBackAvailable={shellBackAvailable}/></GameVisited></div>
    {collection && <div hidden={selected !== null}><GameCollectionPage key={collection.id} collection={collection} open={open} back={back} active={active && !selected} shellBackAvailable={shellBackAvailable} profile={profileId} /></div>}
    {atlasRoute && <div className={["hacks","romhacks"].includes(atlasRoute.kind) ? "games-hack-browser" : undefined} hidden={selected !== null}>{["hacks","romhacks"].includes(atlasRoute.kind) && <GameHackMast navigation={navigation("roms",active&&!selected)} query={atlasFilters.query} change={query=>setAtlasFilters({...atlasFilters,query})}/>}<GameAtlasPage consoleMenu={navigation("roms",active&&!selected)} openMedia={openConnectedMedia} route={atlasRoute} filters={atlasFilters} setFilters={setAtlasFilters} browse={browseAtlas} open={open} back={back} active={active && !selected} emulate={emulate} shellBackAvailable={shellBackAvailable} /></div>}
    {selected && <GameGuidesScope onOpenChange={setGuidesOpen} key={selected.id} active={active} shellBackAvailable={shellBackAvailable}>{(onGuides, detailActive) => <GameDetailPage openMods={game => openMods({ game })} onGuides={onGuides} shellBackAvailable={shellBackAvailable} account={steamAccount} key={selected.id} game={selected} saved={isSaved(selected)} onSave={save} onBack={back} active={detailActive} library={library} localLibrary={emulation} onEmulate={emulate} onBrowse={browse} onAtlas={browseAtlas} open={open} sources={sources} downloads={downloads} manageSources={()=>setSourcesOpen(true)} openMedia={openConnectedMedia} collect={setCollectGame} profile={profileId} customLibrary={customLibrary} />}</GameGuidesScope>}
    {collectGame && <GameCollectionPicker game={collectGame} state={personalCollections} onClose={()=>setCollectGame(null)}/> }
    {active && libraryPreferences.editing && <GameLibraryPreferenceDialog key={libraryPreferences.editing.id} preferences={libraryPreferences}/>}
    {sourcesOpen && <GameSourcesModal key={customLibrary.profile} customLibrary={customLibrary} sources={sources} downloads={downloads} onClose={()=>setSourcesOpen(false)}/>}
    {active && downloads.torrents.draft !== null && <GameTorrentDialog torrents={downloads.torrents} source={downloads.torrents.draft} onClose={downloads.torrents.close} onStarted={torrentStarted}/>}
    {library.launchError && <div className="games-save-error" role="alert">{t("games.library.launchError")}<button onClick={library.dismissLaunchError} aria-label={t("common.close")}><X size={16} /></button></div>}
    {saveFailed && <div className="games-save-error" role="alert">{t("games.saveError")}<button onClick={() => setSaveFailed(false)} aria-label={t("common.close")}><X size={16} /></button></div>}
    {(homeActive || (active && !selected && !collection && !atlasRoute && !recentOpen && tab === "library" && libraryMode === "retro") || (active && !selected && !!atlasRoute && ["hacks","romhacks"].includes(atlasRoute.kind)))&&<BackToTop scrollRef={scroll} onReturnToTop={()=>scroll.current?.querySelector<HTMLElement>(atlasRoute&&["hacks","romhacks"].includes(atlasRoute.kind)?'.games-hack-mast h1':'.games-mast h1')?.focus({preventScroll:true})}/>}
  </main></div></GameSourceLinkScope></GameAvailabilityScope>;
}


