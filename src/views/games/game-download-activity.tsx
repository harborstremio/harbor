import {transferStateKey,transferProgressBytes} from "@/lib/games/transfer-relink";
import {torrentSharing} from "@/lib/games/torrents";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { LoaderCircle } from "@/components/icons/music-icons";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { appendDownloadSample, downloadGame, downloadProgress, downloadRemaining, DOWNLOAD_HISTORY_SECONDS, type DownloadItem, type DownloadSample } from "@/lib/games/download-presentation";
import { GameHeroLogo } from "./game-hero-logo";
import { DownloadSourceIdentity } from "./game-download-source";
import { transferBytes } from "@/lib/games/transfers";
import type { DownloadSetup } from "@/lib/games/download-setup";
import { DownloadSetupProgress } from "./game-download-setup";
import { DownloadContentIndicator } from "./game-download-content";
import type { ArchiveJob } from "@/lib/games/archives";
import { ArchiveJobProgress } from "./game-download-archive";

export function runDownloadAction(button: HTMLButtonElement, action: () => Promise<unknown>, kind: DownloadItem["kind"], id: string) {
  const focusOwned = document.activeElement === button;
  void action().then(() => requestAnimationFrame(() => {
    if (!focusOwned || (document.activeElement !== document.body && document.activeElement !== button)) return;
    const container = document.querySelector<HTMLElement>(`[data-download-key="${CSS.escape(`${kind}:${id}`)}"]`);
    const target = container?.querySelector<HTMLButtonElement>(".games-download-primary-action:not(:disabled),.games-download-action-set button:not(:disabled)") ?? document.querySelector<HTMLButtonElement>('.games-download-toolbar button[aria-pressed="true"]');
    target?.focus({ preventScroll: true });
  }));
}

export function DownloadArtwork({ item, hero = false }: { item: DownloadItem; hero?: boolean }) {
  const game = downloadGame(item.record), [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [game?.artwork]);
  return <span className={hero ? "games-download-feature-art" : "games-download-art"} aria-hidden="true">{game?.artwork && !failed ? <img src={game.artwork} alt="" loading={hero ? "eager" : "lazy"} onError={() => setFailed(true)} /> : !hero && <HarborMark />}</span>;
}

export function DownloadDetailsButton({ expanded, controls, onClick }: { expanded: boolean; controls: string; onClick: () => void }) {
  const t = useT();
  return <HoverTooltip label={t("games.download.details")}><button className="games-icon-button games-download-details-toggle" aria-label={t("games.download.details")} aria-expanded={expanded} aria-controls={controls} onClick={onClick}><Info size={18}/></button></HoverTooltip>;
}

function PeerConnections() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6.5 7 5.5 9 5.5-9M7.5 6h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="19" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="18" r="3" fill="currentColor"/></svg>;
}

function DownloadGraph({ samples }: { samples: DownloadSample[] }) {
  const t = useT(), end = samples.at(-1)?.time ?? Date.now(), start = end - (DOWNLOAD_HISTORY_SECONDS - 1) * 1000;
  const maximum = Math.max(1, ...samples.map(point => point.network));
  const seedMaximum = Math.max(1, ...samples.map(point => point.seeders ?? 0));
  const x = (time: number) => Math.max(0, Math.min(600, (time - start) / ((DOWNLOAD_HISTORY_SECONDS - 1) * 1000) * 600));
  const y = (value: number) => 85 - value / maximum * 78;
  // Seeder counts use their own scale; missing observations remain gaps.
  let seeds = "", previousSeed = false, previousTime = 0;
  for (const point of samples) { if (point.seeders === undefined) { previousSeed = false; continue; } seeds += `${previousSeed && point.time - previousTime <= 3500 ? " L" : " M"}${x(point.time)},${85 - point.seeders / seedMaximum * 78}`; previousSeed = true; previousTime = point.time; }
  return <svg className="games-download-graph" viewBox="0 0 600 90" preserveAspectRatio="none" role="img" aria-label={[t("games.download.center.graph"), seeds && t("games.download.center.seedersNote")].filter(Boolean).join(". ")}>
    <title>{t("games.download.center.network")}: 0–{transferBytes(maximum)}/s{seeds && ` · ${t("games.download.center.seeders")}: 0–${seedMaximum}`}</title>
    <path className="games-download-graph-base" d="M0 85H600" />
    {samples.map(point => <path key={point.time} className="games-download-graph-network" d={`M${x(point.time)} 85V${y(point.network)}`} />)}
    {seeds && <path className="games-download-graph-seeders" d={seeds} />}
  </svg>;
}

const ARCHIVE_NAME = /\.(rar|zip|7z|tar|gz|bz2|xz)(\.\d{3})?$|\.[r-z]\d{2}$/i;

