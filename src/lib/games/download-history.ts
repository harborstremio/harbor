import {torrentSharing} from "./torrents";
import type { DownloadItem } from './download-presentation';

export const COMPLETED_DOWNLOAD_RETENTION = 86_400_000;
export type DownloadDismissals = Record<string, number>;
export const downloadHistoryKey = (profile: string) => `harbor.games.download-history.v1:${profile}`;
export const downloadHistoryId = (item: DownloadItem) => `${item.kind}:${item.record.id}`;

/** Completed engines persist their final update time; unknown legacy dates stay visible. */
export function downloadCompletedAt(item: DownloadItem, now = Date.now()): number | undefined {
  const value = item.kind === "torrent" ? item.record.completedAt ?? item.record.updatedAt : item.record.updatedAt;
  // HTTP transfers persist Unix seconds; torrents persist milliseconds.
  const completed = item.kind === "direct" ? value * 1000 : value;
  return item.record.status === 'complete' && Number.isSafeInteger(value) && value > 0 && value >= item.record.createdAt && completed <= now ? completed : undefined;
}
export function readDownloadDismissals(raw: string | null): DownloadDismissals {
  const result: DownloadDismissals = {};
  try {
    if (!raw || raw.length > 300_000) return result;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const [id, at] of Object.entries(value).slice(-2000)) {
      if (/^(direct|torrent):[^\x00-\x1f]{1,256}$/.test(id) && Number.isSafeInteger(at) && (at as number) > 0) result[id] = at as number;
    }
  } catch { /* An invalid display preference must not hide downloads. */ }
  return result;
}
export function downloadHistoryHidden(item: DownloadItem, dismissed: DownloadDismissals, now = Date.now()): boolean {
  if (item.record.status !== 'complete' || item.kind === 'torrent' && (torrentSharing(item.record) || item.record.sharing?.status === 'failed')) return false;
  const completed = downloadCompletedAt(item, now);
  const cleared = dismissed[downloadHistoryId(item)];
  return !!cleared && cleared >= (completed ?? (item.kind === "direct" ? item.record.createdAt * 1000 : item.record.createdAt)) || !!completed && now - completed >= COMPLETED_DOWNLOAD_RETENTION;
}
