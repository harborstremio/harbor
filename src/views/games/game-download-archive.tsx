import { useRef, useState, type ReactNode } from "react";
import { FolderOpen, PackageOpen, ScanSearch, X } from "lucide-react";
import { LoaderCircle } from "@/components/icons/music-icons";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT, useUiLanguage } from "@/lib/i18n";
import { archiveError, archiveJobLabel, archiveProgressPercent, archiveSetupSource, type ArchiveJob } from "@/lib/games/archives";
import { transferBytes } from "@/lib/games/transfers";
import type { GameArchives } from "@/hooks/use-game-archives";
import type { SetupSource } from "@/lib/games/setup";
import "./game-download-setup.css";

export function ArchiveJobStatus({ job }: { job: ArchiveJob }) {
  const t = useT();
  return <span className="games-download-setup-status" role="status">{job.status === "running" && <LoaderCircle className="games-download-spinner" size={14} aria-hidden/>}{t(archiveJobLabel(job))}</span>;
}

export function ArchiveJobProgress({ job, compact = false, actions }: { job: ArchiveJob; compact?: boolean; actions?: ReactNode }) {
  const t = useT(), language = useUiLanguage(), percent = archiveProgressPercent(job), progress = job.progress;
  return <div className={`games-download-install-progress${compact ? " is-compact" : ""}`}>
    <div className="games-download-install-heading"><ArchiveJobStatus job={job}/>{percent !== undefined && job.status === "running" && <strong dir="ltr">{Math.floor(percent)}<small>%</small></strong>}</div>
    {job.status === "running" && <div className={`games-download-progress${percent === undefined ? " is-indeterminate" : ""}`} role="progressbar" aria-label={t(archiveJobLabel(job))} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={percent === undefined ? undefined : { width: `${percent}%` }}/></div>}
    {progress && <div className="games-download-install-current"><span>{t("games.archive.progressFiles", { count: progress.files.toLocaleString(language), total: progress.totalFiles.toLocaleString(language) })} · {transferBytes(progress.bytes)} / {transferBytes(progress.totalBytes)}</span>{progress.currentFile && <strong dir="auto" title={progress.currentFile}>{progress.currentFile}</strong>}</div>}
    {!compact && <div className="games-download-install-destination"><FolderOpen size={15} aria-hidden/><span dir="ltr" title={job.destination}>{job.destination.replace(/^\\\\\?\\/, "")}</span></div>}
    {job.error && <p className="games-download-error" role="alert">{t(archiveError(job.error))}</p>}
    {actions && <div className="games-download-install-footer">{actions}</div>}
  </div>;
}

export function GameArchiveJobs({ jobs, archives, review, prepare }: { jobs: ArchiveJob[]; archives: GameArchives; review: (job: ArchiveJob) => void; prepare: (source: SetupSource) => void }) {
  const t = useT();
  if (!jobs.length) return null;
  return <section className="games-download-group games-download-archive-jobs" aria-label={t("games.archive.jobs")}><header><h3>{t("games.archive.jobs")} <span>{jobs.length}</span></h3></header><div className="games-download-list">{jobs.map(job => <ArchiveRow key={job.id} job={job} archives={archives} review={review} prepare={prepare}/>)}</div></section>;
}

function ArchiveRow({ job, archives, review, prepare }: { job: ArchiveJob; archives: GameArchives; review: (job: ArchiveJob) => void; prepare: (source: SetupSource) => void }) {
  const t = useT(), source = archiveSetupSource(job), [busy, setBusy] = useState(false), [failedArt, setFailedArt] = useState("");
  const row = useRef<HTMLElement>(null);
  const remove = async () => {
    if (busy) return;
    const element = row.current, restore = !!element?.contains(document.activeElement);
    const next = (element?.nextElementSibling ?? element?.previousElementSibling)?.querySelector<HTMLButtonElement>("button");
    setBusy(true);
    try { await archives.action(job, "remove"); }
    finally { setBusy(false); requestAnimationFrame(() => {
      if (restore && !element?.isConnected && document.activeElement === document.body) {
        (next?.isConnected ? next : document.querySelector<HTMLButtonElement>('.games-download-filters button[aria-pressed="true"]'))?.focus({ preventScroll: true });
      }
    }); }
  };
  return <article ref={row} className="games-download-row games-download-archive-row" data-archive-id={job.id}>
    <span className="games-download-art" aria-hidden>{job.game?.artwork && failedArt !== job.game.artwork ? <img src={job.game.artwork} alt="" loading="lazy" onError={() => setFailedArt(job.game!.artwork!)}/> : <PackageOpen/>}</span>
    <div className="games-download-info"><div className="games-download-name"><h3>{job.game?.name ?? job.name}</h3></div><ArchiveJobProgress job={job}/></div>
    <div className="games-download-actions"><div className="games-download-action-set"><HoverTooltip label={t(source ? "games.archive.continueSetup" : "games.archive.review")}><button className="games-icon-button games-download-primary-action" onClick={() => source ? prepare(source) : review(job)} aria-label={t(source ? "games.archive.continueSetup" : "games.archive.review")}>{job.status === "running" ? <LoaderCircle className="games-download-spinner" size={23}/> : <ScanSearch size={23}/>}</button></HoverTooltip>{job.status !== "running" && <HoverTooltip label={t("games.archive.dismissRecord")}><button className="games-icon-button" disabled={busy} onClick={() => void remove()} aria-label={t("games.archive.dismissRecord")}><X size={18}/></button></HoverTooltip>}</div></div>
  </article>;
}
