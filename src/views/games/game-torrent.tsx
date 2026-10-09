import {GameTorrentSharing} from "./game-torrent-sharing";
import {DownloadQueueActions} from "./game-download-queue";
import type {DownloadItem} from "@/lib/games/download-presentation";
import { Play } from "@/components/icons/play-filled";
import {downloadContentLabel} from "@/lib/games/download-content";
import type { ArchiveJob } from "@/lib/games/archives";
import { ArchiveJobStatus } from "./game-download-archive";
import {DownloadContentInfo} from "./game-download-content";
import { useId, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, FolderOpen, PackageOpen, ScanSearch, Trash2, X } from "lucide-react";
import { LoaderCircle, Pause } from "@/components/icons/music-icons";
import { HoverTooltip } from "@/components/hover-tooltip";
import { DownloadArtwork, runDownloadAction } from "./game-download-activity";
import { downloadGame, downloadProgress } from "@/lib/games/download-presentation";
import { useT } from "@/lib/i18n";
import { torrentActive, torrentError, type GameTorrent } from "@/lib/games/torrents";
import { transferBytes } from "@/lib/games/transfers";
import type { GameTorrents } from "@/hooks/use-game-torrents";
import { setupIsBusy, type DownloadSetup } from "@/lib/games/download-setup";
import { DownloadSetupStatus } from "./game-download-setup";
import "./game-torrent.css";
import {DownloadCompletedDate} from "./game-download-completed";
export { GameTorrentDialog } from "./game-torrent-dialog";
export function GameTorrentRow({ record, torrents, queue=[], onSetup, installation, onDismiss, extraction, preparation }: { preparation?:ReactNode; queue?:DownloadItem[]; extraction?: ArchiveJob; onDismiss?:()=>void; record: GameTorrent; torrents: GameTorrents; onSetup?: () => void; installation?: DownloadSetup }) {
  const t = useT(), percent = downloadProgress(record.received, record.totalBytes), game = downloadGame(record), [expanded, setExpanded] = useState(false), detailsId = useId();
  return <article data-torrent-id={record.id} data-download-key={`torrent:${record.id}`} className={`games-download-row games-torrent-row is-${record.status}`}>
    <DownloadArtwork item={{kind:"torrent",record}}/>
    <div className="games-download-info"><div className="games-download-name"><h3>{game?.name??record.name}</h3><DownloadContentInfo item={{kind:"torrent",record}} details={detailsId} expanded={expanded} toggle={()=>setExpanded(value=>!value)}/>{installation?<DownloadSetupStatus setup={installation}/>:extraction?<ArchiveJobStatus job={extraction}/>:!preparation&&<span>{t(`games.torrent.state.${record.status}`)}</span>}</div>
      <span className="games-download-host" title={game?.name&&game.name!==record.name?record.name:undefined}>{game?.sourceName??t("games.sources.art.engine")} · {game?.name&&game.name!==record.name?record.name:t("games.torrent.fileCount", { count: record.selected.length })}</span>
      <div className="games-download-progress" role="progressbar" aria-label={t("games.download.progress", { name: record.name })} aria-valuenow={percent===undefined?undefined:Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent??0}%` }} /></div>
      <div className="games-download-stats"><span dir="ltr">{transferBytes(record.received)} / {transferBytes(record.totalBytes)}</span>{record.status === "downloading" && <><span dir="ltr"><ArrowDown size={12} />{transferBytes(record.bytesPerSecond)}/s</span><span dir="ltr"><ArrowUp size={12} />{transferBytes(record.uploadPerSecond)}/s</span><span>{t("games.torrent.peers", { count: record.peers })}</span></>}{record.status === "complete" && <span><Check size={12} />{t("games.torrent.verified")}</span>}</div>
      {preparation}
      <DownloadCompletedDate item={{kind:"torrent",record}}/>
      {record.error && <p className="games-download-error" role="status">{t(torrentError(record.error))}</p>}
      
    </div><div className="games-download-actions"><DownloadQueueActions item={{kind:"torrent",record}} queue={queue} busy={torrents.busy.length>0} action={direction=>torrents.action(record.id,direction)}/><GameTorrentActions record={record} torrents={torrents} onSetup={onSetup} installation={installation} onDismiss={onDismiss} extraction={extraction}/></div>
    <div className="games-download-details" id={detailsId} hidden={!expanded}><p className="games-download-detail-name">{record.name}</p><dl><dt>{t("games.download.center.contentInfo")}</dt><dd>{t(downloadContentLabel({kind:"torrent",record}))} · {t("games.download.center.fileCount",{count:record.selected.length})}</dd><dt>{t("games.download.destination")}</dt><dd>{record.destination.replace(/^\\\\\?\\/, "")}</dd><dt>{t("games.torrent.identity")}</dt><dd><code>{record.infoHash}</code></dd><dt>{t("games.torrent.bandwidth")}</dt><dd>{t("games.torrent.bandwidthValue", { down: record.downloadBps ? `${transferBytes(record.downloadBps)}/s` : t("games.torrent.unlimited"), up: `${transferBytes(record.uploadBps)}/s` })}</dd></dl><p className="games-torrent-kept-note">{t("games.torrent.keepNote")}</p></div>
  </article>;
}

export function GameTorrentActions({ record, torrents, onSetup, installation, onDismiss, extraction }: { extraction?: ArchiveJob; onDismiss?:()=>void; record: GameTorrent; torrents: GameTorrents; onSetup?: () => void; installation?: DownloadSetup }) {
  const t = useT(), busy = torrents.busy.includes(record.id) || extraction?.status === "running", active = torrentActive(record.status);
  return <div className="games-download-action-set">
    {record.status==="complete"&&<GameTorrentSharing record={record} torrents={torrents} disabled={busy}/>}
    {record.status === "complete" && onSetup && <HoverTooltip label={t(extraction&&!installation?(extraction.status==="complete"?"games.archive.continueSetup":"games.archive.review"):installation?.phase==="attention"?"games.setup.review":installation?"games.setup.viewProgress":"games.setup.action")}><button className="games-icon-button games-download-primary-action" onClick={onSetup} aria-label={t(extraction&&!installation?(extraction.status==="complete"?"games.archive.continueSetup":"games.archive.review"):installation?.phase==="attention"?"games.setup.review":installation?"games.setup.viewProgress":"games.setup.named", { name: record.name })}>{(setupIsBusy(installation)||extraction?.status==="running")?<LoaderCircle className="games-download-spinner" size={23}/>:installation?.phase==="ready"?<Check size={23}/>:installation?<ScanSearch size={23}/>:<PackageOpen size={23}/>}</button></HoverTooltip>}
    {active ? <HoverTooltip label={t("games.download.pauseShort")}><button className="games-icon-button games-download-primary-action" disabled={busy} onClick={event => runDownloadAction(event.currentTarget,()=>torrents.action(record.id,"pause"),"torrent",record.id)} aria-label={t("games.download.pause",{name:record.name})}><Pause size={21}/></button></HoverTooltip> : record.status!=="complete"&&<HoverTooltip label={t(record.status==="failed"?"common.retry":"games.download.resumeShort")}><button className="games-icon-button games-download-primary-action" disabled={busy} onClick={event => runDownloadAction(event.currentTarget,()=>torrents.action(record.id,"resume"),"torrent",record.id)} aria-label={t("games.download.resume",{name:record.name})}><Play size="var(--games-transfer-play-size, 23px)"/></button></HoverTooltip>}
    <HoverTooltip label={t("games.download.revealShort")}><button className="games-icon-button" disabled={busy} onClick={() => void torrents.reveal(record)} aria-label={t("games.download.reveal",{name:record.name})}><FolderOpen size={20}/></button></HoverTooltip>
    {onDismiss?<HoverTooltip label={t("games.download.center.keepFiles")}><button className="games-icon-button" onClick={onDismiss} aria-label={t("games.download.center.dismiss",{name:downloadGame(record)?.name??record.name})}><X size={18}/></button></HoverTooltip>:<HoverTooltip label={t("games.torrent.remove")}><button className="games-icon-button" disabled={busy||setupIsBusy(installation)} onClick={event => runDownloadAction(event.currentTarget,()=>torrents.action(record.id,"remove"),"torrent",record.id)} aria-label={t("games.torrent.remove")}><Trash2 size={18}/></button></HoverTooltip>}
  </div>;
}
