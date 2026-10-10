import {canOrderDownload,compareDownloadQueue} from "@/lib/games/download-queue";
import {useSourceRelink} from "./game-source-links";
import {transferStateKey,transferProgressBytes} from "@/lib/games/transfer-relink";
import {DownloadQueueActions} from "./game-download-queue";
import { Play } from "@/components/icons/play-filled";
import {downloadContentLabel} from "@/lib/games/download-content";
import {DownloadContentInfo} from "./game-download-content";
import {useEffect,useId,useRef,useState,type ReactNode} from "react";
import {Check,CloudDownload,Download,FolderOpen,Link2,Monitor,Network,PackageOpen,Plus,Recycle,RefreshCw,ScanSearch,Trash2,X} from "lucide-react";
import { LoaderCircle, Pause } from "@/components/icons/music-icons";
import {HoverTooltip} from "@/components/hover-tooltip";
import {ModalShell,useModalExit} from "@/components/modal-shell";
import {useT} from "@/lib/i18n";
import {useSectionBack} from "@/lib/section-back";
import {isTransferActive,transferBytes,type GameTransfer} from "@/lib/games/transfers";
import type {GameTransfers} from "@/hooks/use-game-transfers";
import {GameArchiveDialog} from "./game-archive";
import {GameArchiveCleanup} from "./game-archive-cleanup";
import {GameTorrentRow,GameTorrentActions} from "./game-torrent";
import {DownloadActivity,DownloadArtwork,runDownloadAction} from "./game-download-activity";
import {downloadGame,featuredDownload,type DownloadItem,type DownloadGroup} from "@/lib/games/download-presentation";
import {downloadSetup,downloadSetupGroup,setupIsBusy,type DownloadSetup} from "@/lib/games/download-setup";
import {DownloadSetupStatus} from "./game-download-setup";
import type {CloudKeys} from "@/lib/games/cloud-files";
import {GameCloudDialog} from "./game-cloud";
import {GameDownloadSpeed} from "./game-download-speed";
import {GameDownloadStorage} from "./game-download-storage";
import type {CustomGameLibrary} from "@/hooks/use-custom-game-library";
import {useGameSetup,type GameSetupState} from "@/hooks/use-game-setup";
import type {SetupSource} from "@/lib/games/setup";
import {archiveFolder,archiveSetupSource,downloadArchive,type ArchiveJob} from "@/lib/games/archives";
import {useGameArchives,type GameArchives} from "@/hooks/use-game-archives";
import {ArchiveJobStatus,GameArchiveJobs} from "./game-download-archive";
import {GameSetupDialog} from "./game-setup";
import {DownloadSourceArtworkContext,type DownloadSourceArtwork} from "./game-download-source";
import {useDownloadHistory} from "@/hooks/use-download-history";
import {downloadCompletedAt,downloadHistoryHidden} from "@/lib/games/download-history";
import {DownloadCompletedDate} from "./game-download-completed";
import {useGamePreparations} from "@/hooks/use-game-preparations";
import {downloadPreparation,preparationGroup,preparationOutput} from "@/lib/games/download-preparation";
import {GamePreparationReview,PreparationStatus} from "./game-preparation-review";
import "./game-downloads.css";
const EMPTY_SOURCE_ARTWORK:readonly DownloadSourceArtwork[]=[];

