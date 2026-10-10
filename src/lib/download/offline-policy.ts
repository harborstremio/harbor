export type OfflineStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "done"
  | "error"
  | "canceled"
  | "interrupted";

export function recoveredDownloadStatus(status: OfflineStatus): OfflineStatus {
  // Relaunch must not silently contact a provider or consume data. Resume is
  // explicit, and the native engine revalidates every existing partial file.
  return status === "downloading" || status === "queued" ? "interrupted" : status;
}

export function canRetryDownload(status: OfflineStatus): boolean {
  return ["paused", "error", "canceled", "interrupted"].includes(status);
}

export function directDownloadError(source: string): string | null {
  try {
    const url = new URL(source);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      return "Choose a direct HTTP or HTTPS media file without embedded credentials.";
    if (/\.(?:m3u8?|mpd)(?:$|\/)/i.test(url.pathname))
      return "This source is a streaming playlist. Offline Room needs a direct, unencrypted media file.";
    return null;
  } catch {
    return "The download source is not a valid media URL.";
  }
}

export function visibleDownloads<T extends { owner?: string }>(items: T[], owner: string): T[] {
  return items.filter((item) => item.owner === owner);
}

export function nextQueuedDownload<
  T extends { owner?: string; status: OfflineStatus; startedAt: number },
>(items: T[], owner: string, active: number, limit = 2): T | undefined {
  if (active >= limit) return undefined;
  return visibleDownloads(items, owner)
    .filter((item) => item.status === "queued")
    .sort((a, b) => a.startedAt - b.startedAt)[0];
}
