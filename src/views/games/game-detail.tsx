import { officialStoreOffers } from "@/lib/games/official-stores";
import { MODS_UI_ENABLED } from "@/lib/games/mods-availability";
import { GameNotesButton } from "./game-notes-launcher";
import { libraryBackground } from "@/lib/games/imported-artwork";
import { metadataMatchTarget } from "@/lib/games/library-metadata";
import { useSettings } from "@/lib/settings";
import { chooseAgeRatings } from "@/lib/games/age-ratings";
import { launcherSessionBusy, launcherSessionLabel } from "@/lib/games/launcher-sessions";
import type { ModGameId } from "@/lib/games/mod-workspace";
import { ModsIcon } from "./mod-workspace-parts";
import { Play } from "@/components/icons/play-filled";
import { pokemonEdition } from "@/lib/games/pokemon-games";
import { GameWarhammerEntry } from "./game-warhammer-entry";
import { isWarhammerGame } from "@/lib/games/warhammer-universe-data";
import { launcherSceneArtwork, launcherTitleLogo } from "@/lib/games/launcher-title-art";
import { isValorant } from "@/lib/games/valorant-data";
import { isFfxiv } from "@/lib/games/ffxiv-data";
import { isOsrs } from "@/lib/games/osrs-data";
import { isEve } from "@/lib/games/eve-data";
import { isTft } from "@/lib/games/tft-data";
import { isTarkov } from "@/lib/games/tarkov-data";
import { isSims4 } from "@/lib/games/sims";
import { isStardew } from "@/lib/games/stardew";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Bookmark, Check, FolderPlus, History, Download, Building2, Shapes, Languages, BookOpen } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadGameDetail, readGameDetailSnapshot } from "@/lib/games/catalog";
import { GameDataStatus } from "./game-data-status";
import { useLiveRefresh } from "./use-live-refresh";
import type { GameDetail, GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GameHeroLogo } from "./game-hero-logo";
import { GameMediaGallery } from "./game-media-gallery";
import { GameLaunchButton } from "./game-library";
import type { SteamLibraryState } from "@/hooks/use-steam-library";
import { GAME_TAGS, type CatalogFilters } from "@/lib/games/catalog-filters";
import { loadAtlasGame, readAtlasGameSnapshot } from "@/lib/games/atlas";
import { ROM_HACK_PLATFORMS, type AtlasGame, type AtlasRoute } from "@/lib/games/igdb-data";
import { GamePatchLauncher } from "./game-patch";
import { GameConnections } from "./game-connections";
import { GameLocalPlay } from "./game-local-play";
import type { EmulationLibrary } from "@/hooks/use-emulation-library";
import type { GameSources } from "@/hooks/use-game-sources";
import type { GameTransfers } from "@/hooks/use-game-transfers";
import { hackRelease } from "@/lib/games/hack-catalog";
import { GameHackFiles } from "./game-hack-files";
import { GameSourceSection } from "./game-sources";
import { GameSourceAlert } from "./game-source-alert";
import { GameCrossMedia } from "./game-cross-media";
import type { GameMediaTarget } from "@/lib/games/cross-media";
import { GameSaveModal } from "./game-saves";
import { GameCustomInstalledStatus, GameCustomPlay } from "./game-custom-library";
import { matchingCustomGames } from "@/lib/games/custom-library";
import type { CustomGameLibrary } from "@/hooks/use-custom-game-library";
import { GameReviews, GameUpdates } from "./game-community";
import type { SteamAccount } from "@/hooks/use-steam-account";
import { GameSteamAchievementButton } from "./game-steam-account";
import { loadDetailExtras } from "@/lib/games/detail-extras";
import type { GameDetailExtras } from "@/lib/games/detail-extras-data";
import { DetailAchievements, DetailCompatibility, DetailLanguages, DetailReviewRatings, DetailPlayerActivity, DetailRating, DetailRequirements, GameInstalledStatus } from "./game-detail-information";
import { GameAntiCheatDetails } from "./game-anti-cheat";
import "./game-detail-refinement.css";
import "./game-detail-hero.css";
import { GameDetailFlow, GameDetailFlowSections } from "./game-detail-flow";
import { GameDetailStudio } from "./game-detail-studio";
import { detailStudioCompany } from "@/lib/games/studio-row";
import { GameLiveBroadcast } from "./game-broadcast";
import { SteamMark } from "./game-detail-marks";
import { combineGameRatings } from "@/lib/games/rating-data";
import { GamePublisherAbout } from "./game-publisher-about";
import { GameSpeedruns } from "./game-speedruns";
import { GameCompletionTime } from "./game-completion-times";
import { DetailLoading } from "./game-detail-loading";
import { DetailDisclosure, DetailExpansion } from "./game-detail-disclosure";
import { GameKeyPrices } from "./game-key-prices";
import { GameLinks } from "./game-library-links";

