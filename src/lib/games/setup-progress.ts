import type { SetupJob, SetupProgress, SetupVerification } from "./setup";

export function setupVerification(input?: SetupVerification | null): SetupVerification | undefined {
  if (!input) return;
  const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  const totalFiles = count(input.totalFiles), checked = count(input.checkedFiles);
  const checkedFiles = checked !== undefined && (totalFiles === undefined || checked <= totalFiles) ? checked : undefined;
  return { checkedFiles, totalFiles, badFiles: count(input.badFiles), missingFiles: count(input.missingFiles) };
}

/** A known failed check still blocks registration after live telemetry expires. */
export function setupVerificationFailed(job: SetupJob) {
  const result = setupVerification(job.progress?.verification);
  return (result?.badFiles ?? 0) > 0 || (result?.missingFiles ?? 0) > 0;
}

/** Missing or stale installer signals must never turn into 0%, 100%, or invented ETA. */
export function setupProgress(job: SetupJob, now = Date.now()): SetupProgress | undefined {
  const input = job.progress;
  if (job.status !== "running" || !input || !Number.isFinite(input.observedAt) || now - input.observedAt > 10_000 || input.observedAt - now > 1_000) return;
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  const text = (value: unknown) => typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 500) || undefined : undefined;
  const stage = input.stage === "checking" ? "checking" : "installing";
  const verification = stage === "checking" ? setupVerification(input.verification) : undefined;
  // Checker percentages may describe a single file; overall progress uses verified file counts only.
  const percent = stage === "checking" ? verification?.checkedFiles != null && verification.totalFiles ? verification.checkedFiles / verification.totalFiles * 100 : undefined : number(input.percent);
  return { observedAt: input.observedAt, stage, verification, percent: percent !== undefined && percent <= 100 ? percent : undefined, phase: text(input.phase), currentFile: text(input.currentFile), elapsedSeconds: number(input.elapsedSeconds), remainingSeconds: number(input.remainingSeconds), ioBytesPerSecond: number(input.ioBytesPerSecond), canReveal: input.canReveal === true };
}

export const SETUP_STARTING_MS = 8_000;
export type SetupRunStage = 'starting' | 'waiting' | 'installing' | 'checking';

/** Process launch is not evidence that unpacking began. Remember observed work,
 * while setupProgress separately expires its live percentages and timers. */
export function setupRunStage(job: SetupJob, now = Date.now()): SetupRunStage | undefined {
  if (job.status !== 'running') return;
  if (job.progress?.stage === 'checking') return 'checking';
  const observed = job.progress?.observedAt;
  const reported = observed !== undefined && Number.isFinite(observed) && observed <= now + 1_000 ? setupProgress(job, observed) : undefined;
  const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
  if (reported && (reported.percent != null || reported.phase || reported.currentFile || positive(reported.elapsedSeconds) || positive(reported.remainingSeconds)) || positive(job.activity?.files) || positive(job.activity?.bytes)) return 'installing';
  if (!reported?.canReveal && Number.isFinite(job.startedAt) && job.startedAt <= now + 1_000 && now - job.startedAt < SETUP_STARTING_MS) return 'starting';
  return 'waiting';
}

export function setupDuration(seconds: number) {
  const total = Math.floor(seconds), hours = Math.floor(total / 3600), minutes = Math.floor(total / 60) % 60;
  return `${hours ? `${hours}:` : ""}${String(minutes).padStart(hours ? 2 : 1, "0")}:${String(total % 60).padStart(2, "0")}`;
}