export function DownloadActivity({ item, active, children, setup, extraction, preparation }: { preparation?:ReactNode; item: DownloadItem; active: boolean; children: ReactNode; setup?: DownloadSetup; extraction?: ArchiveJob }) {
  const t = useT(), record = item.record, game = downloadGame(record), latest = useRef(item);
  latest.current = item;
  const [samples, setSamples] = useState<DownloadSample[]>([]), [peak, setPeak] = useState(record.status === "downloading" ? Math.max(0, record.bytesPerSecond) : 0);
  useEffect(() => {
    if (active && document.visibilityState !== "hidden" && record.status === "downloading") setPeak(old => Math.max(old, record.bytesPerSecond));
  }, [active, record.status, record.bytesPerSecond]);
  useEffect(() => {
    if (!active || setup || extraction) return;
    const sample = () => {
      if (document.visibilityState === "hidden") return;
      const currentItem = latest.current, current = currentItem.record;
      const network = current.status === "downloading" || currentItem.kind === "direct" && current.status === "checking" && currentItem.record.checkingPartial != null ? current.bytesPerSecond : 0;
      const seeders = currentItem.kind === "torrent" && current.status === "downloading" ? currentItem.record.seeders : undefined;
      setSamples(old => appendDownloadSample(old, { time: Date.now(), network, seeders }));
      setPeak(old => Math.max(old, network));
    };
    sample(); const timer = window.setInterval(sample, 1000); return () => window.clearInterval(timer);
  }, [active, setup?.job?.id, setup?.phase, extraction?.id]);
  const progress = item.kind === "torrent" ? {received:record.received,total:item.record.totalBytes} : transferProgressBytes(item.record);
  const {total,received}=progress;
  const percent = downloadProgress(received, total), speed = record.status === "downloading" || item.kind === "direct" && record.status === "checking" && item.record.checkingPartial != null ? record.bytesPerSecond : 0;
  const displayedPeak = Math.max(peak, speed);
  const remaining = record.status === "checking" ? undefined : downloadRemaining(received, total, speed);
  const seeders = item.kind === "torrent" && record.status === "downloading" && Number.isSafeInteger(item.record.seeders) && item.record.seeders! >= 0 ? item.record.seeders : undefined;
  const preparing = ["connecting", "retrying", "checking", "pausing", "canceling"].includes(record.status);
  const source = game?.sourceName ?? (item.kind === "torrent" ? "" : (() => { try { return new URL(item.record.url).hostname; } catch { return ""; } })());
  return <section data-download-key={`${item.kind}:${record.id}`} className={`games-download-feature is-${record.status}`} aria-label={t("games.download.center.current")}>
    <DownloadArtwork item={item} hero />
    <div className="games-download-feature-title">{game?.logo && <GameHeroLogo sources={[game.logo]} name={game.name} platformIds={[]} ready active={active} className="games-download-feature-logo"/>}<h3>{game?.name ?? record.name}</h3><div className="games-download-feature-identity"><DownloadSourceIdentity name={source} release={game?.name && game.name !== record.name ? record.name : undefined} url={!game?.sourceName && item.kind === "direct" ? item.record.url : undefined}/><DownloadContentIndicator item={item}/></div></div>
    {!setup && !extraction && !(preparation && record.status === "complete") && <DownloadGraph samples={samples}/>}
    <div className="games-download-feature-activity">
      {setup ? <DownloadSetupProgress setup={setup} compact actions={children} active={active}/> : extraction ? <ArchiveJobProgress job={extraction} compact actions={children}/> : preparation && record.status === "complete" ? <div className="games-preparation-feature">{preparation}{children}</div> : <>
      {record.status === "complete" ? <p className="games-download-complete-state" role="status">{t(ARCHIVE_NAME.test(item.kind === "direct" ? item.record.destination : record.name) ? "games.download.center.readyToExtract" : "games.download.center.downloadComplete")}</p> : <dl className="games-download-meters"><div><dt><ArrowDown size={13}/>{t("games.download.center.network")}</dt><dd dir="ltr">{transferBytes(speed)}<small>/s</small></dd></div><div><dt><HoverTooltip label={t("games.download.center.measured")}><span tabIndex={0}>{t("games.download.center.peak")}</span></HoverTooltip></dt><dd dir="ltr">{transferBytes(displayedPeak)}<small>/s</small></dd></div>{seeders !== undefined && <div className="games-download-seeders-meter"><dt><HoverTooltip label={t("games.download.center.seedersNote")}><span tabIndex={0}>{t("games.download.center.seeders")}</span></HoverTooltip></dt><dd dir="ltr">{seeders.toLocaleString()}</dd></div>}{item.kind === "torrent" && <div><dt><ArrowUp size={13}/>{t("games.download.center.upload")}</dt><dd dir="ltr">{transferBytes(record.status === "downloading" || torrentSharing(item.record) ? item.record.uploadPerSecond : 0)}<small>/s</small></dd></div>}</dl>}
      <div className="games-download-feature-progress"><strong role="status">{preparing&&<LoaderCircle className="games-download-spinner" size={16} aria-hidden/>}{t(item.kind==="direct"?transferStateKey(item.record):`games.torrent.state.${record.status}`)}</strong><span dir="ltr">{transferBytes(received)}{total !== null && <> / {transferBytes(total)}</>}</span></div>
      <div className={`games-download-progress${percent === undefined ? " is-indeterminate" : ""}`} role="progressbar" aria-label={t("games.download.progress", { name: record.name })} aria-valuenow={percent === undefined ? undefined : Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent ?? 0}%` }}/></div>
      <div className="games-download-feature-footer"><div className="games-download-feature-summary">{preparation || (remaining?<div className="games-download-remaining"><span>{t("games.download.center.timeRemaining")}</span><strong dir="ltr">{remaining}</strong></div>:record.status==="complete"?<span>{t("games.download.center.installNote")}</span>:item.kind!=="torrent"&&<span>{t("games.download.center.measured")}</span>)}{item.kind==="torrent"&&record.status!=="complete"&&<HoverTooltip label={t("games.download.center.connections")} sublabel={t("games.sources.art.engine")}><span className="games-download-connection" tabIndex={0}><PeerConnections/><span>{t("games.torrent.peers",{count:item.record.peers})}</span></span></HoverTooltip>}</div>{children}</div>
      </>}
    </div>
  </section>;
}
