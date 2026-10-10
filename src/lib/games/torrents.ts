import type { DownloadGame } from "./transfers";
export type TorrentFile = { index: number; path: string; bytes: number; padding?: boolean };
export type TorrentPlan = { token: string; name: string; infoHash: string; totalBytes: number; pieceLength: number; files: TorrentFile[]; private: boolean };
export type TorrentStatus = "queued" | "checking" | "downloading" | "paused" | "complete" | "failed";
export type TorrentSeedPolicy = { ratioMilli:number; seconds:number; uploadBps:number };
export type TorrentSharing = { policy:TorrentSeedPolicy; status:"checking"|"seeding"|"stopped"|"limitReached"|"failed"; uploadedBytes:number; elapsedSeconds:number; error:string|null };
export type GameTorrent = { preparation?: import("./download-preparation").PreparationChoice | null; completedAt?:number; sharing?:TorrentSharing; queueOrder?: number; id: string; profile: string; name: string; infoHash: string; metadataSha: string; destination: string; selected: number[]; totalBytes: number; received: number; status: TorrentStatus; downloadBps: number; uploadBps: number; createdAt: number; updatedAt: number; error: string | null; bytesPerSecond: number; diskBytesPerSecond?: number; game?: DownloadGame; uploadPerSecond: number; peers: number; seeders?: number };
export type TorrentRequest = { token: string; parent: string; name: string; selected: number[]; downloadBps: number; uploadBps: number; game?: DownloadGame };
const errors = new Set(["torrent_seed_files", "torrent_seed_limits", "torrent_profile", "torrent_request", "torrent_path", "torrent_read", "torrent_limit", "torrent_metadata", "torrent_selection", "torrent_store", "torrent_destination", "torrent_bandwidth", "torrent_busy", "torrent_canceled", "torrent_network", "torrent_timeout", "torrent_expired", "torrent_exists", "torrent_space", "torrent_duplicate", "torrent_start", "torrent_engine", "torrent_missing"]);
export function torrentError(error: unknown) { const code = error instanceof Error ? error.message : String(error); return `games.torrent.${errors.has(code) ? code : "torrent_engine"}`; }
export function torrentActive(status: TorrentStatus) { return ["queued", "checking", "downloading"].includes(status); }
export function torrentFolder(name: string) { const clean = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").trim().slice(0, 180); return !clean || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(clean) || clean.startsWith(".harbor-") ? "Game files" : clean; }
export function torrentSelection(plan: TorrentPlan, selected: ReadonlySet<number>) { return plan.files.reduce((sum, file) => sum + (selected.has(file.index) ? file.bytes : 0), 0); }
export function torrentSpace(plan: TorrentPlan, selected: ReadonlySet<number>) {
  const piece = plan.pieceLength, ranges: [number, number][] = []; let offset = 0;
  for (const file of plan.files) {
    if (selected.has(file.index) && file.bytes > 0) { const start = Math.floor(offset / piece) * piece, end = Math.ceil((offset + file.bytes) / piece) * piece, last = ranges.at(-1); if (last && last[1] >= start) last[1] = end; else ranges.push([start, end]); }
    offset += file.bytes;
  }
  let required = 0, current = 0; offset = 0;
  for (const file of plan.files) {
    const end = offset + file.bytes; while (current < ranges.length && ranges[current][1] <= offset) current++;
    let range = current, extent = 0; while (range < ranges.length && ranges[range][0] < end) { if (ranges[range][1] > offset) extent = Math.min(ranges[range][1], end) - offset; range++; }
    if (!file.padding) required += extent; offset = end;
  }
  return required;
}

export function torrentSharing(record:GameTorrent) { return record.status === "complete" && (record.sharing?.status === "checking" || record.sharing?.status === "seeding"); }
