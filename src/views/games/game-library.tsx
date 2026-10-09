import { Play } from "@/components/icons/play-filled";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, HardDrive, LayoutGrid, List, Monitor, RefreshCw } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { loadGameArtwork, loadGameDetail } from "@/lib/games/catalog";
import { filterInstalled, gameSize, installedSummary, libraryName } from "@/lib/games/installed";
import type { LibrarySort, SteamInstall } from "@/lib/games/installed";
import type { GameArtwork, GameDetail, GameSummary } from "@/lib/games/types";
import type { SteamLibraryState } from "@/hooks/use-steam-library";
import { GameSteamImportedLibrary } from "./game-steam-imported-library";
import type { SteamImportLibrary } from "@/hooks/use-steam-imports";
import { GameArt } from "./game-art";
import { GameSteamShortcuts } from "./game-steam-shortcuts";
import type { SteamShortcutsLibrary } from "@/hooks/use-steam-shortcuts";
import type { SteamAccount } from "@/hooks/use-steam-account";
import { GameSteamAccountControl, GameSteamOwnedLibrary } from "./game-steam-account";
import type { GameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import type { LibraryVisibility } from "@/lib/games/library-preferences";
import { LibraryManageButton, LibraryPin, LibraryPreferenceError, LibraryVisibilityFilter, libraryPreferenceVisible } from "./game-library-personal";

export function GameLaunchButton({ game, library, name = game.name }: { game: SteamInstall; library: SteamLibraryState; name?: string }) {
  const t = useT();
  const busy = library.launching === game.appId;
  const launched = library.launched === game.appId;
  return <button className="games-button games-button-primary games-launch" disabled={library.launching !== null || game.state !== "installed"} onClick={() => void library.launch(game.appId)} aria-label={t("games.library.playGame", { name })}>
    {busy ? <span className="games-launch-dots" aria-hidden="true"><i /><i /><i /></span> : launched ? <Check size={17} /> : <Play size={24} />}
    {t(busy ? "games.library.opening" : launched ? "games.library.opened" : game.state === "installed" ? "games.library.play" : `games.library.${game.state}`)}
  </button>;
}

import { useLibrarySelection, LibrarySelectButton, LibrarySelectionBar, LibrarySelectionMark } from "./game-library-selection";

export function GameLibrary({ library, steamImports, shortcuts, openShortcut, query, active, open, account, preferences, collect }: { library: SteamLibraryState; steamImports?:SteamImportLibrary; shortcuts?: SteamShortcutsLibrary; openShortcut?:(id:string,origin?:HTMLElement)=>void; query: string; active: boolean; open: (game: GameSummary) => void; account: SteamAccount; preferences: GameLibraryPreferences; collect?: (games: GameSummary[]) => void }) {
  const t = useT();
  const [state, setState] = useState("all");
  const [accountView, setAccountView] = useState(false);
  const [drive, setDrive] = useState("all");
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [visibility,setVisibility]=useState<LibraryVisibility>("visible");
  const [limit, setLimit] = useState(36);
  const [art, setArt] = useState<Record<number, GameArtwork>>({});
  const [feature, setFeature] = useState<GameDetail | null>(null);
  const all = library.scan?.games ?? [];
  const title = (game: SteamInstall) => preferences.title(`steam:${game.appId}`,game.name);
  const games = filterInstalled(all, "", state, drive, sort).filter(game=>preferences.matchesTitle(`steam:${game.appId}`,game.name,query)).filter(game=>libraryPreferenceVisible(preferences.data.entries[`steam:${game.appId}`],visibility)).sort((a,b)=>Number(preferences.get(`steam:${b.appId}`).pinned)-Number(preferences.get(`steam:${a.appId}`).pinned) || (sort === "name" ? title(a).localeCompare(title(b)) : 0));
  const visible = games.slice(0, limit);
  const artworkIds = visible.map(game => game.appId).join(",");
  const recent = all.find(game => game.state === "installed" && game.lastPlayed > 0 && !preferences.get(`steam:${game.appId}`).hidden);
  useEffect(() => {
    if (!active || !artworkIds) return;
    let current = true;
    // Fetch only visible groups; installed names and Play are usable before artwork arrives.
    const ids = artworkIds.split(",").map(Number);
    const batches = Array.from({ length: Math.ceil(ids.length / 60) }, (_, i) => ids.slice(i * 60, i * 60 + 60));
    void (async () => { for (const ids of batches) { if (!current) break; try { const value = await loadGameArtwork(ids); if (current) setArt(previous => ({ ...previous, ...value })); } catch { /* Local library stays usable offline. */ } } })();
    return () => { current = false; };
  }, [active, artworkIds]);
  useEffect(() => setLimit(36), [query, state, drive, sort, visibility]);
  useEffect(() => {
    setFeature(null);
    if (!active || !recent) return;
    let current = true;
    void loadGameDetail(recent.appId).then(value => { if (current) setFeature(value); }, () => {});
    return () => { current = false; };
  }, [active, recent?.appId]);
  useEffect(() => { if (drive !== "all" && !library.scan?.libraries.some(item => item.path === drive)) setDrive("all"); }, [drive, library.scan]);
  const asSummary = (game: SteamInstall) => ({ ...installedSummary(game), ...art[game.appId], ...game.artwork });

  const selection = useLibrarySelection({ items: games.map(game => ({ id: `steam:${game.appId}`, name: title(game), ...preferences.get(`steam:${game.appId}`), game: asSummary(game) })), scope: JSON.stringify([preferences.profile, query, state, drive, visibility, accountView]), active: active && !accountView, update: preferences.update, collect });

  if (!library.available) return <section className="games-library-desktop games-inset"><span className="games-library-symbol"><Monitor size={40} strokeWidth={1.3} /></span><span className="games-section-kicker">{t("games.library.yourSpace")}</span><h2>{t("games.library.desktopTitle")}</h2><p>{t("games.library.desktopNote")}</p><div className="games-library-benefits"><span><HardDrive size={18} />{t("games.library.findInstalls")}</span><span><Play size={18} />{t("games.library.launchSteam")}</span></div></section>;
  if (!library.scan && !library.error) return <section className="games-library games-inset" aria-busy="true"><div className="games-library-loading" role="status"><HardDrive size={24} /><span>{t("games.library.scanning")}</span></div><div className="games-library-feature-skeleton" /><div className="games-library-grid">{Array.from({ length: 6 }, (_, i) => <div className="games-library-card-skeleton" key={i} />)}</div></section>;

  return <section className="games-library games-inset">
    <div className="games-section-heading"><div><div className="games-section-kicker">{t("games.library.yourSpace")}</div><h2>{t(accountView && account.status.snapshot ? "games.account.libraryTitle" : "games.library.title")}</h2><p>{t(accountView && account.status.snapshot ? "games.account.libraryNote" : "games.library.note")}</p></div><button className="games-button games-library-refresh" onClick={() => void library.refresh()} disabled={library.loading}><RefreshCw size={16} className={library.loading ? "is-scanning" : ""} />{t(library.loading ? "games.library.scanningShort" : "games.library.refresh")}</button></div>
    <GameSteamAccountControl account={account} active={active} /><LibraryPreferenceError preferences={preferences}/>
    {account.status.snapshot && <div className="games-steam-view-switch"><button aria-pressed={!accountView} onClick={() => setAccountView(false)}>{t("games.account.installedView")}</button><button aria-pressed={accountView} onClick={() => setAccountView(true)}>{t("games.account.ownedView")}</button></div>}
    {accountView && account.status.snapshot ? <GameSteamOwnedLibrary collect={collect} preferences={preferences} account={account} library={library} query={query} active={active} open={open} /> : <>
    {library.error && <div className="games-library-notice" role="alert">{t("games.library.scanError")}<button onClick={() => void library.refresh()}>{t("common.retry")}</button></div>}
    {library.scan && !library.scan.steamFound && <div className="games-state"><HardDrive size={32} /><h3>{t("games.library.noSteam")}</h3><p>{t("games.library.noSteamNote")}</p></div>}
    {recent && !query && state === "all" && drive === "all" && visibility === "visible" && <div className="games-library-feature">
      <GameArt className="games-library-feature-art" src={recent.artwork?.libraryHero ?? feature?.libraryHero ?? feature?.hero ?? asSummary(recent).capsule} fallback={asSummary(recent).capsule} eager /><div className="games-library-feature-shade" />
      <div className="games-library-feature-copy"><span className="games-section-kicker">{t("games.library.recentPick")}</span><h3>{title(recent)}</h3><p><span className="games-installed-dot" />{t("games.library.installed")}<span>·</span>{gameSize(recent.sizeBytes)}</p><div className="games-actions"><GameLaunchButton game={recent} name={title(recent)} library={library} /><button className="games-button games-library-detail" onClick={() => open(asSummary(recent))}>{t("games.library.details")}<ArrowUpRight size={17} /></button></div></div>
    </div>}
    {!!library.scan?.libraries.length && <div className="games-library-drives">{library.scan.libraries.map(item => <button key={item.path} aria-pressed={drive === item.path} onClick={() => setDrive(value => value === item.path ? "all" : item.path)}><HardDrive size={16} /><span>{libraryName(item.path)}</span><small>{item.available ? item.appCount : t("games.library.offline")}</small></button>)}</div>}
    {!!library.scan?.warnings.length && <p className="games-library-warning" role="status">{t("games.library.partialNote")}</p>}
    {(all.length > 0 || (library.scan?.steamFound && !library.error)) && <>
      <div className="games-library-toolbar"><span>{t("games.library.count", { count: games.length })}</span><div className="games-library-filters"><LibrarySelectButton selection={selection} disabled={!preferences.ready || preferences.busy || !games.length}/><LibraryVisibilityFilter value={visibility} setValue={setVisibility}/><Dropdown value={state} onChange={setState} ariaLabel={t("games.library.status")} size="sm" options={[{ value: "all", label: t("games.library.all") }, ...["installed", "updating", "missing"].map(value => ({ value, label: t(`games.library.${value}`) }))]} /><Dropdown value={sort} onChange={value => setSort(value as LibrarySort)} ariaLabel={t("games.library.sort")} size="sm" options={["recent", "name", "size"].map(value => ({ value, label: t(`games.library.sort.${value}`) }))} /><div className="games-library-view"><button className="games-icon-button" aria-label={t("games.library.grid")} aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={17} /></button><button className="games-icon-button" aria-label={t("games.library.list")} aria-pressed={view === "list"} onClick={() => setView("list")}><List size={19} /></button></div></div></div>
      <LibrarySelectionBar selection={selection}/>
      {games.length ? <div className={`games-library-${view}`} data-selection={selection.mode}>{visible.map(game => <article className="games-library-card" key={game.appId} data-installed={game.appId}>
        <button className="games-library-card-art" aria-label={t("games.library.gameDetails", { name: title(game) })} {...selection.props(`steam:${game.appId}`, title(game), () => open(asSummary(game)))}><GameArt src={preferences.cover(`steam:${game.appId}`) ?? (view === "grid" ? asSummary(game).portrait ?? asSummary(game).capsule : asSummary(game).capsule)} fallback={asSummary(game).capsule} /><LibraryPin id={`steam:${game.appId}`} preferences={preferences}/><LibrarySelectionMark selection={selection} id={`steam:${game.appId}`}/><span className="games-library-card-open"><ArrowUpRight size={22} /></span></button>
        <div className="games-library-card-copy"><button {...selection.props(`steam:${game.appId}`, title(game), () => open(asSummary(game)))}>{title(game)}</button><p><span className={game.state === "installed" ? "games-installed-dot" : "games-install-pending"} />{t(`games.library.${game.state}`)}<span>·</span>{gameSize(game.sizeBytes)}</p></div><div className="games-library-card-footer"><GameLaunchButton game={game} name={title(game)} library={library}/><LibraryManageButton preferences={preferences} item={{id:`steam:${game.appId}`,name:title(game),cover:asSummary(game).portrait??asSummary(game).capsule}}/></div>
      </article>)}</div> : <div className="games-state"><HardDrive size={28} /><h3>{t(all.length ? "games.noResults" : "games.library.empty")}</h3><p>{t(all.length ? "games.library.changeFilters" : "games.library.emptyNote")}</p></div>}
      {visible.length < games.length && <button className="games-button games-library-more" onClick={() => setLimit(value => value + 36)}>{t("games.library.showMore")}</button>}
    </>}
    </>}
    {steamImports&&<GameSteamImportedLibrary library={steamImports} preferences={preferences} represented={new Set([...all.map(game=>game.appId),...(account.status.snapshot?.libraryVisible?account.status.snapshot.games.map(game=>game.appId):[])])} query={query} active={active} open={open} collect={collect}/>}
    {shortcuts&&openShortcut&&<GameSteamShortcuts library={shortcuts} preferences={preferences} query={query} open={openShortcut}/>}
  </section>;
}
