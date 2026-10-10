import { useState, type ReactNode } from "react";
import { FolderOpen, PackageOpen, Trash2, X } from "lucide-react";
import { LoaderCircle } from "@/components/icons/music-icons";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { archiveError, archiveJobLabel, archiveProgressPercent, type ArchiveJob } from "@/lib/games/archives";
import { transferBytes } from "@/lib/games/transfers";
import type { GameArchives } from "@/hooks/use-game-archives";
import { DownloadSourceIdentity } from "./game-download-source";
import { GameHeroLogo } from "./game-hero-logo";
import "./game-download-setup.css";

export function ArchiveJobStatus({ job }: { job: ArchiveJob }) {
  const t = useT();
  return <span className={`games-download-setup-status is-${job.status === "running" ? "installing" : job.status === "complete" ? "ready" : "attention"}`} role="status">{job.status === "running" && <LoaderCircle className="games-download-spinner" size={15} aria-hidden/>}{t(archiveJobLabel(job))}</span>;
}
export function ArchiveJobProgress({ job, children }: { job: ArchiveJob; children?: ReactNode }) {
  const t = useT(), percent = archiveProgressPercent(job), progress = job.progress;
  return <div className="games-download-install-progress games-archive-job-progress">
    <div className="games-download-install-heading"><ArchiveJobStatus job={job}/>{percent !== undefined && <strong dir="ltr">{percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}<small>%</small></strong>}</div>
    <div className={`games-download-progress${percent === undefined && job.status === "running" ? " is-indeterminate" : ""}`} role="progressbar" aria-label={t(archiveJobLabel(job))} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={percent === undefined ? undefined : { width: `${percent}%` }}/></div>
    {progress && <div className="games-download-stats"><span dir="ltr">{transferBytes(progress.bytes)} / {transferBytes(progress.totalBytes)}</span>{progress.totalFiles > 0 && <span>{t("games.archive.progressFiles", { count: progress.files.toLocaleString(), total: progress.totalFiles.toLocaleString() })}</span>}</div>}
    {progress?.currentFile && <div className="games-download-install-current"><strong dir="auto" title={progress.currentFile}>{progress.currentFile}</strong></div>}
    <div className="games-download-install-destination"><FolderOpen size={15} aria-hidden/><span dir="ltr" title={job.destination}>{job.destination.replace(/^\\\\\?\\/, "")}</span></div>
    {job.error && <p className="games-download-error" role="alert">{t(archiveError(job.error))}</p>}
    {children && <div className="games-download-install-footer">{children}</div>}
  </div>;
}
export function ArchiveJobActions({ job, archives, review, continueSetup }: { job: ArchiveJob; archives: GameArchives; review: () => void; continueSetup: () => void }) {
  const t = useT(), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const act = async (action: () => Promise<unknown>) => { if (busy) return; setBusy(true); setError(""); try { await action(); } catch (reason) { setError(archiveError(reason)); } finally { setBusy(false); } };
  const reveal = async () => { const { revealItemInDir } = await import("@tauri-apps/plugin-opener"); await revealItemInDir(job.receipt?.destination ?? job.stage ?? job.destination); };
  return <div className="games-download-action-set">
    <HoverTooltip label={t(job.status === "complete" ? "games.archive.continueSetup" : "games.archive.review")}><button className="games-icon-button games-download-primary-action" onClick={job.status === "complete" ? continueSetup : review} aria-label={t(job.status === "complete" ? "games.archive.continueSetup" : "games.archive.review")}>{job.status === "running" ? <LoaderCircle className="games-download-spinner" size={23}/> : <PackageOpen size={23}/>}</button></HoverTooltip>
    {job.status === "running" ? <HoverTooltip label={t("games.archive.cancelExtract")}><button className="games-icon-button" disabled={busy} onClick={() => void act(() => archives.action(job, "cancel"))} aria-label={t("games.archive.cancelExtract")}><X size={20}/></button></HoverTooltip> : <>
      <HoverTooltip label={t(job.receipt ? "games.archive.openFolder" : "games.archive.showPartial")}><button className="games-icon-button" disabled={busy} onClick={() => void act(reveal)} aria-label={t(job.receipt ? "games.archive.openFolder" : "games.archive.showPartial")}><FolderOpen size={20}/></button></HoverTooltip>
      <HoverTooltip label={t("games.archive.dismissRecord")}><button className="games-icon-button" disabled={busy} onClick={() => void act(() => archives.action(job, "remove"))} aria-label={t("games.archive.dismissRecord")}><Trash2 size={18}/></button></HoverTooltip>
    </>}{error && <span role="alert" className="games-download-error">{t(error)}</span>}
  </div>;
}
export function ArchiveJobCard({ job, archives, hero = false, review, continueSetup }: { job: ArchiveJob; archives: GameArchives; hero?: boolean; review: () => void; continueSetup: () => void }) {
  const t = useT(), [failed, setFailed] = useState(false), game = job.game;
  const actions = <ArchiveJobActions job={job} archives={archives} review={review} continueSetup={continueSetup}/>;
  const art = <span className={hero ? "games-download-feature-art" : "games-download-art"} aria-hidden>{game?.artwork && !failed ? <img src={game.artwork} alt="" loading={hero ? "eager" : "lazy"} onError={() => setFailed(true)}/> : !hero && <PackageOpen size={30}/>}</span>;
  return hero ? <section className="games-download-feature is-extracting" aria-label={t("games.archive.jobs")} data-archive-job={job.id}>
    {art}<div className="games-download-feature-title">{game?.logo && <GameHeroLogo sources={[game.logo]} name={game.name} platformIds={[]} ready active className="games-download-feature-logo"/>}<h3>{game?.name ?? job.name}</h3><DownloadSourceIdentity name={game?.sourceName ?? ""} release={job.source.split(/[\\/]/).at(-1)}/></div>
    <div className="games-download-feature-activity"><ArchiveJobProgress job={job}>{actions}</ArchiveJobProgress></div>
  </section> : <article className="games-download-row is-extracting" data-archive-job={job.id}>
    {art}<div className="games-download-info"><div className="games-download-name"><h3>{game?.name ?? job.name}</h3></div><ArchiveJobProgress job={job}/></div><div className="games-download-actions">{actions}</div>
  </article>;
}
