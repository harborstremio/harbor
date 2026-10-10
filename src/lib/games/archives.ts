import type { DownloadGame } from "./transfers";
import type { DownloadItem } from "./download-presentation";
import { setupPath } from "./setup";
import { archivePartName } from "./archive-parts";

export type ArchiveEntry = { path: string; bytes: number; directory: boolean };
export type ArchivePart = { name: string; bytes: number; sha256: string };
export type ArchivePlan = { token: string; source: string; archiveBytes: number; expandedBytes: number; fileCount: number; directoryCount: number; sha256: string; entries: ArchiveEntry[]; executableCount: number; parts?: ArchivePart[] };
export type ArchiveReceipt = { destination: string; source: string; sha256: string; files: number; bytes: number; parts?: ArchivePart[] };
export type ArchiveSpace = { volume: string | null; availableBytes: number | null; expandedBytes: number; reservedBytes: number; afterBytes: number | null; shortfallBytes: number | null };
export type ArchiveProgress = { profile: string; operationId: string; phase: "checking" | "extracting" | "publishing" | "complete"; bytes: number; totalBytes: number; files: number; totalFiles: number; currentFile?: string | null };
export type ArchiveJob = {
  id: string; profile: string; source: string; originSource: string; name: string; game?: DownloadGame | null;
  destination: string; stage?: string | null; status: "running" | "complete" | "failed" | "canceled" | "interrupted";
  progress?: ArchiveProgress | null; receipt?: ArchiveReceipt | null; error?: string | null; startedAt: number; updatedAt: number;
};
const errors = new Set(["archive_profile", "archive_busy", "archive_canceled", "archive_read", "archive_links", "archive_limit", "archive_changed", "archive_path", "archive_format", "archive_encrypted", "archive_password", "archive_password_or_checksum", "archive_decoder", "archive_compression", "archive_collision", "archive_destination", "archive_write", "archive_exists", "archive_platform", "archive_expired", "archive_space", "archive_checksum", "archive_store", "archive_start", "archive_history", "archive_interrupted", "archive_multipart", "archive_parts", "archive_missing_part"]);
export function archiveError(error: unknown) { const code = error instanceof Error ? error.message : String(error); return /command.*not found|unknown command/i.test(code) ? "games.archive.unavailable" : `games.archive.${errors.has(code) ? code : "archive_read"}`; }
export function archiveFolder(source: string) {
  const filename = source.split(/[\\/]/).pop() || "";
  const name = archivePartName(filename)?.name ?? filename.replace(/\.(?:tar\.gz|tgz|tar|zip|7z|rar|iso)$/i, "");
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").slice(0, 180) || "Game files";
}
export function archiveDestinationParts(destination: string) {
  const path = destination.replace(/[\\/]+$/, ""), split = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return { parent: split === 0 || /^[a-z]:[\\/]$/i.test(path.slice(0, split + 1)) ? path.slice(0, split + 1) : path.slice(0, split), name: path.slice(split + 1) };
}

export function mergeArchiveJob(jobs: ArchiveJob[], incoming: ArchiveJob, profile: string) {
  if (incoming.profile !== profile) return jobs;
  const previous = jobs.find(job => job.id === incoming.id);
  if (previous && (previous.updatedAt > incoming.updatedAt || previous.status !== "running" && incoming.status === "running")) return jobs;
  return [incoming, ...jobs.filter(job => job.id !== incoming.id)].sort((a, b) => b.startedAt - a.startedAt).slice(0, 200);
}
export function downloadArchive(item: DownloadItem, profile: string, jobs: ArchiveJob[]) {
  if (item.record.profile !== profile || item.record.status !== "complete") return;
  return sourceArchive(item.record.destination, profile, jobs);
}
export function sourceArchive(source: string, profile: string, jobs: ArchiveJob[]) {
  return jobs.filter(job => job.profile === profile && [job.originSource, job.source].some(path => setupPath(path) === setupPath(source))).sort((a, b) => b.startedAt - a.startedAt || b.updatedAt - a.updatedAt)[0];
}
export function archiveSetupSource(job: ArchiveJob) {
  if (job.status !== "complete" || !job.receipt || setupPath(job.receipt.destination) !== setupPath(job.destination)) return;
  return { source: job.receipt.destination, originSource: job.originSource, name: job.game?.name ?? job.name, game: job.game ?? undefined };
}
export const archiveNeedsAttention = (job?: ArchiveJob) => job?.status === "failed" || job?.status === "interrupted";
export function archiveProgressPercent(job: ArchiveJob) {
  if (job.status === "complete") return 100;
  const progress = job.progress;
  return progress && progress.totalBytes > 0 ? Math.min(100, Math.max(0, progress.bytes / progress.totalBytes * 100)) : undefined;
}
export function archiveJobLabel(job: ArchiveJob) {
  return job.status === "running" ? `games.archive.phase.${job.progress?.phase ?? "checking"}` : job.status === "complete" ? "games.archive.phase.complete" : `games.archive.state.${job.status}`;
}
