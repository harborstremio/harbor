import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Check, Dices, Download, LockKeyhole, RefreshCw, Search, ShieldCheck, Trophy, UserRound, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { useSectionBack } from "@/lib/section-back";
import type { SteamAccount } from "@/hooks/use-steam-account";
import type { SteamLibraryState } from "@/hooks/use-steam-library";
import { filterSteamOwned, pickSteamOwnedGame, steamAccountError, steamOwnedSummary, type OwnedActivity, type OwnedInstallation, type OwnedSort, type SteamAchievements, type SteamOwnedGame } from "@/lib/games/steam-account";
import { loadGameArtwork } from "@/lib/games/catalog";
import type { GameArtwork, GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { LibrarySourceMark } from "./game-library-marks";
import { GameLaunchButton } from "./game-library";
import type { GameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import type { LibraryVisibility } from "@/lib/games/library-preferences";
import { LibraryManageButton, LibraryPin, LibraryVisibilityFilter, libraryPreferenceVisible } from "./game-library-personal";
import "./game-steam-account.css";
import "./game-library-accounts.css";

export function useAccountDialogFocus() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, dialog = root.current;
    dialog?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialog.closest('[role="dialog"]')) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)')].filter(item => item.getClientRects().length);
      if (!items.length) { event.preventDefault(); dialog.focus({ preventScroll: true }); return; }
      if (event.shiftKey && (document.activeElement === items[0] || !dialog.contains(document.activeElement))) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && (document.activeElement === items.at(-1) || !dialog.contains(document.activeElement))) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener("keydown", trap); return () => { document.removeEventListener("keydown", trap); previous?.focus({ preventScroll: true }); };
  }, []);
  return root;
}

