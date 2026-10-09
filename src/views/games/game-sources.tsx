import { GameOfficialStores } from "./game-official-stores";
import type { OfficialStoreOffer } from "@/lib/games/official-stores";
import { GameHydraImport } from './game-hydra-import';
import type { CustomGameLibrary } from '@/hooks/use-custom-game-library';
import { FileUp } from 'lucide-react';
import { GameSiteDownload } from './game-site-download';
import { GameSourceCompatibility } from './game-source-compatibility';
import { SourceVerificationControl } from './game-source-verification';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Copy, Link2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { NavGlyph } from "@/components/icons/nav-glyph";
import { HarborMark } from "@/components/icons/harbor-mark";
import { sourceTransfer } from "@/lib/games/source-transfer-state";
import { uniqueSourceFiles } from "@/lib/games/source-files";
import { SourceTransferStatus } from "./game-source-transfer";
import { GameSourceIcon } from "./game-source-icon";
import { GameSourceContinuation } from "./game-source-continuation";
import { inheritSourceArtwork } from "@/lib/games/source-artwork";
import { officialGameDownload } from "@/lib/games/official-download";
import { GameOfficialDownload } from "./game-official-download";
import { sourceInputUrl } from "@/lib/games/source-discovery";
import { resolveSourceDownloadContext } from "@/lib/games/source-download-context";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { openUrl } from "@/lib/window";
import { sourceMatch, sourceError, sourceEntryCount, sourceFilename, SOURCE_MAX_SUBSCRIPTIONS, type GameSource, type SourceRelease } from "@/lib/games/sources";
import type { SourceInspection } from "@/lib/games/source-fetch";
import { transferBytes, type DownloadGame } from "@/lib/games/transfers";
import { useSourceCatalog } from '@/hooks/use-source-catalog';
import type { GameSources } from "@/hooks/use-game-sources";
import { useSourceWebsite, useWebsiteMatches } from "@/hooks/use-source-website";
import type { GameTransfers } from "@/hooks/use-game-transfers";
import type { GameSummary } from "@/lib/games/types";
import { useSourceLink, useSourceDownload } from "./game-source-links";
import "./game-sources.css";
import { GameSourceAlert } from "./game-source-alert";
import { useSourceAlerts } from "@/hooks/use-source-alerts";
import { useCatalogMatches } from "@/hooks/use-catalog-matches";
import { retainSourceMatchGroups, type SourceMatchGroup } from '@/lib/games/source-groups';
import { GameSourceGroup } from './game-source-group';
import { GameSourceFailures } from './game-source-failures';

