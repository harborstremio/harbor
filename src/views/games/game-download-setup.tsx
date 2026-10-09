import { useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Clock3, FolderOpen, PanelTop } from "lucide-react";
import { LoaderCircle } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { osClass } from "@/lib/platform";
import { downloadSetupLabel, setupIsBusy, type DownloadSetup } from "@/lib/games/download-setup";
import { setupError, type SetupJob } from "@/lib/games/setup";
import { SETUP_STARTING_MS, setupDuration, setupProgress, setupRunStage } from "@/lib/games/setup-progress";
import { useInstallerObservation } from "@/hooks/use-installer-observation";
import { transferBytes } from "@/lib/games/transfers";
import "./game-download-setup.css";

export function DownloadSetupStatus({ setup, now: sharedNow }: { setup: DownloadSetup; now?: number }) {
  const t = useT();
  const time = useInstallerClock(setup.job, sharedNow === undefined), now = sharedNow ?? time;
  const waiting = setup.phase === 'installing' && setup.job && setupRunStage(setup.job, now) === 'waiting';
  return <span className={`games-download-setup-status is-${setup.phase}`} role="status">{setupIsBusy(setup) && (waiting ? <Clock3 size={14} aria-hidden/> : <LoaderCircle className="games-download-spinner" size={14} aria-hidden/>)}{t(downloadSetupLabel(setup, now))}</span>;
}

export function useInstallerClock(job?: SetupJob, active = true) {
  const [tick, refresh] = useState(0);
  useEffect(() => {
    if (!active || job?.status !== "running") return;
    // Job events drive updates. At most two one-shot deadlines cover startup and
    // stale telemetry; a silent installer never starts a renderer polling loop.
    const now = Date.now();
    const deadlines = [job.startedAt + SETUP_STARTING_MS, job.progress ? job.progress.observedAt + 10_001 : NaN].map(at => at - now).filter(delay => Number.isFinite(delay) && delay > 0 && delay <= 11_001);
    const update = () => refresh(value => value + 1);
    const visible = () => { if (document.visibilityState !== "hidden") update(); };
    const timer = deadlines.length ? window.setTimeout(update, Math.min(...deadlines)) : undefined;
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [active, job?.id, job?.status, job?.startedAt, job?.progress?.observedAt, tick]);
  return Date.now();
}

export function DownloadSetupProgress({ setup, compact = false, actions, active = true }: { setup: DownloadSetup; compact?: boolean; actions?: ReactNode; active?: boolean }) {
  const t = useT(), { job } = setup, now = useInstallerClock(job, active), progress = active && job ? setupProgress(job, now) : undefined;
  const root = useRef<HTMLDivElement>(null);
  useInstallerObservation(job, active, root);
  const [revealing, setRevealing] = useState(false), [revealError, setRevealError] = useState(false);
  useEffect(() => { setRevealError(false); }, [job?.id]);
  const reveal = async () => {
    if (!job) return;
    setRevealing(true); setRevealError(false);
    try { await invoke("games_reveal_setup", { profile: job.profile, id: job.id }); }
    catch { setRevealError(true); }
    finally { setRevealing(false); }
  };
  const percent = progress?.percent ?? undefined, checking = setup.phase === "checking", verification = progress?.verification;
  const stage = setup.phase === 'installing' && job ? setupRunStage(job, now) : undefined;
  const waiting = stage === 'starting' || stage === 'waiting';
  const waitingNote = stage === 'starting' ? 'startingNote' : progress?.canReveal ? 'continueInstaller' : job?.engine === 'inno' || osClass() === 'windows' ? 'waitingWindows' : 'waitingInstaller';
  const error = setup.error || (job?.error && job.error !== "setup_review" ? setupError(job.error) : "");
  return <div ref={root} data-run-stage={stage} className={`games-download-install-progress${compact ? " is-compact" : ""}${setup.phase === "ready" ? " is-ready" : ""}`}>
    {!waiting && progress && (progress.remainingSeconds != null || progress.elapsedSeconds != null) && <dl className="games-download-meters games-download-install-meters">
      {progress.remainingSeconds != null && <div><dt>{t("games.download.center.timeRemaining")}</dt><dd dir="ltr">{setupDuration(progress.remainingSeconds)}</dd></div>}
      {progress.elapsedSeconds != null && <div><dt>{t("games.setup.elapsed")}</dt><dd dir="ltr">{setupDuration(progress.elapsedSeconds)}</dd></div>}
    </dl>}
    <div className="games-download-install-heading"><DownloadSetupStatus setup={setup} now={now}/>{percent !== undefined && <strong dir="ltr">{percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}<small>%</small></strong>}</div>
    {setupIsBusy(setup) && !waiting && <div className={`games-download-progress${percent === undefined ? " is-indeterminate" : ""}`} role="progressbar" aria-label={t(downloadSetupLabel(setup, now))} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={percent === undefined ? undefined : { width: `${percent}%` }}/></div>}
    {(setup.phase === "installing" || checking) && <div className="games-download-install-current"><span>{waiting ? t(`games.setup.${waitingNote}`) : checking ? verification?.checkedFiles != null && verification.totalFiles ? t("games.setup.checkedFiles", { count: verification.checkedFiles.toLocaleString(), total: verification.totalFiles.toLocaleString() }) : t("games.setup.checkingPending") : progress?.phase || t(percent === undefined ? "games.setup.progressPending" : "games.setup.state.installing")}</span>{progress?.currentFile && <strong dir="auto" title={progress.currentFile}>{progress.currentFile}</strong>}</div>}
    {checking && ((verification?.badFiles ?? 0) > 0 || (verification?.missingFiles ?? 0) > 0) && <p className="games-download-error" role="status">{t("games.setup.checkProblems", { bad: (verification?.badFiles ?? 0).toLocaleString(), missing: (verification?.missingFiles ?? 0).toLocaleString() })}</p>}
    {job?.activity && (job.activity.bytes > 0 || job.activity.files > 0) && !waiting && !checking && setup.phase !== "ready" && (!compact || percent === undefined) && <div className="games-download-install-activity" title={t("games.setup.observedFiles")}><span>{job.activity.truncated && "≥ "}{t("games.setup.activity", { size: transferBytes(job.activity.bytes), count: job.activity.files.toLocaleString() })}</span></div>}
    {(!compact || setup.phase === "attention") && job?.destination && <div className="games-download-install-destination"><FolderOpen size={15} aria-hidden/><span title={job.destination} dir="ltr">{job.destination.replace(/^\\\\\?\\/, "")}</span></div>}
    {(progress?.canReveal || actions) && <div className="games-download-install-footer">{progress?.canReveal && <button className="games-button games-download-show-installer" disabled={revealing} onClick={() => void reveal()}><PanelTop size={16}/>{t("games.setup.showInstaller")}</button>}{actions}</div>}
    {revealError && <p className="games-download-error" role="alert">{t("games.setup.setup_window")}</p>}
    {error && <p className="games-download-error" role="alert">{t(error)}</p>}
  </div>;
}