export function GameSteamAccountControl({ account, active }: { account: SteamAccount; active: boolean }) {
  const t = useT(), [open, setOpen] = useState(false);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  const snapshot = account.status.snapshot;
  const status = snapshot ? t(account.status.connected ? "games.account.synced" : "games.account.cached", { date: new Date(snapshot.updatedAt * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }) : t("games.account.connectHint");
  return <div className="games-library-account-control">
    <HoverTooltip className="games-library-account-tooltip" label={snapshot ? `Steam · ${snapshot.name}` : t("games.account.connectTitle")} sublabel={status}>
      <button className="games-button games-library-account-button" onClick={() => setOpen(true)}>
        <LibrarySourceMark source="steam" size={22} />
        {snapshot ? <><span className="games-library-account-name">{snapshot.name}</span><span className="games-library-account-action">{t("games.account.manage")}</span></> : t("games.account.connect")}
      </button>
    </HoverTooltip>
    {snapshot && account.status.connected && <HoverTooltip className="games-library-account-refresh" label={t("games.account.refresh")}><button className="games-icon-button" aria-label={t("games.account.refresh")} disabled={account.busy} onClick={() => void account.refresh()}><RefreshCw size={16} className={account.busy ? "is-scanning" : ""} /></button></HoverTooltip>}
    {account.error && <div className="games-account-error" role="alert"><span>{t(account.error)}</span><button className="games-icon-button" aria-label={t("common.close")} onClick={account.dismissError}><X size={15} /></button></div>}
    {open && active && <SteamAccountDialog account={account} close={() => setOpen(false)} />}
  </div>;
}

function SteamAccountDialog({ account, close: onClose }: { account: SteamAccount; close: () => void }) {
  const t = useT(), id = useId(), root = useAccountDialogFocus(), { closing, close } = useModalExit(onClose);
  const [target, setTarget] = useState(account.status.snapshot?.steamId ?? ""), [key, setKey] = useState(""), [remember, setRemember] = useState(account.status.remembered), [removing, setRemoving] = useState(false);
  const dismiss = () => { if (!account.busy) close(); };
  useSectionBack(dismiss, true);
  const submit = async () => { if (await account.connect(target.trim(), key.trim(), remember)) { setKey(""); close(); } };
  return <ModalShell closing={closing} onDismiss={dismiss} width={550} labelledBy={id} backdropClassName="games-account-backdrop"><div className="games-account-dialog" ref={root}>
    <header><div><p className="games-eyebrow">Steam</p><h2 id={id}>{t("games.account.connectTitle")}</h2></div><button className="games-icon-button" aria-label={t("common.close")} disabled={account.busy} onClick={dismiss}><X size={20} /></button></header>
    <div className="games-account-dialog-scroll"><p className="games-account-intro">{t("games.account.intro")}</p>
      {account.status.snapshot && <div className="games-account-current"><UserRound size={20} /><span><strong>{account.status.snapshot.name}</strong><small>{account.status.snapshot.steamId}</small></span><button onClick={() => setRemoving(value => !value)}>{t("games.account.disconnect")}</button></div>}
      {removing && <div className="games-account-remove"><p>{t("games.account.disconnectNote")}</p><button className="games-button" disabled={account.busy} onClick={async () => { if (await account.disconnect()) close(); }}>{t("games.account.confirmDisconnect")}</button></div>}
      <label><span>{t("games.account.profile")}</span><input aria-label={t("games.account.profile")} value={target} onChange={event => setTarget(event.target.value)} placeholder="https://steamcommunity.com/id/…" maxLength={250} autoComplete="off" spellCheck={false} disabled={account.busy} /></label>
      <label><span>{t("games.account.key")}</span><input type="password" aria-label={t("games.account.key")} value={key} onChange={event => setKey(event.target.value)} autoComplete="off" spellCheck={false} maxLength={32} disabled={account.busy} /></label>
      <button className="games-account-key-help" onClick={() => openUrl("https://steamcommunity.com/dev/apikey")}>{t("games.account.getKey")}<ArrowUpRight size={13} /></button>
      <button className="games-account-remember" role="checkbox" aria-checked={remember} disabled={account.busy} onClick={() => setRemember(value => !value)}><span>{remember && <Check size={12} />}</span>{t("games.account.remember")}</button>
      <p className="games-account-privacy"><ShieldCheck size={16} /><span>{t("games.account.privacy")}</span></p>
      <p className="games-account-visibility">{t("games.account.visibilityNote")}</p>
      {account.error && <p className="games-account-error" role="alert">{t(account.error)}</p>}
    </div><footer><span>{t("games.account.localOnly")}</span><button className="games-button games-button-primary" disabled={account.busy || !target.trim() || !/^[a-fA-F0-9]{32}$/.test(key.trim())} onClick={() => void submit()}>{account.busy ? <span className="games-launch-dots"><i /><i /><i /></span> : <LibrarySourceMark source="steam" size={16} />}{t(account.busy ? "games.account.connecting" : "games.account.connect")}</button></footer>
  </div></ModalShell>;
}

import { useLibrarySelection, LibrarySelectButton, LibrarySelectionBar, LibrarySelectionMark } from "./game-library-selection";

export function GameSteamOwnedLibrary({ account, library, query, active, open, preferences, collect }: { account: SteamAccount; library: SteamLibraryState; query: string; active: boolean; open: (game: GameSummary, origin?: HTMLElement) => void; preferences: GameLibraryPreferences; collect?: (games: GameSummary[]) => void }) {
  const t = useT(), [installation, setInstallation] = useState<OwnedInstallation>("all"), [activity, setActivity] = useState<OwnedActivity>("all"), [sort, setSort] = useState<OwnedSort>("recent");
  const [limit, setLimit] = useState(36), [art, setArt] = useState<Record<number, GameArtwork>>({});
  const [visibility,setVisibility]=useState<LibraryVisibility>("visible");
  const controls = useRef<HTMLDivElement>(null), lastPick = useRef<number | undefined>(undefined);
  const snapshot = account.status.snapshot, installs = library.scan?.games ?? [], localKnown = !!library.scan && !library.error;
  const title = (game: SteamOwnedGame) => preferences.title(`steam:${game.appId}`,game.name);
  const games = filterSteamOwned(snapshot?.games ?? [], localKnown ? installs : null, {query:"",installation,activity,sort})
    .filter(game=>preferences.matchesTitle(`steam:${game.appId}`,game.name,query)).filter(game=>libraryPreferenceVisible(preferences.data.entries[`steam:${game.appId}`],visibility))
    .sort((a,b)=>Number(preferences.get(`steam:${b.appId}`).pinned)-Number(preferences.get(`steam:${a.appId}`).pinned) || (sort === "name" ? title(a).localeCompare(title(b)) : 0));
  const shown = games.slice(0, limit), hasFilters = installation !== "all" || activity !== "all" || visibility !== "visible";
  const asSummary = (game: SteamOwnedGame) => ({...steamOwnedSummary(game), ...art[game.appId], ...installs.find(item=>item.appId===game.appId)?.artwork});
  const ids = shown.map(game => game.appId).join(",");
  useEffect(() => setLimit(36), [query, installation, activity, sort, visibility]);
  useEffect(() => { setInstallation("all"); setActivity("all"); setVisibility("visible"); setSort("recent"); setLimit(36); lastPick.current=undefined; }, [preferences.profile,snapshot?.steamId]);
  useEffect(() => { if (!active || !ids) return; let current = true; void loadGameArtwork(ids.split(",").map(Number)).then(value => { if (current) setArt(old => ({ ...old, ...value })); }, () => {}); return () => { current = false; }; }, [active, ids]);
  const selection = useLibrarySelection({ items: games.map(game => ({ id: `steam:${game.appId}`, name: title(game), ...preferences.get(`steam:${game.appId}`), game: asSummary(game) })), scope: JSON.stringify([preferences.profile, snapshot?.steamId, query, installation, activity, visibility]), active, update: preferences.update, collect });
  const clearFilters = () => {
    setInstallation("all"); setActivity("all"); setVisibility("visible");
    requestAnimationFrame(()=>controls.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')?.focus({preventScroll:true}));
  };
  if (!snapshot) return null;
  if (!snapshot.libraryVisible) return <div className="games-account-private"><LockKeyhole size={30} /><h3>{t("games.account.privateTitle")}</h3><p>{t("games.account.privateNote")}</p><button className="games-button" onClick={() => openUrl(`https://steamcommunity.com/profiles/${snapshot.steamId}/edit/settings`)}>{t("games.account.privacySettings")}<ArrowUpRight size={15} /></button></div>;
  return <div className="games-steam-owned">
    <div className="games-owned-toolbar">
      <div className="games-owned-result-line"><span role="status">{t("games.owned.results",{count:games.length.toLocaleString(),total:snapshot.games.length.toLocaleString()})}</span>
        <HoverTooltip label={t("games.owned.pickHint")} side="top"><button className="games-button games-owned-pick" disabled={!games.length || selection.mode} onClick={event=>{
          const game=pickSteamOwnedGame(games,lastPick.current); if(!game)return;
          lastPick.current=game.appId; open(asSummary(game),event.currentTarget);
        }}><Dices size={18}/>{t("games.owned.pick")}</button></HoverTooltip>
      </div>
      <div ref={controls} className="games-library-filters games-owned-filters">
        <LibrarySelectButton selection={selection} disabled={!preferences.ready || preferences.busy || !games.length}/>
        <LibraryVisibilityFilter value={visibility} setValue={setVisibility}/>
        <Dropdown size="sm" ariaLabel={t("games.owned.availability")} value={installation} onChange={value=>setInstallation(value as OwnedInstallation)} options={["all","installed","updating","uninstalled"].map(value=>({value,label:t(value==="all"?"games.owned.allAvailability":`games.owned.${value}`)}))}/>
        <Dropdown size="sm" ariaLabel={t("games.owned.activity")} value={activity} onChange={value=>setActivity(value as OwnedActivity)} options={["all","unplayed","recent","returning"].map(value=>({value,label:t(value==="all"?"games.owned.allActivity":`games.owned.${value}`)}))}/>
        <Dropdown size="sm" ariaLabel={t("games.library.sort")} value={sort} onChange={value=>setSort(value as OwnedSort)} options={["recent","name","time","leastTime"].map(value=>({value,label:t(value==="leastTime"?"games.owned.leastTime":`games.account.sort.${value}`)}))}/>
        {hasFilters&&<button className="games-owned-clear" onClick={clearFilters}><X size={14}/>{t("games.owned.clear")}</button>}
      </div>
    </div>
    {!localKnown&&<div className="games-owned-scan-note" role="status"><p>{t(library.loading?"games.owned.scanning":"games.owned.scanUnavailable")}</p>
      {!library.loading&&<button onClick={()=>void library.refresh()}>{t("games.library.refresh")}</button>}
      {installation!=="all"&&<button onClick={()=>setInstallation("all")}>{t("games.owned.resetAvailability")}</button>}
    </div>}
    {localKnown&&!!library.scan?.warnings.length&&<p className="games-owned-scan-note" role="status">{t("games.owned.partial")}</p>}
    <LibrarySelectionBar selection={selection}/>
    {shown.length ? <div className="games-library-grid" data-selection={selection.mode}>{shown.map(game => {
      const installed = installs.find(item => item.appId === game.appId), summary = asSummary(game);
      return <article className="games-library-card games-owned-card" key={game.appId} data-owned={game.appId}><button className="games-library-card-art" data-portrait={!!(preferences.cover(`steam:${game.appId}`)??summary.portrait)} aria-label={t("games.library.gameDetails", { name: title(game) })} {...selection.props(`steam:${game.appId}`, title(game), () => open(summary))}><GameArt src={preferences.cover(`steam:${game.appId}`) ?? summary.portrait ?? summary.capsule} fallback={summary.capsule} /><LibraryPin id={`steam:${game.appId}`} preferences={preferences}/><LibrarySelectionMark selection={selection} id={`steam:${game.appId}`}/><span className="games-library-card-open"><ArrowUpRight size={22} /></span></button><div className="games-library-card-copy"><button {...selection.props(`steam:${game.appId}`, title(game), () => open(summary))}>{title(game)}</button><p>{game.minutes ? t("games.account.hours", { count: (game.minutes / 60).toLocaleString(undefined, { maximumFractionDigits: 1 }) }) : t("games.account.unplayed")}{installed?.state === "installed" && <><span>·</span><span className="games-installed-dot" />{t("games.library.installed")}</>}</p></div><div className="games-library-card-footer">{installed && installed.state !== "missing" ? <GameLaunchButton game={installed} name={title(game)} library={library} /> : <button className="games-button games-owned-install" disabled={account.installing !== null} onClick={() => void account.install(game.appId)} aria-label={t("games.account.installNamed", { name: title(game) })}><Download size={15} />{t(account.installing === game.appId ? "games.library.opening" : "games.account.install")}</button>}<LibraryManageButton preferences={preferences} item={{id:`steam:${game.appId}`,name:title(game),cover:summary.portrait??summary.capsule}}/></div></article>;
    })}</div> : (localKnown||installation==="all")&&<div className="games-state"><Search size={28} /><h3>{t("games.noResults")}</h3><p>{t(snapshot.games.length ? "games.library.changeFilters" : "games.account.empty")}</p></div>}
    {games.length > limit && <button className="games-button games-library-more" onClick={() => setLimit(value => value + 36)}>{t("games.library.showMore")}</button>}
    <p className="games-provenance">{t("games.account.ownedNote")} {t("games.owned.playtimeNote")}</p>
  </div>;
}

export function GameSteamAchievementButton({ account, appId, active }: { account: SteamAccount; appId: number; active: boolean }) {
  const t = useT(), [open, setOpen] = useState(false);
  useEffect(() => { if (!active || !account.status.connected) setOpen(false); }, [active, account.status.connected]);
  if (!account.status.connected) return null;
  return <><button className="games-button" onClick={() => setOpen(true)}><Trophy size={16} />{t("games.account.achievements")}</button>{open && <SteamAchievementsDialog account={account} appId={appId} close={() => setOpen(false)} />}</>;
}
function SteamAchievementsDialog({ account, appId, close: onClose }: { account: SteamAccount; appId: number; close: () => void }) {
  const t = useT(), id = useId(), root = useAccountDialogFocus(), { closing, close } = useModalExit(onClose);
  const [data, setData] = useState<SteamAchievements | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0), [query, setQuery] = useState(""), [filter, setFilter] = useState("all"), [revealed, setRevealed] = useState(false), [limit, setLimit] = useState(80);
  useEffect(() => { let current = true; setError(null); void account.achievements(appId).then(value => { if (current) setData(value); }, reason => { if (current) setError(steamAccountError(reason)); }); return () => { current = false; }; }, [account.achievements, appId, attempt]);
  useEffect(() => setLimit(80), [query, filter]);
  const secret = (item: NonNullable<typeof data>["items"][number]) => item.hidden && !item.unlocked && !revealed;
  const items = data?.items.filter(item => (filter === "all" || (filter === "unlocked" ? item.unlocked : !item.unlocked)) && (!query.trim() || (!secret(item) && `${item.name} ${item.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))) ?? [];
  const unlocked = data?.items.filter(item => item.unlocked).length ?? 0;
  return <ModalShell closing={closing} onDismiss={close} width={700} labelledBy={id} backdropClassName="games-account-backdrop"><div className="games-account-dialog games-achievements-dialog" ref={root}><header><div><p className="games-eyebrow">{account.status.snapshot?.name}</p><h2 id={id}>{t("games.account.achievements")}</h2></div><button className="games-icon-button" aria-label={t("common.close")} onClick={close}><X size={20} /></button></header>
    {data && <><div className="games-achievement-progress"><strong>{unlocked}<small> / {data.items.length}</small></strong><span>{t("games.account.unlocked")}</span><div><i style={{ width: `${data.items.length ? unlocked * 100 / data.items.length : 0}%` }} /></div></div><div className="games-account-achievement-tools"><label><Search size={16} /><input aria-label={t("games.account.searchAchievements")} placeholder={t("games.account.searchAchievements")} value={query} onChange={event => setQuery(event.target.value)} /></label><Dropdown size="sm" ariaLabel={t("games.account.achievementFilter")} value={filter} onChange={setFilter} options={["all", "unlocked", "locked"].map(value => ({ value, label: t(`games.account.achievementFilter.${value}`) }))} /></div></>}
    <div className="games-account-dialog-scroll">{error ? <div className="games-account-error" role="alert"><p>{t(error)}</p><button className="games-button" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></div> : !data ? <p className="games-account-loading" role="status">{t("common.loading")}</p> : <><ul className="games-account-achievements">{items.slice(0, limit).map(item => <li key={item.id} data-achievement={item.id} className={item.unlocked ? "is-unlocked" : ""}><span className="games-account-achievement-icon">{secret(item) ? <LockKeyhole size={22} /> : <GameArt src={item.unlocked ? item.icon : item.lockedIcon || item.icon} />}</span><div><strong>{secret(item) ? t("games.account.secretAchievement") : item.name}</strong><p>{secret(item) ? t("games.account.secretNote") : item.description}</p>{item.unlocked && item.unlockedAt > 0 && <time>{new Date(item.unlockedAt * 1000).toLocaleDateString()}</time>}</div>{item.unlocked && <Check size={15} />}</li>)}</ul>{!items.length && <p className="games-account-loading">{t(data.items.length ? "games.noResults" : "games.account.noAchievements")}</p>}{items.length > limit && <button className="games-button" onClick={() => setLimit(value => value + 80)}>{t("games.account.moreAchievements")}</button>}</>}
    </div><footer><button className="games-account-reveal" aria-pressed={revealed} onClick={() => setRevealed(value => !value)}>{t(revealed ? "games.account.hideSecrets" : "games.account.revealSecrets")}</button><button className="games-button" onClick={close}>{t("common.close")}</button></footer>
  </div></ModalShell>;
}
