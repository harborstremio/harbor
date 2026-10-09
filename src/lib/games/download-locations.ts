import { setupParent } from "./setup-locations";
import type { GameTransfer } from "./transfers";

export const DOWNLOAD_HEADROOM = 32 * 1024 * 1024;
export function downloadLocationKey(path: string) {
  const clean = path.replace(/^\\\\\?\\/, "").replace(/[\\/]+$/, "");
  return /^[a-z]:|^\\\\/i.test(clean) ? clean.replace(/\//g, "\\").toLowerCase() : clean;
}
export function downloadDestination(parent: string, filename?: string) {
  if (!filename) return parent;
  return `${parent.replace(/[\\/]+$/, "")}${parent.includes("\\") ? "\\" : "/"}${filename}`;
}
export function recentDownloadFolders(records: GameTransfer[], profile: string) {
  const seen = new Set<string>();
  return records.filter(record => record.profile === profile && record.status !== "canceled")
    .sort((a, b) => b.createdAt - a.createdAt).flatMap(record => {
      const path = setupParent(record.destination), key = downloadLocationKey(path);
      if (!path || seen.has(key)) return [];
      seen.add(key); return [path];
    }).slice(0, 2);
}