export function GameSourceSection({ game, storeOffers = [], artwork, logo, sources, downloads, manage }: { game: GameSummary; storeOffers?: OfficialStoreOffer[]; artwork?: string; logo?: string; sources: GameSources; downloads: GameTransfers; manage: () => void }) {
  const t = useT(), website = useWebsiteMatches(sources, game);
  const alerts = useSourceAlerts(sources.profile), refreshedAlerts = useRef(new Set<string>());
  useEffect(() => {
    if (!sources.ready) return;
    for (const notice of alerts.notices) {
      if (notice.game.id !== game.id || refreshedAlerts.current.has(notice.id)) continue;
      const source = sources.sources.find(item => item.id === notice.sourceId && item.enabled);
      if (!source) continue;
      refreshedAlerts.current.add(notice.id);
      if (source.checkedAt < notice.createdAt) void sources.refresh(source);
    }
  }, [sources.ready, sources.profile, sources.sources, game.id, alerts.notices]);
  const official = officialGameDownload(game);
  const catalog = useCatalogMatches(sources.sources,game);
  const matches = useMemo(() => [...new Map([...catalog.matches, ...website.matches].map(match => [`${match.source.id}:${match.release.id}`, match])).values()], [catalog.matches, website.matches]);
  const browseKey = JSON.stringify([sources.profile, game.id, game.name]);
  const groupingKey = JSON.stringify([browseKey,game.steamId,game.igdbId,game.platforms,game.sourceOrigin]);
  const heldGroups = useMemo(() => ({ value: [] as SourceMatchGroup[] }), [groupingKey]);
  const groups = useMemo(() => heldGroups.value = retainSourceMatchGroups(matches, heldGroups.value), [matches, heldGroups]);
  const [shown, setShown] = useState({ key: browseKey, limit: 8 });
  const limit = shown.key === browseKey ? shown.limit : 8;
  const root = useRef<HTMLElement>(null), focusAfterLoad = useRef<{ key: string; button: HTMLButtonElement; before: Set<string> } | null>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const siteGame = { id: game.id, name: game.name, artwork: artwork || game.capsule, logo };
  const advance = (button: HTMLButtonElement, retry = false) => {
    if (website.loading && (retry || groups.length <= limit)) return;
    focusAfterLoad.current = { key: browseKey, button, before: new Set(groups.slice(0, limit).map(group => group.source.id)) };
    if (retry) void website.retry();
    else {
      setShown({ key: browseKey, limit: limit + 16 });
      if (groups.length <= limit) void website.more();
    }
  };
  useLayoutEffect(() => {
    const pending = focusAfterLoad.current;
    if (!pending || website.loading) return;
    focusAfterLoad.current = null;
    const node = root.current, button = pending.button;
    if (pending.key !== browseKey || !node?.isConnected || !(document.activeElement === button || !button.isConnected && document.activeElement === document.body)) return;
    const rows = [...node.querySelectorAll<HTMLElement>('.games-source-group')];
    const added = rows.find(row => !pending.before.has(row.dataset.releaseKey ?? ""));
    const next = added?.querySelector<HTMLElement>('.games-source-group-heading') ?? node.querySelector<HTMLButtonElement>('.games-source-website-error button') ?? node.querySelector<HTMLButtonElement>('[data-source-more]') ?? rows.at(-1)?.querySelector<HTMLElement>('.games-source-group-heading') ?? node.querySelector<HTMLButtonElement>('button');
    next?.focus({ preventScroll: true });
  }, [browseKey, matches, limit, website.loading, website.failed, website.hasMore]);
  const hasSources = sources.sources.some(source => source.enabled);
  const empty = !official && sources.ready && !sources.loading && !catalog.loading && !catalog.error && !website.loading && !website.failed && !website.hasMore && !matches.length;
  return <section ref={root} className="games-sources-section games-inset">
    <div className="games-section-heading"><div><span className="games-section-kicker">{t("games.sources.eyebrow")}</span><h2>{t("games.sources.releases")}</h2></div>{!empty && <button className="games-button" onClick={manage}><Link2 size={16}/>{t("games.sources.manage")}</button>}</div>
    {siteOpen && <GameSiteDownload downloads={downloads} game={siteGame} onClose={() => setSiteOpen(false)}/>}
    <GameOfficialStores offers={storeOffers}/>
    <GameSourceAlert game={game} profile={sources.profile} hasSources={hasSources}/>
    {official && !storeOffers.some(offer => offer.name === official.launcher) && <GameOfficialDownload source={official}/>}
    {catalog.error && <GameSourceFailures error={catalog.error} failed={catalog.failed} busy={catalog.loading || sources.loading} retry={() => sources.sources.some(item => item.catalogIssue) ? void sources.reload() : catalog.retry()} manage={manage}/>}
    {(sources.loading && !sources.ready) || (catalog.loading && !matches.length) ? <div className="games-source-loading" aria-busy="true" aria-label={t("common.loading")}>{[0,1].map(n => <div key={n} aria-hidden="true"><i className="games-detail-skeleton"/><span className="games-detail-skeleton"/></div>)}</div> : !sources.ready ? <p role="alert">{t(sources.error)}</p> : matches.length ? <><p className="games-source-explainer">{t("games.sources.matchNote")}</p><div className="games-source-releases">{groups.slice(0, limit).map(group => <GameSourceGroup key={`${browseKey}:${group.source.id}`} group={group} render={({source,release,match},single) => <SourceReleaseRow key={`${source.id}:${release.id}`} source={source} release={release} match={match} presentation={single ? "dialog" : "row"} game={sourceMatch(release, game) ? {id:game.id,name:game.name,artwork:artwork||game.capsule,logo,sourceName:source.name} : undefined} downloads={downloads}/>}/>)}</div><div className="games-source-site-action"><button className="games-button" disabled={!downloads.available} onClick={()=>setSiteOpen(true)}><ArrowUpRight size={15}/>{t("games.sources.site.title")}</button></div></> : !catalog.error && !official && !website.loading && !website.failed && (website.hasMore ? <p className="games-source-explainer">{t("games.sources.website.noResults")}</p> : <div className="games-detail-source-empty"><div className="games-source-empty-art" aria-hidden="true"><Link2 size={30}/><span><Plus size={11}/></span></div><div><h3>{t(hasSources ? "games.details.sourcesNoMatch" : "games.details.sourcesEmpty")}</h3><p>{t(hasSources ? "games.sources.noMatch" : "games.details.sourcesEmptyNote")}</p><button className="games-button" onClick={manage}><Plus size={15}/>{t(hasSources ? "games.sources.manage" : "games.sources.add")}</button><button className="games-button" disabled={!downloads.available} onClick={()=>setSiteOpen(true)}><ArrowUpRight size={15}/>{t("games.sources.site.title")}</button></div></div>)}
    {catalog.loading && catalog.total > 0 && <p className="games-source-explainer" role="status" data-source-progress>{t("games.sources.catalogProgress",{checked:catalog.checked,total:catalog.total})}</p>}
    {website.loading && <p className="games-source-explainer" role="status">{t("games.sources.website.checking")}</p>}
    {website.failed && <div className="games-source-website-error" role="alert"><span>{t("games.sources.website.unavailable")}</span><button className="games-button" aria-disabled={website.loading} onClick={event => advance(event.currentTarget, true)}>{t("common.retry")}</button></div>}
    {sources.ready && !sources.loading && (groups.length > limit || matches.length > 0 && website.hasMore) && <button className="games-button" data-source-more aria-disabled={website.loading && groups.length <= limit} onClick={event => advance(event.currentTarget)}>{groups.length > limit ? t("games.sources.more", { count: groups.length - limit }) : t("games.sources.website.more")}</button>}
    {sources.sources.some(s => s.enabled && s.error && !s.catalogIssue) && <p className="games-source-stale" role="status">{t("games.sources.cachedNote")}</p>}
  </section>;
}