import { DEADLOCK_STEAM_ID } from "@/lib/games/deadlock-data";
import { canLaunchGame, findLauncherInstall, isRetailWow, LAUNCHER_NAMES } from "@/lib/games/launchers";




import { DARKTIDE_STEAM_ID } from "@/lib/games/darktide-data";

import { RIVALS_STEAM_ID } from "@/lib/games/rivals-data";

import { WARFRAME_STEAM_ID } from "@/lib/games/warframe-data";
import { GW2_STEAM_ID } from "@/lib/games/guild-wars2-data";


import { DOTA_STEAM_ID } from "@/lib/games/dota-data";
import { isOverwatch } from "@/lib/games/overwatch-data";
import { isLeague } from "@/lib/games/league-data";
import { officialGameDownload } from "@/lib/games/official-download";
import { wowClassicEdition } from "@/lib/games/wow-classic";
import { WOW_CLASSIC_ART, WOW_RETAIL_ART } from "@/lib/games/wow-art";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { useGameAccess } from "./game-access";
import { detailEditionTarget, resolveDetailEdition } from "@/lib/games/detail-edition";
import { romGameArtwork } from "@/lib/games/rom-editorial";
import { GameReleaseDetails } from "./game-release-details";

import type { GuideGame } from "./game-guides";
import { useGuideAvailability } from "./use-guide-availability";

import { deferredGameView } from "./game-deferred";

const GamePokemonCompanion = deferredGameView(async () => ({ default: (await import("./game-pokemon-companion")).GamePokemonCompanion }));
const GameDeadlockCompanion = deferredGameView(async () => ({ default: (await import("./game-deadlock-companion")).GameDeadlockCompanion }));
const GameWowCompanion = deferredGameView(async () => ({ default: (await import("./game-wow-companion")).GameWowCompanion }));
const GameWowClassicCompanion = deferredGameView(async () => ({ default: (await import("./game-wow-classic")).GameWowClassicCompanion }));
const GameWowAddons = deferredGameView(async () => ({ default: (await import("./game-wow-addons")).GameWowAddons }));
const GameDarktideCompanion = deferredGameView(async () => ({ default: (await import("./game-darktide-companion")).GameDarktideCompanion }));
const GameRivalsCompanion = deferredGameView(async () => ({ default: (await import("./game-rivals-companion")).GameRivalsCompanion }));
const GameWarframeCompanion = deferredGameView(async () => ({ default: (await import("./game-warframe-companion")).GameWarframeCompanion }));
const GameGuildWars2Companion = deferredGameView(async () => ({ default: (await import("./game-guild-wars2-companion")).GameGuildWars2Companion }));
const GameOverwatchCompanion = deferredGameView(async () => ({ default: (await import("./game-overwatch-companion")).GameOverwatchCompanion }));
const GameDotaCompanion = deferredGameView(async () => ({ default: (await import("./game-dota-companion")).GameDotaCompanion }));
const GameValorantCompanion = deferredGameView(async () => ({ default: (await import("./game-valorant-companion")).GameValorantCompanion }));
const GameLeagueCompanion = deferredGameView(async () => ({ default: (await import("./game-league-companion")).GameLeagueCompanion }));
const GameHelldiversCompanion = deferredGameView(async () => ({ default: (await import("./game-helldivers-companion")).GameHelldiversCompanion }));
const GameFortniteCompanion = deferredGameView(async () => ({ default: (await import("./game-fortnite-companion")).GameFortniteCompanion }));
const GameFfxivCompanion = deferredGameView(async () => ({ default: (await import("./game-ffxiv-companion")).GameFfxivCompanion }));
const GameOsrsCompanion = deferredGameView(async () => ({ default: (await import("./game-osrs-companion")).GameOsrsCompanion }));
const GameEveCompanion = deferredGameView(async () => ({ default: (await import("./game-eve-companion")).GameEveCompanion }));
const GameTftCompanion = deferredGameView(async () => ({ default: (await import("./game-tft-companion")).GameTftCompanion }));
const GameTarkovCompanion = deferredGameView(async () => ({ default: (await import("./game-tarkov-companion")).GameTarkovCompanion }));
const GameStardewCompanion = deferredGameView(async () => ({ default: (await import("./game-stardew-companion")).GameStardewCompanion }));