export function GameDownloads({downloads,query,manageSources,active,openLibrary,cloudKeys,openSourceSettings,revealId,customLibrary,setupState:providedSetup,archiveState:providedArchives,sourceArtwork=EMPTY_SOURCE_ARTWORK}:{archiveState?:GameArchives;sourceArtwork?:readonly DownloadSourceArtwork[];setupState?:GameSetupState;customLibrary:CustomGameLibrary;downloads:GameTransfers;query:string;manageSources:()=>void;active:boolean;openLibrary:()=>void;cloudKeys:CloudKeys;openSourceSettings?:()=>void;revealId?:string}){
  const t=useT(),[adding,setAdding]=useState(false),[filter,setFilter]=useState("all"),[archive,setArchive]=useState<string|null>(null),[cloud,setCloud]=useState(false);
  const [cleanup,setCleanup]=useState(false);
  useEffect(()=>{setCleanup(false);},[downloads.profile,active]);
  useEffect(()=>{if(!active){setAdding(false);setArchive(null);setCloud(false);}},[active]);
  useEffect(()=>{if(revealId)setFilter("all");},[revealId]);
  const torrents=downloads.torrents;
  const localArchives=useGameArchives(downloads.profile,!providedArchives&&active),archives=providedArchives??localArchives;
  const [reviewedArchive,setReviewedArchive]=useState<ArchiveJob|null>(null);
  const reviewArchive=(job:ArchiveJob)=>{setReviewedArchive(job);setArchive(job.source);};
  const [setup,setSetup]=useState<SetupSource|null>(null),localSetup=useGameSetup(downloads.profile,!providedSetup&&active,providedSetup?undefined:customLibrary),setupState=providedSetup??localSetup;
  useEffect(()=>{setSetup(null);setArchive(null);setReviewedArchive(null);},[downloads.profile]);
  useEffect(()=>{if(!active)setSetup(null);},[active]);
  const matches=(item:DownloadItem)=>[item.record.name,downloadGame(item.record)?.name??""].some(name=>name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const all:DownloadItem[]=[...downloads.records.map(record=>({kind:"direct" as const,record})),...torrents.records.map(record=>({kind:"torrent" as const,record}))];
  const preparations=useGamePreparations(downloads.profile,active,all.some(item=>!!item.record.preparation));
  const [reviewPreparation,setReviewPreparation]=useState<DownloadItem|null>(null);
  useEffect(()=>{setReviewPreparation(null);},[downloads.profile,active]);
  const preparation=(item:DownloadItem)=>downloadPreparation(item,preparations.choices);
  const preparing=(item:DownloadItem)=>{const choice=preparation(item);return !!choice&&!["started","disabled"].includes(choice.status);};
  const extraction=(item:DownloadItem)=>{const choice=preparation(item);return archives.jobs.find(job=>job.profile===downloads.profile&&job.id===choice?.id)??(preparing(item)?undefined:downloadArchive(item,downloads.profile,archives.jobs));};
  const installation=(item:DownloadItem)=>preparing(item)?undefined:downloadSetup(item,downloads.profile,setupState.jobs,customLibrary.data.games,setupState.registering,setupState.registrationErrors,archives.jobs);
  const prepare=(item:DownloadItem)=>{const job=extraction(item),choice=preparation(item);if(choice&&choice.status!=="disabled"&&!job){if(choice.status==="started"){setSetup({source:preparationOutput(choice),originSource:item.record.destination,name:item.record.name,game:downloadGame(item.record)});}else setReviewPreparation(item);return;}const prepared=job&&archiveSetupSource(job);if(job&&!prepared){reviewArchive(job);return;}setSetup(prepared??{source:item.record.destination,name:item.record.name,game:downloadGame(item.record)});};
  const groupFor=(item:DownloadItem)=>preparationGroup(downloadSetupGroup(item,installation(item),extraction(item)),preparation(item));
  const preparationStatus=(item:DownloadItem)=>{const choice=preparation(item);return choice&&choice.status!=="started"&&!extraction(item)&&<PreparationStatus choice={choice} saved={preparations.choices.some(saved=>saved.id===choice.id)} review={()=>setReviewPreparation(item)}/>;};
  const reviewedChoice=reviewPreparation&&preparation(all.find(item=>item.kind===reviewPreparation.kind&&item.record.id===reviewPreparation.record.id)??reviewPreparation);
  const startedPreparations=preparations.choices.filter(choice=>choice.status==="started").map(choice=>choice.id).sort().join("|");
  useEffect(()=>{if(startedPreparations)void archives.refresh();},[startedPreparations]);
  const detached=archives.jobs.filter(job=>!all.some(item=>!!downloadArchive(item,downloads.profile,[job])));
  const standalone=detached.filter(job=>(!query||[job.name,job.game?.name??""].some(name=>name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))&&(filter==="all"||filter==="active"&&job.status==="running"||filter==="complete"&&job.status==="complete"));
  const history=useDownloadHistory(downloads.profile);
  const hidden=(item:DownloadItem)=>groupFor(item)==="complete"&&downloadHistoryHidden(item,history.dismissed,history.now);
  const hiddenCount=all.filter(hidden).length;
  const dismiss=(items:DownloadItem[])=>{
    history.dismiss(items.filter(item=>groupFor(item)==="complete"));
    history.setShowHistory(false);
    requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('.games-download-filters button[aria-pressed="true"]')?.focus({preventScroll:true}));
  };
  const activeCount=all.filter(item=>["active","queue"].includes(groupFor(item))).length+detached.filter(job=>job.status==="running").length;
  const queue=all.filter(canOrderDownload).sort(compareDownloadQueue);
  const records=all.filter(item=>(history.showHistory||!hidden(item))&&matches(item)&&(filter==="all"||(filter==="complete"?groupFor(item)==="complete":["active","queue"].includes(groupFor(item)))));
  const featured=records.filter(item=>setupIsBusy(installation(item))||extraction(item)?.status==="running").sort((a,b)=>(installation(b)?.job?.startedAt??extraction(b)?.startedAt??0)-(installation(a)?.job?.startedAt??extraction(a)?.startedAt??0))[0]
    ??featuredDownload(records.filter(item=>groupFor(item)==="active"))
    ??records.filter(item=>installation(item)?.phase==="attention").sort((a,b)=>(installation(b)?.job?.updatedAt??0)-(installation(a)?.job?.updatedAt??0))[0]
    ??records.filter(item=>item.record.status==="queued").sort(compareDownloadQueue)[0]
    ??featuredDownload(records);
  const sections=(["active","queue","attention","complete","canceled"] as DownloadGroup[]).map(group=>({group,items:records.filter(item=>groupFor(item)===group&&(group!=="active"||item!==featured)).sort((a,b)=>group==="complete"?(downloadCompletedAt(b)??0)-(downloadCompletedAt(a)??0):compareDownloadQueue(a,b))}));
  return <DownloadSourceArtworkContext.Provider value={sourceArtwork}><section className="games-downloads games-inset">
    <header className="games-download-heading"><div><h2>{t("games.download.nav")}</h2></div><div className="games-download-heading-actions"><HoverTooltip label={t("games.sources.manage")}><button className="games-icon-button" onClick={manageSources} aria-label={t("games.sources.manage")}><Link2 size={19}/></button></HoverTooltip><HoverTooltip label={t("games.torrent.add")}><button className="games-icon-button" disabled={!torrents.available} onClick={()=>torrents.begin()} aria-label={t("games.torrent.add")}><Network size={19}/></button></HoverTooltip><button className="games-button games-button-primary" disabled={!downloads.available} onClick={()=>setAdding(true)}><Plus size={17}/>{t("games.download.add")}</button></div></header>
    {!downloads.available?<div className="games-retro-desktop"><Monitor size={32}/><h3>{t("games.download.desktopTitle")}</h3><p>{t("games.download.desktopNote")}</p></div>:<>
      <div className="games-download-toolbar"><div className="games-download-filters">{["all","active","complete"].map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{t(`games.download.filter.${value}`)}{value==="active"&&activeCount>0&&<span>{activeCount}</span>}</button>)}</div><div className="games-download-tools"><HoverTooltip label={t("games.cloud.title")}><button className="games-icon-button" onClick={()=>setCloud(true)} aria-label={t("games.cloud.title")}><CloudDownload size={18}/></button></HoverTooltip><GameDownloadSpeed key={downloads.profile} profile={downloads.profile} active={active} available={downloads.available}/><HoverTooltip label={t("games.archive.open")}><button className="games-icon-button" onClick={()=>{setReviewedArchive(null);setArchive("");}} aria-label={t("games.archive.open")}><PackageOpen size={18}/></button></HoverTooltip><HoverTooltip label={t("games.cleanup.title")}><button className="games-icon-button" onClick={()=>setCleanup(true)} aria-label={t("games.cleanup.title")}><Recycle size={18}/></button></HoverTooltip><HoverTooltip label={t("games.library.refresh")}><button className="games-icon-button" onClick={()=>{void downloads.refresh();void torrents.refresh();void preparations.refresh();void archives.refresh();}} disabled={downloads.loading||torrents.loading} aria-label={t("games.library.refresh")}><RefreshCw size={17}/></button></HoverTooltip></div></div>
      {(downloads.loading||torrents.loading)&&!all.length?<div className="games-download-loading" role="status">{t("common.loading")}</div>:!records.length&&!standalone.length?<div className="games-download-empty"><Download size={36}/><h3>{t(query?"games.noResults":"games.download.empty")}</h3><p>{t(query?"games.trySearch":"games.download.emptyNote")}</p></div>:<>
        {featured&&<DownloadActivity key={`${downloads.profile}:${featured.kind}:${featured.record.id}`} item={featured} active={active} setup={installation(featured)} extraction={extraction(featured)} preparation={preparationStatus(featured)}>{featured.kind==="torrent"?<GameTorrentActions record={featured.record} torrents={torrents} onSetup={()=>prepare(featured)} installation={installation(featured)} extraction={extraction(featured)} onDismiss={groupFor(featured)==="complete"?()=>dismiss([featured]):undefined}/>:<TransferActions record={featured.record} downloads={downloads} setup={()=>prepare(featured)} installation={installation(featured)} extraction={extraction(featured)} onDismiss={groupFor(featured)==="complete"?()=>dismiss([featured]):undefined}/>}</DownloadActivity>}
        {sections.map(({group,items})=>items.length>0&&<section className={`games-download-group is-${group}`} key={group} aria-label={t(`games.download.center.${group}`)}><header><h3>{t(`games.download.center.${group}`)} <span>{items.length}</span></h3>{group==="complete"&&<HoverTooltip label={t("games.download.center.keepFiles")}><button className="games-button games-download-clear" onClick={()=>{dismiss(all.filter(item=>groupFor(item)==="complete"));history.setShowHistory(false);}}>{t("games.download.center.clearCompleted")}</button></HoverTooltip>}</header><div className="games-download-list">{items.map(item=>item.kind==="torrent"?<GameTorrentRow key={`torrent:${item.record.id}`} record={item.record} torrents={torrents} queue={queue} onSetup={()=>prepare(item)} installation={installation(item)} extraction={extraction(item)} preparation={preparationStatus(item)} onDismiss={group==="complete"?()=>dismiss([item]):undefined}/>:<TransferRow key={`direct:${item.record.id}`} record={item.record} downloads={downloads} queue={queue} setup={()=>prepare(item)} installation={installation(item)} extraction={extraction(item)} preparation={preparationStatus(item)} onDismiss={group==="complete"?()=>dismiss([item]):undefined}/>)}</div></section>)}
      </>}
      <GameArchiveJobs jobs={standalone} archives={archives} review={reviewArchive} prepare={setSetup}/>
      <div className="games-download-history"><p>{t("games.download.center.retention")}</p>{hiddenCount>0&&<button className="games-text-action" onClick={()=>{if(!history.showHistory)setFilter("complete");history.setShowHistory(value=>!value);}}>{t(history.showHistory?"games.download.center.hideHistory":"games.download.center.showHistory",{count:hiddenCount})}</button>}</div>
      <GameDownloadStorage profile={downloads.profile} active={active} available={downloads.available} items={all}/>
    </>}
    {downloads.error&&<div className="games-retro-error" role="alert"><span>{t(downloads.error)}</span><button className="games-icon-button" onClick={downloads.dismissError} aria-label={t("common.close")}><X size={17}/></button></div>}
    {torrents.error&&<div className="games-retro-error" role="alert"><span>{t(torrents.error)}</span><button className="games-icon-button" onClick={torrents.dismissError} aria-label={t("common.close")}><X size={17}/></button></div>}
    {archives.error&&archive===null&&<div className="games-retro-error" role="alert"><span>{t(archives.error)}</span><button className="games-icon-button" onClick={archives.dismissError} aria-label={t("common.close")}><X size={17}/></button></div>}
    {preparations.error&&!reviewPreparation&&<div className="games-retro-error" role="alert"><span>{t(preparations.error)}</span><button className="games-button" disabled={preparations.loading} onClick={()=>void preparations.refresh()}>{t("common.retry")}</button></div>}
    {reviewedChoice&&active&&<GamePreparationReview key={`${downloads.profile}:${reviewedChoice.target.engine}:${reviewedChoice.target.downloadId}`} choice={reviewedChoice} saved={preparations.choices.some(choice=>choice.id===reviewedChoice.id)} preparations={preparations} onClose={()=>setReviewPreparation(null)}/>}
    {adding&&<NewDownload downloads={downloads} onClose={()=>setAdding(false)}/>}
    {cloud&&<GameCloudDialog downloads={downloads} keys={cloudKeys} openSettings={openSourceSettings} onClose={()=>setCloud(false)}/>}
    {cleanup&&active&&<GameArchiveCleanup key={downloads.profile} profile={downloads.profile} jobs={archives.jobs} onClose={()=>setCleanup(false)}/>}
    {archive!==null&&<GameArchiveDialog profile={downloads.profile} source={archive} initialJob={reviewedArchive??undefined} archives={archives} originSource={reviewedArchive?.originSource} game={reviewedArchive?.game??undefined} onClose={()=>{setArchive(null);setReviewedArchive(null);}} openLibrary={openLibrary} onPrepared={receipt=>{setArchive(null);setSetup({source:receipt.destination,originSource:reviewedArchive?.originSource??receipt.source,name:reviewedArchive?.game?.name??archiveFolder(receipt.source),game:reviewedArchive?.game??undefined});setReviewedArchive(null);}}/>}
    {setup&&active&&<GameSetupDialog key={`${downloads.profile}:${setup.source}`} profile={downloads.profile} source={setup} archives={archives} library={customLibrary} jobs={setupState.jobs} acceptJob={setupState.accept} registering={setupState.registering} registrationErrors={setupState.registrationErrors} onClose={()=>setSetup(null)} onTorrent={path=>torrents.begin(path,setup.game,true)} openLibrary={openLibrary}/>}
  </section></DownloadSourceArtworkContext.Provider>;
}
function TransferRow({record,downloads,queue,setup,installation,onDismiss,extraction,preparation}:{preparation?:ReactNode;extraction?:ArchiveJob;onDismiss?:()=>void;record:GameTransfer;downloads:GameTransfers;queue:DownloadItem[];setup:()=>void;installation?:DownloadSetup}){
  const [expanded,setExpanded]=useState(false),detailsId=useId();
  const t=useT(),busy=downloads.busy.length>0,active=isTransferActive(record.status),game=downloadGame(record);
  const progress=transferProgressBytes(record);
  const percent=record.status==="complete"?100:progress.total?Math.min(100,progress.received/progress.total*100):undefined;
  const host=(()=>{try{return new URL(record.url).hostname;}catch{return "";}})();
  const error=record.error?`games.download.${record.error}`:null;
  return <article data-transfer-id={record.id} data-download-key={`direct:${record.id}`} className={`games-download-row is-${record.status}`}>
    <DownloadArtwork item={{kind:"direct",record}}/>
    <div className="games-download-info"><div className="games-download-name"><h3>{game?.name??record.name}</h3><DownloadContentInfo item={{kind:"direct",record}} details={detailsId} expanded={expanded} toggle={()=>setExpanded(value=>!value)}/>{installation?<DownloadSetupStatus setup={installation}/>:extraction?<ArchiveJobStatus job={extraction}/>:!preparation&&<span>{t(transferStateKey(record))}</span>}</div><span className="games-download-host" title={game?.name&&game.name!==record.name?record.name:undefined}>{game?.sourceName??host}{game?.name&&game.name!==record.name&&<> · {record.name}</>}</span>
      {record.status!=="canceled"&&<><div className={`games-download-progress${percent===undefined&&active?" is-indeterminate":""}`} role="progressbar" aria-label={t("games.download.progress",{name:record.name})} aria-valuenow={percent===undefined?undefined:Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${percent??0}%`}}/></div><div className="games-download-stats"><span dir="ltr">{transferBytes(progress.received)}{progress.total!==null&&<> / {transferBytes(progress.total)}</>}</span>{record.bytesPerSecond>0&&record.status==="downloading"&&<span dir="ltr">{transferBytes(record.bytesPerSecond)}/s</span>}{record.status==="complete"&&record.expectedSha256&&<span><Check size={12}/>{t("games.download.verified")}</span>}</div></>}
      {preparation}
      <DownloadCompletedDate item={{kind:"direct",record}}/>
      {error&&<p className="games-download-error">{t(error)}</p>}
    </div>
    <div className="games-download-actions">
      <DownloadQueueActions item={{kind:"direct",record}} queue={queue} busy={busy} action={direction=>downloads.action(record.id,direction)}/>
      <TransferActions record={record} downloads={downloads} setup={setup} installation={installation} extraction={extraction} onDismiss={onDismiss}/>
      
    </div>
    <div className="games-download-details" id={detailsId} hidden={!expanded}><p className="games-download-detail-name">{record.name}</p><dl><dt>{t("games.download.center.contentInfo")}</dt><dd>{t(downloadContentLabel({kind:"direct",record}))} · {t("games.download.center.fileCount",{count:1})}</dd><dt>{t("games.download.destination")}</dt><dd>{record.destination}</dd>{record.sha256&&<><dt>SHA-256</dt><dd><code>{record.sha256}</code></dd></>}</dl></div>
  </article>;
}
function TransferActions({record,downloads,setup,installation,onDismiss,extraction}:{extraction?:ArchiveJob;onDismiss?:()=>void;record:GameTransfer;downloads:GameTransfers;setup:()=>void;installation?:DownloadSetup}){
  const t=useT(),relink=useSourceRelink(),busy=downloads.busy.includes(record.id),active=isTransferActive(record.status),waiting=["pausing","canceling"].includes(record.status);
  return <div className="games-download-action-set">
    {relink&&["paused","failed"].includes(record.status)&&<HoverTooltip label={t("games.download.relink.title")}><button className="games-icon-button" disabled={busy} onClick={()=>relink(record)} aria-label={t("games.download.relink.title")}><Link2 size={19}/></button></HoverTooltip>}
    {record.status==="complete"&&<HoverTooltip label={t(extraction&&!installation?(extraction.status==="complete"?"games.archive.continueSetup":"games.archive.review"):installation?.phase==="attention"?"games.setup.review":installation?"games.setup.viewProgress":"games.setup.action")}><button className="games-icon-button games-download-primary-action" onClick={setup} aria-label={t(extraction&&!installation?(extraction.status==="complete"?"games.archive.continueSetup":"games.archive.review"):installation?.phase==="attention"?"games.setup.review":installation?"games.setup.viewProgress":"games.setup.named",{name:record.name})}>{(setupIsBusy(installation)||extraction?.status==="running")?<LoaderCircle className="games-download-spinner" size={23}/>:installation?.phase==="ready"?<Check size={23}/>:installation?<ScanSearch size={23}/>:<PackageOpen size={23}/>}</button></HoverTooltip>}
    {active&&!waiting&&<HoverTooltip label={t("games.download.pauseShort")}><button className="games-icon-button games-download-primary-action" disabled={busy} onClick={event=>runDownloadAction(event.currentTarget,()=>downloads.action(record.id,"pause"),"direct",record.id)} aria-label={t("games.download.pause",{name:record.name})}><Pause size={21}/></button></HoverTooltip>}
    {["paused","failed"].includes(record.status)&&<HoverTooltip label={t(record.status==="failed"?"common.retry":"games.download.resumeShort")}><button className="games-icon-button games-download-primary-action" disabled={busy} onClick={event=>runDownloadAction(event.currentTarget,()=>downloads.action(record.id,"resume"),"direct",record.id)} aria-label={t("games.download.resume",{name:record.name})}><Play size="var(--games-transfer-play-size, 23px)"/></button></HoverTooltip>}
    {record.status==="complete"&&<HoverTooltip label={t("games.download.revealShort")}><button className="games-icon-button" onClick={()=>void downloads.reveal(record)} aria-label={t("games.download.reveal",{name:record.name})}><FolderOpen size={20}/></button></HoverTooltip>}
    {onDismiss&&<HoverTooltip label={t("games.download.center.keepFiles")}><button className="games-icon-button" onClick={onDismiss} aria-label={t("games.download.center.dismiss",{name:downloadGame(record)?.name??record.name})}><X size={18}/></button></HoverTooltip>}
    {!onDismiss&&!active&&<HoverTooltip label={t(record.status==="complete"?"games.download.removeComplete":"games.download.removePartial")}><button className="games-icon-button" disabled={busy||setupIsBusy(installation)||extraction?.status==="running"} onClick={event=>runDownloadAction(event.currentTarget,()=>downloads.action(record.id,"remove"),"direct",record.id)} aria-label={t("games.download.remove",{name:record.name})}><Trash2 size={18}/></button></HoverTooltip>}
    {active&&!waiting&&<HoverTooltip label={t("games.download.cancelShort")}><button className="games-icon-button" disabled={busy} onClick={event=>runDownloadAction(event.currentTarget,()=>downloads.action(record.id,"cancel"),"direct",record.id)} aria-label={t("games.download.cancel",{name:record.name})}><X size={20}/></button></HoverTooltip>}
  </div>;
}
function NewDownload({downloads,onClose}:{downloads:GameTransfers;onClose:()=>void}){
  const t=useT(),titleId=useId(),{closing,close}=useModalExit(onClose);
  const [url,setUrl]=useState(""),[name,setName]=useState(""),[hash,setHash]=useState("");
  const body=useRef<HTMLFormElement>(null),input=useRef<HTMLInputElement>(null);const busy=downloads.busy.includes("new");
  useSectionBack(()=>{if(!busy)close();},true);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;input.current?.focus({preventScroll:true});const trap=(event:KeyboardEvent)=>{if(event.key!=="Tab"||(event.target as Element)?.closest?.('[data-dropdown-menu]')||[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1)!==body.current?.closest('[role="dialog"]'))return;const items=[...body.current!.querySelectorAll<HTMLElement>('input,button:not(:disabled),summary')].filter(el=>el.getClientRects().length);if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0]?.focus();}};document.addEventListener("keydown",trap);return()=>{document.removeEventListener("keydown",trap);previous?.focus({preventScroll:true});};},[]);
  return <ModalShell closing={closing} onDismiss={()=>{if(!busy)close();}} width={540} labelledBy={titleId} backdropClassName="games-match-backdrop"><form ref={body} className="games-download-form" onSubmit={event=>{event.preventDefault();void downloads.start({url:url.trim(),name:name.trim()||undefined,expectedSha256:hash.trim()||undefined}).then(started=>{if(started)close();});}}>
    <header><h2 id={titleId}>{t("games.download.add")}</h2><button type="button" className="games-icon-button" disabled={busy} onClick={close} aria-label={t("common.close")}><X size={19}/></button></header>
    <p>{t("games.download.directNote")}</p><label>{t("games.download.url")}<input ref={input} type="url" required value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://" disabled={busy}/></label><label>{t("games.download.name")}<input value={name} onChange={e=>setName(e.target.value)} maxLength={500} disabled={busy}/></label><details><summary>{t("games.download.checksum")}</summary><label>SHA-256<input value={hash} onChange={e=>setHash(e.target.value)} placeholder={t("games.download.hashPlaceholder")} pattern="[a-fA-F0-9]{64}" disabled={busy}/></label><p>{t("games.download.hashNote")}</p></details>
    {downloads.error&&<p role="alert">{t(downloads.error)}</p>}
    <footer><button className="games-button games-button-primary" type="submit" disabled={busy||!url.trim()}><Download size={17}/>{t(busy?"common.loading":"games.download.chooseDestination")}</button></footer>
  </form></ModalShell>;
}

