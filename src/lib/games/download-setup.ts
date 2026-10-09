import type { CustomGame } from "./custom-library";
import { downloadGroup, downloadSummary, type DownloadGroup, type DownloadItem } from "./download-presentation";
import { setupRunStage, setupVerificationFailed } from "./setup-progress";
import { setupJobForSource, type SetupJob } from "./setup";
import { registeredArchiveGame, registeredSetupGame } from "./setup-context";
import { archiveNeedsAttention, archiveSetupSource, downloadArchive, type ArchiveJob } from "./archives";

export type DownloadSetup = { job: SetupJob; phase: "installing" | "checking" | "registering" | "ready" | "attention"; game?: CustomGame; error?: string }
  | { job?: undefined; archive: ArchiveJob; phase: "ready"; game: CustomGame; error?: undefined };

/** A completed transfer is only the input to setup, not evidence of a playable game. */
export function downloadSetup(item: DownloadItem, profile: string, jobs: SetupJob[], games: CustomGame[], registering: string[], errors: Record<string, string>, archives: ArchiveJob[] = []): DownloadSetup | undefined {
  if (item.record.status !== "complete" || item.record.profile !== profile) return;
  const archive = downloadArchive(item, profile, archives), extracted = archive && archiveSetupSource(archive);
  if (archive && !extracted) return;
  const job = setupJobForSource(jobs.filter(job => job.profile === profile && (!archive || job.startedAt >= archive.startedAt)), extracted?.source ?? item.record.destination);
  if (!job) {
    const game = archive && registeredArchiveGame(archive, games);
    return archive && game ? { archive, phase: "ready", game } : undefined;
  }
  if (job.status === "running") return { job, phase: job.progress?.stage === "checking" ? "checking" : "installing" };
  if (setupVerificationFailed(job)) return { job, phase: "attention", error: "games.setup.setup_verification" };
  if (registering.includes(job.id)) return { job, phase: "registering" };
  const game = registeredSetupGame(job, item.record.game?.name ?? item.record.name, games);
  if (game) return { job, phase: "ready", game };
  return { job, phase: "attention", error: errors[job.id] };
}

export const setupIsBusy = (setup?: DownloadSetup) => setup?.phase === "installing" || setup?.phase === "checking" || setup?.phase === "registering";
export const downloadSetupGroup = (item: DownloadItem, setup?: DownloadSetup, archive?: ArchiveJob): DownloadGroup => archive?.status === "running" || setupIsBusy(setup) ? "active" : archiveNeedsAttention(archive) || setup?.phase === "attention" ? "attention" : downloadGroup(item);
export function downloadSetupSummary(items: DownloadItem[], resolve: (item: DownloadItem) => DownloadSetup | undefined, archives: ArchiveJob[] = []) {
  const summary = downloadSummary(items);
  const claimed = new Set(archives.filter(archive => items.some(item => !!downloadArchive(item, item.record.profile, [archive]))).map(archive => archive.id));
  for (const item of items) {
    if (item.record.status !== "complete") continue;
    const archive = downloadArchive(item, item.record.profile, archives);
    if (archive) claimed.add(archive.id);
    if (archive?.status === "running") { summary.total++; summary.active++; continue; }
    if (archiveNeedsAttention(archive)) { summary.total++; summary.failed++; continue; }
    const setup = resolve(item);
    if (setupIsBusy(setup)) { summary.total++; summary.active++; }
    else if (setup?.phase === "attention") { summary.total++; summary.failed++; }
  }
  for (const archive of archives) {
    if (claimed.has(archive.id)) continue;
    if (archive.status === "running") { summary.total++; summary.active++; }
    else if (archiveNeedsAttention(archive)) { summary.total++; summary.failed++; }
  }
  return summary;
}
export function downloadSetupLabel(setup: DownloadSetup, now = Date.now()) {
  if (setup.phase === "ready") return "games.setup.phase.ready";
  if (!setup.job) return "games.setup.review";
  if (!setupIsBusy(setup) && (setup.job.error === "setup_verification" || setupVerificationFailed(setup.job))) return "games.setup.state.verificationFailed";
  if (setup.job.error === "setup_verification_unknown") return "games.setup.state.verificationUnknown";
  if (setup.job.error === "setup_review") return "games.setup.review";
  if (setup.phase === "checking") return "games.setup.state.checking";
  if (setup.phase === "registering") return "games.setup.registering";
  if (setup.phase === "installing" && setup.job.status === "running") return `games.setup.state.${setupRunStage(setup.job, now)}`;
  if (setup.job.status === "finished") return "games.setup.review";
  return `games.setup.state.${setup.phase === "installing" && setup.job.destination ? "installing" : setup.job.status}`;
}
