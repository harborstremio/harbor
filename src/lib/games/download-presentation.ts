import type { GameTransfer, DownloadGame } from "./transfers";
import { torrentSharing, type GameTorrent } from "./torrents";

export type { DownloadGame } from "./transfers";
export type DownloadItem = { kind: "direct"; record: GameTransfer } | { kind: "torrent"; record: GameTorrent };
export type DownloadGroup = "active" | "queue" | "attention" | "complete" | "canceled";
export type DownloadSample = { time: number; network: number; seeders?: number };
export const DOWNLOAD_HISTORY_SECONDS = 120;

export function downloadSummary(items: DownloadItem[]) {
  const summary = { total: 0, active: 0, queued: 0, paused: 0, failed: 0 };
  for (const item of items) {
    const {record}=item;
    if(item.kind==="torrent"&&torrentSharing(item.record)){summary.total++;summary.active++;continue;}
    if(item.kind==="torrent"&&item.record.sharing?.status==="failed"){summary.total++;summary.failed++;continue;}
    if (record.status === "complete" || record.status === "canceled") continue;
    summary.total++;
    if (record.status === "queued" || record.status === "paused" || record.status === "failed") summary[record.status]++;
    else summary.active++;
  }
  return summary;
}
export type DownloadSummary = ReturnType<typeof downloadSummary>;

export function downloadGroup(item: DownloadItem): DownloadGroup {
  if(item.kind==="torrent"&&torrentSharing(item.record))return "active";
  if(item.kind==="torrent"&&item.record.sharing?.status==="failed")return "attention";
  const status = item.record.status;
  if (status === "complete") return "complete";
  if (status === "failed") return "attention";
  if (status === "canceled") return "canceled";
  if (status === "queued" || status === "paused") return "queue";
  return "active";
}

export function downloadGame(record: GameTransfer | GameTorrent): DownloadGame | undefined {
  return record.game;
}

export function featuredDownload(items: DownloadItem[]): DownloadItem | undefined {
  const running = items.filter(item => downloadGroup(item) === "active").sort((a, b) =>
    Number(b.record.status === "downloading") - Number(a.record.status === "downloading") || a.record.createdAt - b.record.createdAt);
  if (running.length) return running[0];
  // Keep the activity band useful after completion, including legacy downloads.
  const recent = [...items].sort((a, b) => b.record.updatedAt - a.record.updatedAt || b.record.createdAt - a.record.createdAt);
  return recent.find(item => downloadGame(item.record)?.artwork) ?? recent[0];
}

export function downloadProgress(received: number, total: number | null): number | undefined {
  return total !== null && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(100, received / total * 100)) : undefined;
}

export function appendDownloadSample(history: DownloadSample[], sample: DownloadSample): DownloadSample[] {
  const value = { ...sample, network: Math.max(0, Number.isFinite(sample.network) ? sample.network : 0), seeders: sample.seeders !== undefined && Number.isSafeInteger(sample.seeders) && sample.seeders >= 0 ? sample.seeders : undefined };
  return [...history.filter(point => point.time > sample.time - DOWNLOAD_HISTORY_SECONDS * 1000 && point.time < sample.time), value].slice(-DOWNLOAD_HISTORY_SECONDS);
}

export function downloadRemaining(received: number, total: number | null, rate: number): string | undefined {
  if (total === null || total <= received || !Number.isFinite(rate) || rate <= 0) return undefined;
  const seconds = Math.ceil((total - received) / rate);
  if (seconds >= 360000) return undefined;
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), remaining = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` : `${minutes}:${String(remaining).padStart(2, "0")}`;
}
