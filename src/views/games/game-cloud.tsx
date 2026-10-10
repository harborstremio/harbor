import { NavChevron } from "@/components/nav-arrow";
import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowDown, ArrowLeft, ArrowRight, CloudDownload, File, Folder, RefreshCw, Search, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import type { GameTransfers } from "@/hooks/use-game-transfers";
import { transferBytes } from "@/lib/games/transfers";
import { CLOUD_PROVIDERS, cloudError, type CloudDownload as CloudFileDownload, type CloudEntry, type CloudKeys, type CloudPage, type CloudProvider } from "@/lib/games/cloud-files";
import rdLogo from "@/assets/addon-logos/realdebrid.png";
import tbLogo from "@/assets/addon-logos/torbox.png";
import pmLogo from "@/assets/addon-logos/premiumize.png";
import "./game-cloud.css";
import type { CloudWebJob, CloudWebPage } from "@/lib/games/cloud-web-jobs";

const logos = { rd: rdLogo, tb: tbLogo, pm: pmLogo };
type Location = { entry: CloudEntry; page: number; query: string; scroll: number };
export function GameCloudDialog({ downloads, keys, openSettings, onClose, initialProvider, initialScope="torrents", initialFolder }: { downloads: GameTransfers; keys: CloudKeys; openSettings?: () => void; onClose: () => void; initialProvider?: CloudProvider; initialScope?: "torrents"|"web"; initialFolder?: CloudEntry }) {
  const t = useT(), titleId = useId(), { closing, close } = useModalExit(onClose);
  const body = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null), alive = useRef(true), revision = useRef(0), pending = useRef(false), scrollTarget = useRef(0);
  const [provider, setProvider] = useState<CloudProvider>(() => initialProvider ?? CLOUD_PROVIDERS.find(v => keys[v.id]?.trim())?.id ?? "rd"), [trail, setTrail] = useState<Location[]>(()=>initialFolder?[{entry:initialFolder,page:0,query:'',scroll:0}]:[]), [page, setPage] = useState(0), [query, setQuery] = useState(""), [limit, setLimit] = useState(100);
  const [scope,setScope]=useState(initialScope);
  const [result, setResult] = useState<CloudPage | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0), [resolving, setResolving] = useState("");
  const [selected, setSelected] = useState<CloudFileDownload | null>(null);
  const key = keys[provider]?.trim() ?? "", parent = trail.at(-1)?.entry.id ?? "", service = CLOUD_PROVIDERS.find(v => v.id === provider)!;
  const jobs=scope==='web'&&(provider==='tb'||provider==='pm'),folder=trail.at(-1)?.entry.kind==='folder',jobCommand=`games_cloud_${provider==='pm'?'pm':'web'}`;
  const saving = downloads.busy.includes("new"), available = downloads.available, connected = !!key;
  const dismiss = () => { if (!saving) close(); };
  const back = () => {
    if (saving) return;
    if (selected) { setSelected(null); setError(""); downloads.dismissError(); requestAnimationFrame(() => { list.current?.scrollTo(0, scrollTarget.current); search.current?.focus({preventScroll:true}); }); return; }
    if (trail.length) { const previous = trail.at(-1)!; scrollTarget.current=previous.scroll; setTrail(v => v.slice(0, -1)); setPage(previous.page); setQuery(previous.query); return; }
    dismiss();
  };
  useSectionBack(back, true);
  useEffect(() => {
    alive.current = true; const previous = document.activeElement as HTMLElement | null; body.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => { if (event.key !== "Tab") return; const items = [...body.current!.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled),a[href]')].filter(el => el.getClientRects().length); if (!items.length) return; if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); } };
    document.addEventListener("keydown", trap); return () => { alive.current = false; revision.current++; document.removeEventListener("keydown", trap); previous?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const current = ++revision.current; setSelected(null); setResolving(""); pending.current = false; setResult(null); setError(""); setLimit(100);
    if (!connected || !available) { setLoading(false); return; }
    setLoading(true);
    const request={args:{provider,key,parent,page}};
    const load=jobs&&!folder ? parent ? invoke<CloudWebJob>(`${jobCommand}_status`,request).then(job=>({entries:job.files,next:null,label:job.status==="ready"?job.name:job.status==="missing"?"failed":job.status})) : invoke<CloudWebPage>(`${jobCommand}_list`,request).then(value=>({entries:value.jobs.map(job=>({id:job.id,name:job.name,kind:"torrent" as const,bytes:job.bytes,ready:job.status==="ready",status:job.status==="missing"?"failed" as const:job.status})),next:value.next,label:""})) : invoke<CloudPage>("games_cloud_list",request);
    void load.then(value => { if (alive.current && current === revision.current) { setResult(value); setLoading(false); requestAnimationFrame(()=>list.current?.scrollTo(0,scrollTarget.current)); } }).catch(reason => { if (alive.current && current === revision.current) { setError(cloudError(reason)); setLoading(false); } });
  }, [provider, key, parent, page, retry, available, connected,scope,jobs,folder,jobCommand]);
  useEffect(() => { setLimit(100); list.current?.scrollTo(0, 0); }, [query]);
  const choose = async (entry: CloudEntry) => {
    if (pending.current || saving) return;
    if (entry.kind !== "file") { setTrail(v => [...v, { entry, page, query, scroll: list.current?.scrollTop ?? 0 }]); scrollTarget.current=0; setPage(0); setQuery(""); return; }
    if (!entry.ready) return; pending.current = true; scrollTarget.current=list.current?.scrollTop??0; const current = revision.current; setResolving(entry.id); setError(""); downloads.dismissError();
    try { const value = await invoke<CloudFileDownload>(jobs&&!folder?`${jobCommand}_download`:"games_cloud_download", { args: { provider, key, parent, file: entry.id } }); if (alive.current && current === revision.current) { setSelected(value); requestAnimationFrame(() => body.current?.querySelector<HTMLElement>(".games-cloud-save")?.focus()); } }
    catch (reason) { if (alive.current && current === revision.current) setError(cloudError(reason)); }
    finally { if (alive.current && current === revision.current) { setResolving(""); pending.current = false; } }
  };
  const matches = result?.entries.filter(entry => entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [];
  const fileName = (entry: CloudEntry, index: number) => entry.name || t("games.cloud.part", { n: index + 1 });
  const preparing = result?.label === "preparing", failed = result?.label === "failed";
  return <ModalShell closing={closing} onDismiss={dismiss} width={670} labelledBy={titleId} backdropClassName="games-cloud-backdrop"><div ref={body} className="games-cloud-dialog">
    <header><div><span className="games-section-kicker"><CloudDownload size={15} />{t("games.cloud.kicker")}</span><h2 id={titleId}>{t("games.cloud.title")}</h2></div><button className="games-icon-button" disabled={saving} onClick={dismiss} aria-label={t("common.close")}><X size={19} /></button></header>
    <div className="games-cloud-providers" aria-label={t("games.cloud.provider")}>{CLOUD_PROVIDERS.map(item => <button key={item.id} aria-pressed={provider === item.id} disabled={saving} onClick={() => { setProvider(item.id); setTrail([]); setPage(0); setQuery(""); }}><img src={logos[item.id]} alt="" /><span>{item.name}</span>{keys[item.id]?.trim() && <i aria-label={t("games.cloud.connected")} />}</button>)}</div>
    {(provider==="tb"||provider==='pm')&&<div className="games-web-scope">{(["torrents","web"] as const).map(value=><button key={value} aria-pressed={scope===value} disabled={saving} onClick={()=>{setScope(value);setTrail([]);setPage(0);setQuery("");scrollTarget.current=0}}>{t(provider==='pm'?`games.sources.pm.${value==='web'?'transfers':'files'}`:`games.sources.web.${value}`)}</button>)}</div>}
    {!available || !connected ? <div className="games-cloud-state"><CloudDownload size={37} /><h3>{t(available ? "games.cloud.connect" : "games.download.desktopTitle")}</h3><p>{t(available ? "games.cloud.connectNote" : "games.download.desktopNote", { name: service.name })}</p>{available && openSettings && <button className="games-button games-button-primary" onClick={() => { close(); openSettings(); }}>{t("games.cloud.openSettings")}<ArrowRight size={16} /></button>}</div> : <>
      <div className="games-cloud-location"><button className="games-icon-button" onClick={back} disabled={saving || (!trail.length && !selected)} aria-label={t("common.back")}><ArrowLeft size={17} /></button><span title={trail.at(-1)?.entry.name}>{selected ? t("games.cloud.review") : trail.at(-1)?.entry.name || t("games.cloud.root")}</span><button className="games-icon-button" disabled={loading || saving || !!resolving} onClick={() => { setSelected(null); setRetry(v => v + 1); }} aria-label={t("games.cloud.refresh")}><RefreshCw size={16} /></button></div>
      {selected ? <div className="games-cloud-review"><span className="games-cloud-file-icon"><File size={32} /></span><h3>{selected.name}</h3><p>{service.name}<i />{selected.expectedBytes ? transferBytes(selected.expectedBytes) : t("games.cloud.unknownSize")}</p><span>{t("games.cloud.reviewNote")}</span></div> : <>
        <label className="games-cloud-search"><Search size={16} /><input ref={search} aria-label={t("games.cloud.search")} placeholder={t("games.cloud.search")} value={query} onChange={e => setQuery(e.target.value)} maxLength={200} disabled={loading} />{query && <button className="games-icon-button" onClick={() => { setQuery(""); search.current?.focus(); }} aria-label={t("games.cloud.clearSearch")}><X size={14} /></button>}</label>
        <div ref={list} className="games-cloud-list" aria-busy={loading}>{loading ? <div className="games-cloud-skeleton" role="status" aria-label={t("common.loading")}>{Array.from({ length: 5 }, (_, i) => <div key={i}><i /><span /></div>)}</div> : error && !result ? null : !matches.length ? <div className="games-cloud-empty"><Folder size={29} /><h3>{t(query ? "games.noResults" : preparing ? "games.cloud.preparing" : failed ? "games.cloud.failed" : "games.cloud.empty")}</h3><p>{t(query ? "games.cloud.trySearch" : preparing ? "games.cloud.preparingNote" : failed ? "games.cloud.failedNote" : "games.cloud.emptyNote")}</p></div> : <>{matches.slice(0, limit).map((entry, index) => <button className="games-cloud-row" key={entry.id} disabled={!!resolving || saving || (entry.kind === "file" && !entry.ready)} onClick={() => void choose(entry)}><span className="games-cloud-row-icon">{entry.kind === "file" ? <File size={20} /> : <Folder size={21} />}</span><span><strong>{fileName(entry, index)}</strong><small>{resolving === entry.id ? t("games.cloud.resolving") : !entry.ready ? t(`games.cloud.${entry.status}`) : entry.bytes ? transferBytes(entry.bytes) : entry.kind === "folder" ? t("games.cloud.folder") : t("games.cloud.unknownSize")}</small></span>{entry.kind === "file" ? <ArrowDown size={16} /> : <NavChevron dir="right" size={16} />}</button>)}{matches.length > limit && <button className="games-button games-cloud-more" onClick={() => setLimit(v => v + 100)}>{t("games.cloud.more")}</button>}</>}</div>
      </>}
      {error && <div className="games-cloud-error" role="alert"><span>{t(error)}</span>{!selected && !resolving && <button className="games-button" onClick={() => setRetry(v => v + 1)}>{t("common.retry")}</button>}</div>}
      {selected && downloads.error && <p className="games-cloud-error" role="alert">{t(downloads.error)}</p>}
      <footer><span>{t(selected ? "games.cloud.kept" : "games.cloud.pageNote", { page: page + 1 })}</span>{selected ? <button className="games-button games-button-primary games-cloud-save" disabled={saving} onClick={() => { void downloads.start({ url: selected.url, name: selected.name, expectedBytes: selected.expectedBytes ?? undefined }).then(started => { if (started && alive.current) close(); }); }}><ArrowDown size={16} />{t(saving ? "common.loading" : "games.download.chooseDestination")}</button> : <div><button className="games-icon-button" disabled={loading || page === 0 || !!resolving} aria-label={t("games.cloud.previousPage")} onClick={() => { setPage(v => v - 1); setQuery(""); }}><NavChevron dir="left" size={18} /></button><button className="games-icon-button" disabled={loading || result?.next == null || !!resolving} aria-label={t("games.cloud.nextPage")} onClick={() => { if (result?.next != null) { setPage(result.next); setQuery(""); } }}><NavChevron dir="right" size={18} /></button></div>}</footer>
    </>}
  </div></ModalShell>;
}