function WebsiteSourceBrowse({ source, downloads }: { source: GameSource; downloads: GameTransfers }) {
  const t = useT(), [query, setQuery] = useState("");
  const body = useRef<HTMLElement>(null);
  const focusAfterLoad = useRef<{ button: HTMLButtonElement; before: number; query: string } | null>(null);
  const result = useSourceWebsite(source, query, downloads.profile);
  const advance = (button: HTMLButtonElement, action: () => Promise<boolean>) => {
    if (result.loading) return;
    focusAfterLoad.current = { button, before: result.entries.length, query };
    void action();
  };
  useLayoutEffect(() => {
    const pending = focusAfterLoad.current;
    if (!pending || result.loading) return;
    focusAfterLoad.current = null;
    const { button, before } = pending;
    if (pending.query !== query || !body.current?.isConnected || !(document.activeElement === button || !button.isConnected && document.activeElement === document.body)) return;
    if (result.error) { body.current.querySelector<HTMLButtonElement>('.games-source-website-error button')?.focus({ preventScroll: true }); return; }
    const rows = body.current.querySelectorAll<HTMLElement>('.games-source-release>summary');
    (rows[before] || rows[0] || body.current.querySelector<HTMLInputElement>('input'))?.focus({ preventScroll: true });
  }, [result.loading, result.error, result.entries, query]);
  return <section ref={body} className="games-source-browse games-source-website-browse">
    <div className="games-source-search"><Search size={16}/><input aria-label={t("games.sources.website.search")} placeholder={t("games.sources.website.search")} value={query} maxLength={200} onChange={event => setQuery(event.target.value)}/>{query && <button className="games-icon-button" onClick={() => setQuery("")} aria-label={t("games.clear")}><X size={15}/></button>}</div>
    <p>{t("games.sources.website.results", { count: result.entries.length.toLocaleString() })}</p>
    <div aria-busy={result.loading}>{result.entries.map(release => <SourceReleaseRow key={release.id} source={source} release={release} downloads={downloads}/>)}</div>
    {result.loading && !result.next && <p role="status">{t("games.sources.website.loading")}</p>}
    {result.error && <div className="games-source-website-error" role="alert"><span>{t(result.error)}</span><button className="games-button" onClick={event => advance(event.currentTarget, result.retry)}>{t("common.retry")}</button></div>}
    {!result.loading && !result.error && !result.entries.length && <p>{t("games.sources.website.noResults")}</p>}
    <GameSourceContinuation key={`${source.id}:${query}`} count={result.entries.length} cursor={result.next} more={!!result.next} busy={result.loading} failed={!!result.error} load={result.more} manual={button => advance(button, result.more)}/>
  </section>;
}