export function GameDetailPage({ openMods, onGuides, game, saved, onSave, onBack, active, library, localLibrary, onEmulate, onBrowse, onAtlas, open, sources, downloads, manageSources, openMedia, collect, profile, customLibrary, account, shellBackAvailable = false }: {
  game: GameSummary; saved: boolean; onSave: (game: GameSummary) => void; onBack: () => void; active: boolean; library: SteamLibraryState; onBrowse: (filters: Partial<CatalogFilters>) => void; onAtlas: (route: AtlasRoute) => void; open: (game: GameSummary) => void;
  localLibrary:EmulationLibrary; onEmulate:(system:number)=>void;
  sources:GameSources;downloads:GameTransfers;manageSources:()=>void;
  openMedia?:(target:GameMediaTarget)=>void;
  collect:(game:GameSummary)=>void;
  profile:string;
  customLibrary:CustomGameLibrary;
  account:SteamAccount;
  shellBackAvailable?: boolean;
  onGuides?: (game: GuideGame) => void;
  openMods?: (game: ModGameId) => void;
}) {
  const t = useT(), { settings } = useSettings();
  const target = detailEditionTarget(game), steamId = target.steamId;
  const classicEdition = wowClassicEdition(game);
  const { launchers, shortcuts, openShortcut, libraryPreferences: prefs } = useGameAccess();
  const metadataOwner=game.libraryEntryId??game.id, reviewedMetadata=prefs.get(metadataOwner).metadata;
  const metadataTarget=reviewedMetadata?metadataMatchTarget(reviewedMetadata):target;
  const displayName=prefs.title(metadataOwner,game.name);
  const launcherInstall = findLauncherInstall(game, launchers.scan);
  const shortcut=shortcuts.games.find(item=>item.id===target.id);
  const officialDownload = officialGameDownload(target);
  const sourceSection = useRef<HTMLDivElement>(null);
  // Explore already carries the loaded detail. Keep that artwork and copy on entry.
  const [loadedStore, setDetail] = useState<GameDetail | null>(() => "about" in game && "logo" in game ? game as GameDetail : null);
  const [loadedAtlas, setAtlas] = useState<AtlasGame | null>(() => "platformLinks" in game && "description" in game ? game as AtlasGame : null);
  const [atlasFailed, setAtlasFailed] = useState(false);
  const [atlasAttempt, setAtlasAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [extras, setExtras] = useState<GameDetailExtras | null>(null);
  const [extrasFailed, setExtrasFailed] = useState(false);
  const [extrasAttempt, setExtrasAttempt] = useState(0);
  const [backups, setBackups] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [allDetails, setAllDetails] = useState(false), [roomy, setRoomy] = useState(() => window.innerWidth >= 1100 && window.innerHeight >= 850);
  useEffect(() => { const measure = () => setRoomy(window.innerWidth >= 1100 && window.innerHeight >= 850); window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); }, []);
  const revision = useLiveRefresh(active);
  useEffect(() => { if (!active) setBackups(false); }, [active]);
  useEffect(() => {
    setExtras(null); setExtrasFailed(false);
    if (!active || !steamId) return;
    const request = new AbortController();
    void loadDetailExtras(steamId, request.signal).then(value => { if (!request.signal.aborted) setExtras(value); }, () => { if (!request.signal.aborted) setExtrasFailed(true); });
    return () => request.abort();
  }, [steamId, active, extrasAttempt, revision]);
  useEffect(() => {
    if (!active) return;
    let current = true, received = false;
    setDetail(previous => previous?.steamId === steamId ? previous : null); setFailed(false);
    setRefreshing(!!steamId);
    if (steamId) {
      void readGameDetailSnapshot(steamId).then(value => { if (current && !received && value) setDetail(previous => previous ?? value); });
      void loadGameDetail(steamId).then(value => { received = true; if (current) setDetail(value); }, () => { if (current) setFailed(true); }).finally(() => { if (current) setRefreshing(false); });
    }
    return () => { current = false; };
  }, [steamId, attempt, active, revision]);
  useEffect(() => {
    if (!active) return;
    const request = new AbortController(); let received = false;
    setAtlasFailed(false); setAtlas(previous => previous && (metadataTarget.igdbId ? previous.igdbId === metadataTarget.igdbId : previous.steamId === steamId) ? previous : null);
    if (!reviewedMetadata && (classicEdition || game.sourceListing) && !game.igdbId && !steamId) return () => request.abort();
    void readAtlasGameSnapshot(metadataTarget).then(value => { if (value && !received && !request.signal.aborted) setAtlas(previous => previous ?? value); });
    void loadAtlasGame(metadataTarget, request.signal).then(value => { received = true; if (!request.signal.aborted) { setAtlas(value); if (!value && (!steamId || reviewedMetadata)) setAtlasFailed(true); } }, () => { if (!request.signal.aborted) setAtlasFailed(true); });
    return () => request.abort();
  }, [game.id, target.igdbId, target.catalogSteamId, reviewedMetadata?.igdbId, active, atlasAttempt, revision, classicEdition]);
  const { atlas, storeDetail, detail, portableGame, steamLinkId } = resolveDetailEdition(game, loadedStore, loadedAtlas, reviewedMetadata);
  const favorited = !!prefs.get(portableGame.id).pinned;
  const pokemon = pokemonEdition(portableGame.name, atlas?.gameType ?? portableGame.gameType ?? game.gameType);
  const shots = detail?.screenshots ?? [];
  const installed = library.scan?.games.find(item => item.appId === steamId);
  const customCopies = matchingCustomGames(customLibrary.data.games, target);
  const customCopy = customCopies.find(copy => customLibrary.running.some(process => process.id === copy.id)) ?? customCopies[0];
  const owned = steamId && account.status.snapshot?.libraryVisible ? account.status.snapshot.games.find(item => item.appId === steamId) : undefined;
  const installOwned = !customCopy && !!owned && account.available && (!installed || installed.state === "missing");
  const romHack = atlas?.gameType === 5 && atlas.platformLinks.some(platform => (ROM_HACK_PLATFORMS as readonly number[]).includes(platform.id));
  const hackProjectUrl = atlas ? hackRelease(atlas)?.page : undefined;
  const hasGuides = useGuideAvailability(game.name,steamId,active&&!!onGuides,romHack);
  const chosenBackground=prefs.background(metadataOwner,game);
  const nativeBackground=storeDetail?.libraryHero || storeDetail?.hero || launcherInstall?.artwork?.hero || installed?.artwork?.libraryHero || (classicEdition ? WOW_CLASSIC_ART.backdrop : "");
  return <article className="games-detail">
    <section className="games-hero games-detail-hero">
      <GameArt className="games-hero-art" src={libraryBackground(chosenBackground, (reviewedMetadata?detail?.hero||reviewedMetadata.capsule:undefined) || storeDetail?.libraryHero || launcherInstall?.artwork?.hero || launcherSceneArtwork(atlas?.igdbId ?? target.igdbId) || detail?.hero || installed?.artwork?.libraryHero || game.capsule || (classicEdition ? WOW_CLASSIC_ART.backdrop : ""), nativeBackground)} fallback={chosenBackground !== undefined ? nativeBackground : classicEdition ? WOW_CLASSIC_ART.backdrop : shots[0] ?? game.capsule} eager />
      <div className="games-hero-shade" />
      {!shellBackAvailable && <button className="games-back games-button" onClick={onBack}><ArrowLeft size={18} />{t("common.back")}</button>}
      <div className="games-hero-copy">
        <p className="games-eyebrow">{detail?.developers.join(" · ") || game.platforms.join(" · ")}</p>
        {game.sourceListing && <a className="games-text-action" href={game.sourceListing.page} onClick={event => { event.preventDefault(); void openUrl(game.sourceListing!.page); }}>{game.sourceListing.sourceName}<ArrowUpRight size={15}/></a>}
        <div className="games-detail-identity">
          <GameHeroLogo key={game.id} sources={[detail?.logo, !reviewedMetadata?installed?.artwork?.logo:undefined, !reviewedMetadata?launcherInstall?.artwork?.logo:undefined, launcherTitleLogo(atlas?.igdbId ?? target.igdbId), !storeDetail ? romGameArtwork(atlas?.igdbId ?? target.igdbId)?.logo : undefined, classicEdition ? WOW_CLASSIC_ART.logo : isRetailWow(portableGame) ? WOW_RETAIL_ART.logo : undefined]} name={displayName} steamId={reviewedMetadata?undefined:target.steamId} platformIds={atlas?.platformLinks.map(platform=>platform.id) ?? []} alternativeNames={atlas?.alternativeTitles?.map(title=>title.name)} gameType={atlas?.gameType} ready={!!launcherInstall?.artwork?.logo || (target.steamId ? !!storeDetail || failed : !!detail || atlasFailed)} active={active}/>
          <h1 tabIndex={-1}>{displayName}</h1>
        </div>
        <div className="games-detail-summary">{detail ? <p className="games-description">{detail.description}</p> : classicEdition ? <p className="games-description">{t("games.wow.classic.intro")}</p> : failed || atlasFailed ? <p role="status">{t("games.detailError")}</p> : <DetailLoading kind="copy"/>}</div>
        <div className="games-actions games-detail-actions">
          <div className="games-detail-main-actions">
          {shortcut&&<><button className="games-button games-button-primary" disabled={!shortcuts.available||shortcut.state!=="ready"||!!shortcuts.launching} onClick={()=>void shortcuts.launch(shortcut)}><Play size={24}/>{t("games.library.play")}</button><button className="games-button" onClick={event=>openShortcut(shortcut.id,event.currentTarget)}>{t("games.libraryPersonal.customize")}</button></>}
          <GameLocalPlay game={target} library={localLibrary} setup={onEmulate}/>
          <GameCustomPlay game={target} library={customLibrary} showError={false}/>
          {launcherInstall && launchers.scan && canLaunchGame(launcherInstall, launchers.scan) && <button className="games-button games-button-primary" disabled={launchers.launching !== null || launcherSessionBusy(launcherInstall)} onClick={() => void launchers.launch(launcherInstall.id)}>{launcherInstall.launchMode === "client" ? <ArrowUpRight size={19}/> : <Play size={24}/>}{t(launcherSessionBusy(launcherInstall) && launcherSessionLabel(launcherInstall) || (launchers.launching === launcherInstall.id ? "games.library.opening" : launcherInstall.launchMode === "client" ? "games.dock.client" : "games.library.play"), { launcher: LAUNCHER_NAMES[launcherInstall.launcher] })}</button>}
          {installed && !installOwned && <GameLaunchButton game={installed} library={library} />}
          {installOwned && <button className="games-button games-button-primary" disabled={account.installing !== null} onClick={() => void account.install(owned.appId)}><Download size={24}/>{t(account.installing === owned.appId ? "games.library.opening" : "games.account.install")}</button>}
          {romHack ? <><GamePatchLauncher game={{...portableGame,projectUrl:atlas?.projectUrl,parent:atlas?.parent}}/>{hackProjectUrl && <a className="games-button" href={hackProjectUrl} onClick={event=>{event.preventDefault();openUrl(hackProjectUrl);}}>{t("games.hub.project")}<ArrowUpRight size={17}/></a>}</> : !customCopy && !installOwned && installed?.state !== "installed" && !launcherInstall && (officialDownload ? <a className="games-button games-button-primary" href={officialDownload.href} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(officialDownload.href); }}><Download size={22}/>{t("games.official.get", { launcher: officialDownload.launcher })}<ArrowUpRight size={16}/></a> : <button className="games-button games-button-primary" onClick={() => { sourceSection.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); sourceSection.current?.focus({ preventScroll: true }); }}><Download size={19} />{t("games.details.findSources")}</button>)}
          {steamLinkId && <a className="games-detail-steam-action" href={`https://store.steampowered.com/app/${steamLinkId}/`} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(`https://store.steampowered.com/app/${steamLinkId}/`); }}><SteamMark />{t("games.steam")}</a>}
          </div>
          <div className="games-detail-secondary-actions">
            {!romHack && <GameSourceAlert game={portableGame} profile={profile} hasSources={sources.sources.some(source => source.enabled)} compact/>}
            <HoverTooltip label={t(saved ? "games.saved" : "games.save")}><button className="games-detail-icon-action" aria-label={t(saved ? "games.saved" : "games.save")} aria-pressed={saved} onClick={() => onSave(portableGame)}>{saved ? <Check size={27} /> : <Bookmark size={27} />}</button></HoverTooltip>
            <HoverTooltip label={t(favorited ? "games.dock.unfavoriteGame" : "games.dock.favoriteGame", { name: portableGame.name })}><button className="games-detail-icon-action" aria-label={t(favorited ? "games.dock.unfavoriteGame" : "games.dock.favoriteGame", { name: portableGame.name })} aria-pressed={favorited} disabled={prefs.busy} onClick={() => void prefs.update([portableGame.id], { pinned: !favorited })}><MusicGlyph name={favorited ? "heart-filled" : "heart"} size={27}/></button></HoverTooltip>
            <HoverTooltip label={t("games.collections.addTo")}><button className="games-detail-icon-action" aria-label={t("games.collections.addTo")} onClick={()=>collect(portableGame)}><FolderPlus size={27}/></button></HoverTooltip>
            <GameNotesButton profile={prefs.profile} gameId={metadataOwner} name={displayName} active={active} compact/>
            {onGuides && hasGuides && <HoverTooltip label={t("games.guides.short")}><button className="games-detail-icon-action" aria-label={t("games.guides.short")} onClick={() => onGuides({ ...game, steamId, hero: detail?.libraryHero || detail?.hero || game.capsule, logo: detail?.logo })}><BookOpen size={27}/></button></HoverTooltip>}
            <HoverTooltip label={t("games.backups.title")}><button className="games-detail-icon-action" aria-label={t("games.backups.title")} onClick={() => setBackups(true)}><History size={27}/></button></HoverTooltip>
            {steamId && <GameSteamAchievementButton account={account} appId={steamId} active={active} />}
          </div>
          {failed && <button className="games-button" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button>}
        </div>
        {installOwned && account.error && <p className="games-detail-action-error" role="alert">{t(account.error)}</p>}
        {customCopy && customLibrary.error && <p className="games-detail-action-error" role="alert">{t(customLibrary.error)}</p>}
        {customCopy ? <GameCustomInstalledStatus game={customCopy} library={customLibrary}/> : steamId && <GameInstalledStatus library={library} installed={installed} />}
      </div>
    </section>
    {storeDetail?.cachedAt !== undefined && <div className="games-inset"><GameDataStatus at={storeDetail.cachedAt} busy={refreshing} refresh={() => setAttempt(value => value + 1)} /></div>}
    {!storeDetail && atlas?.cachedAt !== undefined && <div className="games-inset"><GameDataStatus at={atlas.cachedAt} refresh={() => setAtlasAttempt(value => value + 1)} /></div>}
    {steamId && <GameLiveBroadcast key={game.id} appId={steamId} active={active} />}
    {!detail && !failed && !atlasFailed && !classicEdition && <DetailLoading kind="page"/>}
    <GameDetailFlow intro={detail && <>
        <GameMediaGallery key={game.id} screenshots={shots} screenshotThumbnails={detail.screenshotThumbnails} trailers={detail.trailers} active={active} suspended={backups || achievementsOpen || pricesOpen}/>
        <section className="games-about" aria-label={t("games.about")}><GamePublisherAbout key={game.id} html={storeDetail?.aboutHtml} text={detail.about || detail.description} expanded={allDetails} onExpandChange={setAllDetails} active={active} suspended={backups || achievementsOpen || pricesOpen}/></section>
      </>} rail={detail && <DetailExpansion.Provider value={{all:allDetails,roomy,scope:game.id}}><aside key={`dossier:${game.id}`} className="games-facts games-detail-dossier" data-expanded={allDetails}>
        <h2>{t("games.details.details")}</h2>
        <div className="games-tags games-detail-genres">{detail.genres.map(genre => { const tag = GAME_TAGS.find(item => item.label.toLowerCase() === genre.toLowerCase()); return tag ? <button key={genre} onClick={() => { const genreLink = atlas?.genres.find(g => g.name === genre); if (!storeDetail && genreLink) onAtlas({ kind: "genre", ...genreLink }); else onBrowse({ tags: [tag.id] }); }}>{genre}<ArrowUpRight size={12} /></button> : <span key={genre}>{genre}</span>; })}</div>
        {steamId && <DetailPlayerActivity key={`activity:${game.id}`} appId={steamId} active={active} />}
        {steamId && <GameKeyPrices key={`prices:${game.id}`} appId={steamId} name={game.name} artwork={storeDetail?.capsule || game.capsule} active={active} onOpenChange={setPricesOpen} steamPrice={storeDetail?.cachedAt === undefined ? storeDetail?.price : undefined}/>}
        <DetailCompatibility platforms={detail.platforms} controller={extras?.controller ?? detail.controller} deck={extras?.deck} appId={steamId} />
        <GameAntiCheatDetails key={`anti-cheat:${game.id}`} appId={steamId} name={game.name} categories={storeDetail?.featureCategories?.map(category => category.id)} active={active}/>
        <DetailDisclosure title={t("games.details.information")} icon={<Building2 size={22}/>}><dl>
          {[["games.release", detail.release], ["games.developer", detail.developers.join(", ")], ["games.publisher", detail.publishers.join(", ")]].filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{t(key!)}</dt><dd>{key === "games.developer" || key === "games.publisher" ? (key === "games.developer" ? detail.developers : detail.publishers).map(name => <button className="games-creator-link" key={name} onClick={() => { const company = (key === "games.developer" ? atlas?.developers : atlas?.publishers)?.find(c => c.name === name); if (!storeDetail && company) onAtlas({ kind: "company", ...company }); else onBrowse(key === "games.developer" ? { developer: name } : { publisher: name }); }}>{name}<ArrowUpRight size={13} /></button>) : value}</dd></div>)}
        </dl></DetailDisclosure>
        {!storeDetail && atlas && <GameReleaseDetails key={game.id} game={atlas}/>}
        <GameLinks key={`links:${game.id}`} game={game} records={[storeDetail,atlas]} preferences={prefs} active={active}/>
        {storeDetail?.achievements ? <DetailAchievements key={`achievements:${game.id}`} appId={storeDetail.steamId} profile={profile} account={account} gameName={game.name} total={storeDetail.achievements} items={storeDetail.achievementHighlights ?? []} active={active} onOpenChange={setAchievementsOpen} /> : null}
        {chooseAgeRatings(atlas?.ageRatings, settings.gameAgeRatingAgency ?? "ESRB", extras?.rating, atlas?.url).map(rating => <DetailRating key={`${rating.agency}:${rating.rating}`} rating={rating} />)}
        {detail.features.length > 0 && <DetailDisclosure title={t("games.features")} icon={<Shapes size={22}/>}><ul className="games-detail-feature-links">{detail.features.map(feature => { const category = storeDetail?.featureCategories?.find(item => item.name === feature), mode = atlas?.modes.find(item => item.name === feature), perspective = atlas?.perspectives.find(item => item.name === feature); return <li key={feature}>{category ? <button onClick={() => onBrowse({ features: [category] })}>{feature}</button> : !storeDetail && (mode || perspective) ? <button onClick={() => onAtlas({ kind: mode ? "mode" : "perspective", ...(mode ?? perspective)! })}>{feature}</button> : <span>{feature}</span>}</li>; })}</ul></DetailDisclosure>}
        {!extras?.languages.length && detail.languages && <DetailDisclosure title={t("games.languages")} icon={<Languages size={22}/>}><p>{detail.languages}</p></DetailDisclosure>}
        <DetailReviewRatings items={combineGameRatings(game, storeDetail, atlas)} />
        <GameCompletionTime gameId={atlas?.igdbId ?? game.igdbId} active={active}/>
        <GameSpeedruns key={`speedruns:${game.id}`} name={game.name} active={active}/>
        {(detail.requirements.minimum || detail.requirements.recommended) && <DetailRequirements key={`requirements:${game.id}`} {...detail.requirements} />}
        {extras?.languages.length ? <DetailLanguages key={`languages:${game.id}`} languages={extras.languages} /> : null}
        <p className="games-provenance">{game.sourceListing?.sourceName || t(storeDetail ? "games.metadataSource" : "games.atlas.source")}</p>
        {extrasFailed && <div className="games-detail-extras-error"><p>{t("games.details.enrichmentError")}</p><button onClick={() => setExtrasAttempt(value => value + 1)}>{t("common.retry")}</button></div>}
        <button className="games-detail-text-button games-dossier-expand" aria-expanded={allDetails} onClick={() => setAllDetails(value => !value)}>{t(allDetails ? "games.details.showLess" : "games.details.showMore")}</button>
      </aside></DetailExpansion.Provider>} continuation={<GameDetailFlowSections>
    {/* Releases always precede every custom section, including while metadata is loading or unavailable. */}
    <div ref={sourceSection} tabIndex={-1} className="games-detail-source-target">{romHack && atlas ? <GameHackFiles game={atlas} active={active} downloads={downloads}/> : <GameSourceSection storeOffers={officialStoreOffers(steamLinkId, atlas?.links, storeDetail?.cachedAt === undefined ? storeDetail?.price : undefined)} game={portableGame} artwork={detail?.hero} logo={detail?.logo} sources={sources} downloads={downloads} manage={manageSources}/>}</div>
    {pokemon && <GamePokemonCompanion key={`pokemon:${profile}:${game.id}`} edition={pokemon} game={portableGame.name} active={active} profile={profile}/>}
    {isWarhammerGame(game, atlas) && <GameWarhammerEntry image={detail?.hero || game.capsule} browse={onAtlas}/>}
    {isRetailWow(game) && <GameWowCompanion key={`${profile}:${game.id}`} active={active} profile={profile}/>}
    {classicEdition && <GameWowClassicCompanion key={`${profile}:${game.id}`} edition={classicEdition} active={active} profile={profile}/>}
    {(isRetailWow(game) || classicEdition) && launcherInstall?.state === "installed" && <GameWowAddons key={`${profile}:${game.id}:${launcherInstall.id}`} profile={profile} id={launcherInstall.id} active={active}/>}
    {steamId === DARKTIDE_STEAM_ID && <GameDarktideCompanion key={`darktide:${game.id}`} active={active} hero={storeDetail?.libraryHero || detail?.hero} logo={detail?.logo}/>}
    {steamId === RIVALS_STEAM_ID && <GameRivalsCompanion key={`rivals:${game.id}`} active={active}/>}
    {steamId === WARFRAME_STEAM_ID && <GameWarframeCompanion key={`warframe:${game.id}`} active={active}/>}
    {steamId === 553850 && <GameHelldiversCompanion key={`helldivers:${game.id}`} active={active} logo={detail?.logo}/>}
    {target.igdbId === 1905 && <GameFortniteCompanion key={`fortnite:${game.id}`} active={active}/>}
    {isFfxiv(target) && <GameFfxivCompanion key={`ffxiv:${profile}:${game.id}`} active={active} profile={profile}/>}
    {isOsrs(target) && <GameOsrsCompanion key={`osrs:${game.id}`} active={active}/>}
    {isEve(target) && <GameEveCompanion key={`eve:${profile}:${game.id}`} active={active} profile={profile}/>}
    {isTft(target) && <GameTftCompanion key={`tft:${profile}:${game.id}`} active={active} profile={profile}/>}
    {isTarkov(target) && <GameTarkovCompanion key={`tarkov:${game.id}`} active={active}/>}
    {MODS_UI_ENABLED && openMods && (isSims4(target) || target.igdbId === 121 || target.igdbId === 135400) && <button className="games-mods-entry" onClick={() => openMods(isSims4(target) ? "sims4" : "minecraft")}><ModsIcon size={32}/><span><strong>{t("games.modHub.entryTitle")}</strong><small>{t("games.modHub.entryNote")}</small></span><ArrowUpRight size={22}/></button>}
    {isStardew(target) && <GameStardewCompanion key={`stardew:${profile}:${game.id}`} active={active} profile={profile} artwork={game.capsule}/>}
    {steamId === GW2_STEAM_ID && <GameGuildWars2Companion key={`gw2:${profile}:${game.id}`} active={active} profile={profile}/>}
    {isOverwatch(target) && <GameOverwatchCompanion key={`overwatch:${game.id}`} active={active}/>}
    {isValorant(game) && <GameValorantCompanion key={`valorant:${profile}:${game.id}`} active={active} onGuides={onGuides ? () => onGuides({ ...game, hero: detail?.hero || game.capsule, logo: detail?.logo }) : undefined}/>}
    {isLeague(target) && <GameLeagueCompanion key={`league:${profile}:${game.id}`} active={active} profile={profile}/>}
    {steamId === DOTA_STEAM_ID && <GameDotaCompanion key={`dota:${game.id}`} active={active}/>}
    {steamId === DEADLOCK_STEAM_ID && <GameDeadlockCompanion key={game.id} active={active} />}
    {atlas && <div className="games-detail-explore"><GameConnections game={atlas} browse={onAtlas} open={open} active={active} openMedia={openMedia}/></div>}
    {storeDetail && atlas?.cachedAt !== undefined && <div className="games-inset"><GameDataStatus at={atlas.cachedAt} refresh={() => setAtlasAttempt(value => value + 1)} /></div>}
    {steamId && <GameReviews key={`reviews:${steamId}`} appId={steamId} active={active} />}
    <GameCrossMedia game={{steamId:steamId,url:atlas?.url}} active={active} open={openMedia}/>
    {atlasFailed && <div className="games-atlas-retry games-inset" role="alert"><p>{t("games.atlas.relationshipError")}</p><button className="games-button" onClick={() => setAtlasAttempt(n => n + 1)}>{t("common.retry")}</button></div>}
    </GameDetailFlowSections>}>
      {steamId && <div className="games-detail-flow-block games-detail-main"><GameUpdates key={`news:${steamId}`} appId={steamId} active={active} screenshots={[...shots, ...(atlas?.screenshots ?? [])]} excludedArtwork={[game.capsule, game.portrait ?? "", storeDetail?.capsule ?? "", storeDetail?.libraryHero ?? "", detail?.hero ?? "", installed?.artwork?.libraryHero ?? ""]} pageSize={4} /></div>}
      <div className="games-detail-flow-block games-detail-main"><GameDetailStudio key={`studio:${game.id}`} game={portableGame} developer={storeDetail?.developers[0]} company={detailStudioCompany(storeDetail?.developers[0], atlas)} active={active} open={open} browse={onBrowse} atlas={onAtlas} /></div>
    </GameDetailFlow>
    {backups && active && <GameSaveModal key={`${profile}:${game.id}`} profile={profile} game={portableGame} onClose={() => setBackups(false)} />}
  </article>;
}