export function SourceReleaseRow({ source, release, match, game, downloads, initialOpen = false, presentation = "row", showCompatibility = true }: { showCompatibility?: boolean; presentation?: "row" | "dialog"; initialOpen?: boolean; source: GameSource; release: SourceRelease; match?: "identity" | "title"; game?: DownloadGame; downloads: GameTransfers }) {
  const files = useMemo(() => uniqueSourceFiles(release.files), [release.files]);
  const t = useT(), [feedback, setFeedback] = useState(""), resolveLink = useSourceLink(), openDownload = useSourceDownload();
  const [resolving, setResolving] = useState(false), [resolvingFile, setResolvingFile] = useState("");
  const alive = useRef(true), pending = useRef(false);
  const owner = useRef({ profile: downloads.profile, source: source.id, release });
  owner.current = { profile: downloads.profile, source: source.id, release };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const context = () => resolveSourceDownloadContext(release, source.name, game);
  const withContext = async (file: string, action: (context?: DownloadGame) => void | Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setResolvingFile(file); setResolving(true);
    const before = owner.current;
    const valid = () => alive.current && owner.current.profile === before.profile && owner.current.source === before.source && owner.current.release === before.release;
    try { const metadata = await context(); if (valid()) await action(metadata); }
    finally { pending.current = false; if (alive.current) setResolving(false); }
  };
  const busy = downloads.busy.includes("new");
  const body = <div className="games-source-release-body">{match === "title" && <p>{t("games.sources.titleNote")}</p>}{source.error && <p>{t("games.sources.cachedRelease", {date:new Date(source.checkedAt).toLocaleDateString()})}</p>}
      <div className="games-source-files" aria-busy={resolving}>{files.map(file => { const transfer=sourceTransfer(file,downloads.torrents.records,downloads.records); return <div className="games-source-file" key={file.url} data-resolving={resolving && resolvingFile === file.url || undefined}><div className="games-source-file-identity">{file.kind === "magnet" ? <span className="games-source-art games-source-file-art" aria-hidden="true"><HarborMark/></span> : <GameSourceIcon url={file.url} name={new URL(file.url).hostname} className="games-source-file-art"/>}<div><strong>{file.kind === "magnet" && file.name === "BitTorrent" ? t("games.sources.art.torrent") : file.name}</strong><small>{file.kind === "magnet" ? t("games.sources.art.engine") : presentation === "dialog" && file.name === new URL(file.url).hostname ? "" : new URL(file.url).hostname}{file.sizeBytes && ` · ${transferBytes(file.sizeBytes)}`}{file.sha256 && " · SHA-256"}</small>{showCompatibility && <GameSourceCompatibility release={release} file={file}/>}</div></div>{transfer && <SourceTransferStatus transfer={transfer}/>}{file.kind === "direct" ? <button className="games-button" disabled={!downloads.available || busy || !!transfer && transfer.status!=="failed"} aria-disabled={resolving} title={!downloads.available ? t("games.download.desktopTitle") : undefined} onClick={() => {setFeedback(""); void withContext(file.url, async metadata => {const ok = await downloads.start({url:file.url,name:release.title,expectedBytes:file.sizeBytes,expectedSha256:file.sha256,game:metadata},sourceFilename(file));if(ok && alive.current)setFeedback("games.sources.queued");});}}><NavGlyph name="download" style={{ width: 18, height: 18 }}/>{t("games.sources.download")}</button> : file.kind === "page" ? <div className="games-source-page-actions">{resolveLink && <button className="games-button" aria-disabled={resolving} disabled={!transfer && busy} onClick={() => { if (resolving) return; if (transfer && openDownload) openDownload(transfer.id); else void withContext(file.url, metadata => resolveLink({url:file.url,title:release.title,game:metadata})); }}><NavGlyph name="download" style={{ width: 18, height: 18 }}/>{t(transfer && openDownload ? "games.archive.viewDownloads" : "games.sources.links.title")}</button>}<button className="games-button" onClick={() => void openUrl(file.url)}>{t("games.sources.openLink")}<ArrowUpRight size={15}/></button></div> : <div className="games-source-magnet-actions"><button className="games-button" disabled={!downloads.torrents.available || !!transfer} aria-disabled={resolving} onClick={()=>void withContext(file.url, metadata => downloads.torrents.begin(file.url,metadata))}><NavGlyph name="download" style={{ width: 18, height: 18 }}/>{t("games.sources.art.reviewTorrent")}</button><button className="games-icon-button" aria-label={t("games.sources.copyMagnet")} title={t("games.sources.copyMagnet")} onClick={() => {void navigator.clipboard.writeText(file.url).then(() => setFeedback("games.sources.copied"), () => setFeedback("games.sources.copyError"));}}><Copy size={15}/></button></div>}</div>;})}</div>
      {feedback && <p role="status">{t(feedback)}</p>}{downloads.error && <p role="alert">{t(downloads.error)}</p>}
    </div>;
  if (presentation === "dialog") return <section className="games-source-release is-dialog" data-release-key={`${source.id}:${release.id}`}>{body}</section>;
  return <details open={initialOpen || undefined} className="games-source-release" data-release-key={`${source.id}:${release.id}`} onToggle={event => { if (event.currentTarget.open && !game) void context(); }}><summary><GameSourceIcon url={source.url} homepage={source.homepage || release.sourcePage} icon={source.icon} name={source.name} className="games-source-release-mark"/><span className="games-source-release-title"><strong>{release.title}</strong><small>{source.name}{release.version ? ` · ${release.version}` : ""}{release.platform ? ` · ${release.platform}` : ""}{release.size ? ` · ${release.size}` : ""}</small></span><span className="games-source-release-meta">{match && <span className={`games-source-match is-${match}`}>{t(`games.sources.match.${match}`)}</span>}{release.date && <time dateTime={release.date}>{new Date(release.date).toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric", timeZone:"UTC"})}</time>}</span><ChevronRight size={17}/></summary>{body}</details>;
}

function SourceSubscription({ item, sources, select, repair }: { item: GameSource; sources: GameSources; select?: (button: HTMLButtonElement) => void; repair: (button: HTMLButtonElement) => void }) {
  const t = useT(), count = sourceEntryCount(item);
  const row = useRef<HTMLDivElement>(null), verificationFocus = useRef<HTMLElement|null>(null);
  const busy = sources.busy.includes(item.id);
  useLayoutEffect(() => {
    const trigger = verificationFocus.current;
    if (!trigger || busy) return;
    verificationFocus.current = null;
    if (!trigger.isConnected && document.activeElement === document.body) row.current?.querySelector<HTMLButtonElement>('.games-source-select,.games-source-toggle')?.focus({preventScroll:true});
  }, [busy]);
  const identity = <><GameSourceIcon url={item.url} homepage={item.homepage} icon={item.icon} name={item.name} className="games-source-subscription-art"/><span className="games-source-summary">{select && <strong>{item.name}</strong>}<small><bdi>{new URL(item.url).hostname}</bdi> · {t(item.catalogIssue ? "games.sources.catalogUnavailable" : item.website ? "games.sources.website.recent" : count === 1 ? "games.sources.singleRelease" : "games.sources.count", {count: count.toLocaleString()})}</small><small>{t("games.sources.checked", {date:new Date(item.checkedAt).toLocaleString(undefined, {dateStyle:"short", timeStyle:"short"})})}</small></span></>;
  return <div className={`games-source-subscription${select ? '' : ' is-current'}`} data-source-id={item.id} ref={row}>
    {select ? <button className="games-source-select" onClick={event => select(event.currentTarget)}>{identity}<ChevronRight size={16} aria-hidden="true"/></button> : <div className="games-source-identity">{identity}</div>}
    <div className="games-source-subscription-actions">
      <button className="games-source-toggle" role="switch" aria-checked={item.enabled} aria-label={t("games.sources.enable", {name:item.name})} onClick={() => void sources.toggle(item.id)}><i/></button>
      <button className="games-icon-button" onClick={event => repair(event.currentTarget)} aria-label={t("games.sources.repair.title", {name:item.name})}><Link2 size={16}/></button>
      <button className={`games-icon-button${sources.busy.includes(item.id) ? " is-refreshing" : ""}`} disabled={sources.busy.includes(item.id)} onClick={() => void sources.refresh(item)} aria-label={t("games.sources.refresh", {name:item.name})}><RefreshCw size={16}/></button>
      <button className="games-icon-button" onClick={() => void sources.remove(item.id)} aria-label={t("games.sources.remove", {name:item.name})}><Trash2 size={16}/></button>
    </div>
    {item.error && !sources.busy.includes(item.id) && <p role="status">{t(item.error)} {count > 0 && t("games.sources.retained")}</p>}{item.skipped > 0 && <p>{t("games.sources.skipped", {count:item.skipped})}</p>}
    <SourceVerificationControl error={item.error} busy={busy} verifying={sources.verifying?.includes(item.id)??false} onVerify={()=>{verificationFocus.current=document.activeElement as HTMLElement;void sources.verify(item);}} onCancel={()=>sources.cancelVerification(item.id)}/>
  </div>;
}

export function GameSourcesModal({ sources, downloads, customLibrary, onClose }: { sources: GameSources; downloads: GameTransfers; customLibrary?: CustomGameLibrary; onClose: () => void }) {
  const [hydraOpen, setHydraOpen] = useState(false);
  const t = useT(), title = useId(), { closing, close } = useModalExit(onClose), root = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false), [url, setUrl] = useState(""), [draft, setDraft] = useState<SourceInspection|null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [verifyingForm, setVerifyingForm] = useState(false);
  const verificationInput = useRef<{url:string;publishedOn?:{website:string;icon?:string}}>({url:""});
  const cancelVerification = useRef(sources.cancelVerification);
  cancelVerification.current = sources.cancelVerification;
  useEffect(() => () => cancelVerification.current(), []);
  useEffect(() => { if (closing) { cancelVerification.current(); request.current?.abort(); } }, [closing]);
  const [selected, setSelected] = useState<string|null>(null), [query, setQuery] = useState(""), [limit, setLimit] = useState(30);
  const [filter, setFilter] = useState('');
  const scroll = useRef<HTMLDivElement>(null), listReturn = useRef<{ top: number; button: HTMLElement | null }>({ top: 0, button: null }), formTop = useRef(0);
  const navigation = useRef<{ top: number; button?: HTMLElement | null; selector?: string; waitForReload?: boolean; waitForSource?: string } | null>(null);
  const [editing, setEditing] = useState<GameSource|null>(null), [saving, setSaving] = useState(false);
  const request = useRef<AbortController|null>(null), mounted = useRef(true);
  const formVersion = useRef(0), formProfile = useRef(sources.profile), returnButton = useRef<HTMLElement|null>(null), restoreFocus = useRef(false);
  const source = sources.sources.find(s => s.id === selected);
  const filtered = useMemo(() => {
    const term = filter.trim().toLocaleLowerCase();
    return sources.sources.filter(item => !term || `${item.name} ${new URL(item.url).hostname}`.toLocaleLowerCase().includes(term));
  }, [sources.sources, filter]);
  const selectSource = (item: GameSource, button: HTMLElement) => {
    listReturn.current = { top: scroll.current?.scrollTop ?? 0, button };
    navigation.current = { top: 0, selector: '[data-source-back]' };
    setSelected(item.id); setQuery(''); setLimit(30);
  };
  const returnToSources = () => { navigation.current = { ...listReturn.current, selector: '[data-source-filter]' }; setSelected(null); };
  const browse = useSourceCatalog(source?.website || source?.catalogIssue ? undefined : source, query, limit), releases = browse.entries;
  const browseFocus = useRef<{ source: GameSource; query: string; button: HTMLButtonElement; before: number } | null>(null);
  useLayoutEffect(() => {
    const pending = browseFocus.current; if (!pending || browse.loading) return;
    browseFocus.current = null;
    if (pending.source !== source || pending.query !== query || !(document.activeElement === pending.button || !pending.button.isConnected && document.activeElement === document.body)) return;
    const body = root.current?.querySelector('.games-source-browse');
    const target = browse.error ? body?.querySelector<HTMLButtonElement>('[data-catalog-retry]') : body?.querySelectorAll<HTMLElement>('.games-source-release>summary')[pending.before];
    target?.focus({ preventScroll: true });
  }, [browse.loading, browse.entries, browse.error, source, query]);
  useEffect(() => { mounted.current = true; const previous = document.activeElement as HTMLElement|null; root.current?.querySelector<HTMLElement>("button")?.focus({preventScroll:true});
    const trap = (event: KeyboardEvent) => { if(event.key !== "Tab" || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1)!==root.current?.closest('[role="dialog"]'))return; const items = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary,a[href]') ?? [])].filter(el => el.getClientRects().length); if(!items.length)return; const index = items.indexOf(document.activeElement as HTMLElement); if(index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === items.length-1){event.preventDefault();(event.shiftKey?items.at(-1):items[0])?.focus();} };
    document.addEventListener("keydown", trap); return () => {mounted.current = false;request.current?.abort();document.removeEventListener("keydown",trap);previous?.focus({preventScroll:true});}; }, []);
  const inspect = async (input=url, publishedOn?:{website:string;icon?:string}, verify=false) => { if(busy)return;verificationInput.current={url:input,publishedOn};const previousError=error;request.current?.abort(); const controller = new AbortController(); request.current = controller;setBusy(true);setVerifyingForm(verify);setError("");sources.dismissError(); try {const reviewed=editing ? sources.sources.find(item=>item.id===editing.id) : null;if(editing&&!reviewed)throw Error("source_changed");const result = await sources.inspect(input.trim(),controller.signal,editing?.id,verify,()=>{if(mounted.current&&request.current===controller&&!controller.signal.aborted)setVerifyingForm(false);});if(mounted.current && !controller.signal.aborted){if(reviewed)setEditing(reviewed);setDraft(result.kind === "catalog" && publishedOn ? {...result,manifest:inheritSourceArtwork(result.manifest,publishedOn.website,publishedOn.icon)} : result);}}catch(error){if(mounted.current && !controller.signal.aborted)setError(error instanceof DOMException && error.name==="AbortError" ? previousError : sourceError(error));}finally{if(mounted.current && request.current===controller){setBusy(false);setVerifyingForm(false);}} };
  const reset = () => {formVersion.current++;request.current?.abort();restoreFocus.current=true;setAdding(false);setEditing(null);setBusy(false);setDraft(null);setUrl("");setError("");sources.dismissError();};
  const begin = (button: HTMLElement, item: GameSource|null = null) => {formVersion.current++;returnButton.current=button;formTop.current=scroll.current?.scrollTop??0;restoreFocus.current=false;setEditing(item);setUrl(item?.url||"");setDraft(null);setError("");sources.dismissError();setAdding(true);};
  const back = () => { if (saving) return; if (adding) reset(); else if (source) returnToSources(); else close(); };
  useSectionBack(back, !hydraOpen);
  useLayoutEffect(() => {
    if(formProfile.current !== sources.profile){formProfile.current=sources.profile;formVersion.current++;request.current?.abort();returnButton.current=null;restoreFocus.current=false;listReturn.current={top:0,button:null};navigation.current={top:0,selector:'header button'};setFilter('');setQuery('');setSaving(false);setAdding(false);setEditing(null);setDraft(null);setBusy(false);setError("");setUrl("");setSelected(null);return;}
    if(adding){if(scroll.current)scroll.current.scrollTop=0;root.current?.querySelector<HTMLElement>(draft ? '.games-source-add [data-source-next]' : '.games-source-add input')?.focus({preventScroll:true});}
    else if(restoreFocus.current){restoreFocus.current=false;if(scroll.current)scroll.current.scrollTop=formTop.current;const target=returnButton.current; (target?.isConnected && target.getClientRects().length ? target : root.current?.querySelector<HTMLElement>('footer button') ?? root.current?.querySelector<HTMLElement>('header button'))?.focus({preventScroll:true});}
  }, [adding, editing, draft, sources.profile]);
  useLayoutEffect(() => {
    if (selected && !source && sources.ready && !adding) { returnToSources(); return; }
    const pending = navigation.current; if (!pending || adding || pending.waitForReload && sources.loading || pending.waitForSource && sources.busy.includes(pending.waitForSource)) return;
    navigation.current = null;
    if (scroll.current) scroll.current.scrollTop = pending.top;
    const target = pending.button?.isConnected && pending.button.getClientRects().length ? pending.button : root.current?.querySelector<HTMLElement>(pending.selector ?? '[data-source-filter]');
    target?.focus({ preventScroll: true });
  }, [selected, source?.id, source?.catalogIssue, sources.profile, sources.ready, sources.loading, sources.busy, adding]);
  const save = async () => {
    if(busy || draft?.kind !== "catalog")return;
    const version=formVersion.current;setBusy(true);setSaving(true);
    const ok=await (editing ? sources.replace(editing,draft.url,draft.manifest) : sources.add(draft.url,draft.manifest));
    if(mounted.current && version===formVersion.current){setBusy(false);setSaving(false);if(ok)reset();}
  };
  return <><ModalShell width={820} labelledBy={title} closing={closing} onDismiss={back} backdropClassName="games-match-backdrop"><div className="games-sources-modal" ref={root}>
    <header><div className="games-sources-heading">{(source || adding) && <button className="games-icon-button games-source-back" data-source-back disabled={saving} onClick={back} aria-label={t("games.sources.back")}><ArrowLeft size={20}/></button>}<div><span className="games-section-kicker">{source || adding ? t("games.sources.manage") : t("games.sources.eyebrow")}</span><h2 id={title}>{adding ? t(editing ? "games.sources.repair.title" : "games.sources.add", {name:editing?.name??""}) : source?.name ?? t("games.sources.manage")}</h2></div></div><button className="games-icon-button" disabled={saving} onClick={close} aria-label={t("common.close")}><X size={20}/></button></header>
    <div className="games-sources-scroll" ref={scroll} data-source-view={adding ? "form" : source ? "catalog" : "list"}>
      {sources.loading && !sources.ready ? <p role="status">{t("common.loading")}</p> : !sources.ready ? <div role="alert"><p>{t(sources.error)}</p><button className="games-button" onClick={() => void sources.reload()}>{t("common.retry")}</button></div> : <>
        <div className="games-source-page" hidden={!!source || adding}>
          <p className="games-source-explainer">{t("games.sources.chooseNote")}</p>
          {!!sources.sources.length && <div className="games-source-list-tools"><div className="games-source-search"><Search size={16}/><input data-source-filter aria-label={t("games.sources.filter")} placeholder={t("games.sources.filter")} value={filter} maxLength={200} onChange={event=>setFilter(event.target.value)}/>{filter && <button className="games-icon-button" aria-label={t("games.clear")} onClick={()=>{setFilter('');root.current?.querySelector<HTMLInputElement>('[data-source-filter]')?.focus();}}><X size={15}/></button>}</div><p role="status">{t("games.sources.subscriptionCount", {count:filtered.length.toLocaleString()})}</p></div>}
          <div className="games-source-subscriptions">{filtered.map(item=><SourceSubscription key={item.id} item={item} sources={sources} select={button=>selectSource(item,button)} repair={button=>begin(button,item)}/>)}</div>
          {!!sources.sources.length && !filtered.length && <p className="games-source-explainer">{t("games.sources.filterEmpty")}</p>}
          {!sources.sources.length && <div className="games-source-empty"><Link2 size={34}/><h3>{t("games.sources.empty")}</h3><p>{t("games.sources.emptyNote")}</p></div>}
        </div>
        {source && <div className="games-source-page" hidden={adding}><SourceSubscription item={source} sources={sources} repair={button=>begin(button,source)}/>
        {source.catalogIssue ? <section className="games-source-recovery" role="alert"><h3>{t("games.sources.catalogUnavailable")}</h3><p>{t("games.sources.catalogRepair")}</p><div><button className="games-button games-button-primary" disabled={sources.busy.includes(source.id)} onClick={() => {navigation.current={top:scroll.current?.scrollTop??0,selector:'.games-source-browse input,[data-saved-retry]',waitForSource:source.id};void sources.refresh(source);}}><RefreshCw size={16}/>{t(sources.busy.includes(source.id)?"common.loading":"games.sources.restoreCatalog")}</button><button className="games-button" data-saved-retry disabled={sources.loading || sources.busy.includes(source.id)} onClick={() => {navigation.current={top:scroll.current?.scrollTop??0,selector:'.games-source-browse input,[data-saved-retry]',waitForReload:true};void sources.reload();}}>{t(sources.loading?"common.loading":"games.sources.retrySavedCatalog")}</button></div></section> : source.website ? <WebsiteSourceBrowse key={source.id} source={source} downloads={downloads}/> : <section className="games-source-browse"><div className="games-source-search"><Search size={16}/><input aria-label={t("games.sources.search")} placeholder={t("games.sources.search")} value={query} maxLength={200} onChange={e => {setQuery(e.target.value);setLimit(30);}}/>{query && <button className="games-icon-button" onClick={() => setQuery("")} aria-label={t("games.clear")}><X size={15}/></button>}</div>{!browse.error && (!browse.loading || releases.length > 0) && <p>{t(browse.total === 1 ? "games.sources.singleRelease" : "games.sources.count",{count:browse.total.toLocaleString()})}</p>}{browse.loading && !releases.length && <div className="games-source-loading" role="status" aria-label={t("common.loading")}>{[0,1,2].map(n=><div key={n} aria-hidden="true"><i className="games-detail-skeleton"/><span className="games-detail-skeleton"/></div>)}</div>}{browse.error && <div className="games-inline-status" role="alert"><span>{t(browse.error)}</span><button className="games-button" data-catalog-retry onClick={browse.retry}>{t("common.retry")}</button></div>}{releases.map(release => <SourceReleaseRow key={release.id} source={source} release={release} downloads={downloads}/>)}<GameSourceContinuation key={`${source.id}:${query}`} count={releases.length} cursor={limit} more={browse.total>limit} busy={browse.loading} failed={!!browse.error} load={()=>setLimit(n=>n+30)} manual={button=>{browseFocus.current={source,query,button,before:releases.length};setLimit(n=>n+30);}}/></section>}
        </div>}
        {adding && <form className="games-source-add games-source-page" aria-busy={busy} onSubmit={event => {event.preventDefault();if(!draft&&!busy)void inspect();}}>
          {editing && <p>{t("games.sources.repair.note")}</p>}
          {!draft ? <>
            <label>{t("games.sources.discovery.address")}<span className="games-source-address"><GameSourceIcon url={sourceInputUrl(url)} className="games-source-address-art"/><input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={url} onChange={e=>{setUrl(e.target.value);setError("");}} placeholder="example.org" disabled={busy}/></span></label>
            <p>{t("games.sources.discovery.hint")}</p>
            <div className="games-source-add-actions"><button className="games-button games-button-primary" disabled={busy||!url.trim()} type="submit">{t(busy?"games.sources.checking":"games.sources.review")}</button><button className="games-button" type="button" onClick={reset}>{t("common.cancel")}</button></div>
          </> : draft.kind === "choices" ? <>
            <p>{t("games.sources.discovery.choose")}</p>
            <div className="games-source-candidates">{draft.candidates.map((candidate,index)=><button type="button" data-source-next={index===0?"":undefined} key={candidate.url} aria-disabled={busy} onClick={()=>{if(!busy)void inspect(candidate.url,draft);}}><GameSourceIcon url={candidate.url} homepage={draft.website} icon={draft.icon} name={candidate.name}/><span><strong>{candidate.name}</strong><small>{new URL(candidate.url).hostname}{new URL(candidate.url).pathname}</small></span><ChevronRight size={17}/></button>)}</div>
            {busy&&<p role="status">{t("games.sources.checking")}</p>}
            <div className="games-source-add-actions"><button type="button" className="games-button" onClick={()=>{request.current?.abort();setBusy(false);setDraft(null);setError("");requestAnimationFrame(()=>root.current?.querySelector<HTMLInputElement>('.games-source-add input')?.focus());}}>{t("games.sources.discovery.change")}</button><button type="button" className="games-button" onClick={reset}>{t("common.cancel")}</button></div>
          </> : <>
            <div className="games-source-review"><GameSourceIcon url={draft.url} homepage={draft.manifest.homepage} icon={draft.manifest.icon} name={draft.manifest.name} className="games-source-subscription-art"/><div><strong>{draft.manifest.name}</strong><span>{t(`games.sources.discovery.${draft.manifest.format}`)} · {t(draft.manifest.website ? "games.sources.website.recent" : "games.sources.count",{count:draft.manifest.entries.length.toLocaleString()})}</span><small>{draft.url}</small>{draft.manifest.skipped>0&&<span>{t("games.sources.skipped",{count:draft.manifest.skipped})}</span>}</div></div>
            <ul className="games-source-sample" aria-label={t("games.sources.discovery.preview")}>{draft.manifest.entries.slice(0,3).map(entry=><li key={entry.id}><span>{entry.title}</span>{entry.size&&<small>{entry.size}</small>}</li>)}</ul>
            <p>{t("games.sources.discovery.reviewNote")}</p>
            {draft.manifest.website && <p>{t("games.sources.website.note")}</p>}
            <div className="games-source-add-actions"><button type="button" data-source-next className="games-button games-button-primary" disabled={busy} onClick={()=>void save()}>{editing ? <Check size={16}/> : <Plus size={16}/>}{t(saving ? "games.sources.saving" : editing ? "common.save" : "games.sources.add")}</button><button type="button" className="games-button" disabled={busy} onClick={()=>{setDraft(null);setError("");}}>{t("games.sources.discovery.change")}</button><button type="button" className="games-button" disabled={busy} onClick={reset}>{t("common.cancel")}</button></div>
          </>}
          {error&&<p className="games-inline-status" role="alert">{t(error)}</p>}
          <SourceVerificationControl error={error} busy={busy} verifying={verifyingForm} onVerify={()=>void inspect(verificationInput.current.url,verificationInput.current.publishedOn,true)} onCancel={()=>{request.current?.abort();setError("games.sources.source_blocked");}}/>
        </form>}
      </>}
      {sources.ready && sources.error && <p className="games-inline-status" role="alert">{t(sources.error)}</p>}
    </div>
    <footer><span>{t("games.sources.profileNote")}</span>{!adding&&customLibrary?.available&&<button className="games-button" disabled={busy||saving} onClick={()=>setHydraOpen(true)}><FileUp size={16}/>{t("games.hydra.title")}</button>}{!adding && <button className="games-button games-button-primary" disabled={!sources.ready || sources.sources.length>=SOURCE_MAX_SUBSCRIPTIONS} onClick={event=>begin(event.currentTarget)}><Plus size={16}/>{t("games.sources.add")}</button>}</footer>
  </div></ModalShell>{hydraOpen&&!closing&&customLibrary&&<GameHydraImport key={customLibrary.profile} library={customLibrary} sources={sources} onClose={()=>setHydraOpen(false)}/>}</>;
}
