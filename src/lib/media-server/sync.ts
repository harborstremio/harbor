import { JellyfinEmbyAdapter } from "./jellyfin-emby";
import { mediaServerItems, putMediaServerItems, putMediaServerSyncSummary } from "./index-store";
import { updateMediaServerConnection } from "./connections";
import { groupMediaServerTitles } from "./selectors";
import { PlexAdapter } from "./plex";
import type { MediaServerAdapter, MediaServerConnection, MediaServerLibrary } from "./types";

export type MediaServerSyncProgress = {
  connectionId: string;
  active: boolean;
  message: string;
  processed?: number;
  total?: number;
};
const progressListeners = new Set<(progress: MediaServerSyncProgress) => void>();
const activeProgress = new Map<string, MediaServerSyncProgress>();
export function subscribeMediaServerSyncProgress(
  listener: (progress: MediaServerSyncProgress) => void,
) {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}
export function currentMediaServerSyncProgress(): MediaServerSyncProgress | null {
  return activeProgress.values().next().value ?? null;
}
function emitProgress(progress: MediaServerSyncProgress) {
  if (progress.active) activeProgress.set(progress.connectionId, progress);
  else activeProgress.delete(progress.connectionId);
  for (const listener of progressListeners) listener(progress);
}

export function mediaServerAdapter(connection: MediaServerConnection): MediaServerAdapter {
  return connection.provider === "plex"
    ? new PlexAdapter(connection.origin)
    : new JellyfinEmbyAdapter(connection.provider, connection.origin);
}

async function synchronizeMediaServerInner(
  connection: MediaServerConnection,
  onProgress?: (message: string) => void,
): Promise<{ libraries: MediaServerLibrary[]; itemCount: number; removedItems: number }> {
  const report = (message: string, processed?: number, total?: number) => {
    onProgress?.(message);
    emitProgress({ connectionId: connection.id, active: true, message, processed, total });
  };
  report(`Connecting to ${connection.name}`);
  const adapter = mediaServerAdapter(connection);
  const libraries = await adapter.libraries(connection);
  let itemCount = 0;
  let removedItems = 0;
  const enabledIds = connection.enabledLibraryIds;
  for (const library of libraries.filter(
    (entry) => entry.enabled && (!enabledIds || enabledIds.includes(entry.id)),
  )) {
    report(`Syncing ${library.name}`);
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await adapter.synchronize(connection, library, cursor);
      await putMediaServerItems(page.items, page.deletedIds, connection.id);
      page.items.forEach((item) => seen.add(item.id));
      itemCount += page.items.length;
      report(`Syncing ${library.name}`, page.processed, page.total);
      cursor = page.cursor;
    } while (cursor);
    const stale = (await mediaServerItems(connection.id))
      .filter((item) => item.libraryId === library.id && !seen.has(item.id))
      .map((item) => item.id);
    if (stale.length > 0) {
      await putMediaServerItems([], stale, connection.id);
      removedItems += stale.length;
    }
  }
  const all = await mediaServerItems(connection.id);
  const seriesById = new Map(
    all.filter((item) => item.kind === "series").map((item) => [item.id, item.identity]),
  );
  const repaired = all.flatMap((item) => {
    if (item.kind !== "episode" || !item.parentId) return [];
    const parent = seriesById.get(item.parentId);
    return parent
      ? [
          {
            ...item,
            identity: { ...parent, season: item.identity.season, episode: item.identity.episode },
          },
        ]
      : [];
  });
  if (repaired.length > 0) await putMediaServerItems(repaired);
  const finalItems = repaired.length > 0 ? await mediaServerItems(connection.id) : all;
  const titles = groupMediaServerTitles(finalItems);
  const summary = {
    connectionId: connection.id,
    at: Date.now(),
    movies: titles.filter((title) => title.kind === "movie").length,
    shows: titles.filter((title) => title.kind === "series").length,
    episodes: finalItems.filter((item) => item.kind === "episode").length,
    versions: finalItems.reduce((count, item) => count + item.versions.length, 0),
    duplicates: Math.max(
      0,
      finalItems.filter((item) => item.kind === "movie" || item.kind === "series").length -
        titles.length,
    ),
    unmatchedTitles: titles.filter(
      (title) => !title.identity.tmdbId && !title.identity.imdbId && !title.identity.tvdbId,
    ).length,
    removedItems,
  };
  await putMediaServerSyncSummary(summary);
  updateMediaServerConnection(
    connection.id,
    {
      lastSyncAt: summary.at,
      lastSyncResult: {
        ok: true,
        message: `${summary.movies} movies · ${summary.shows} shows · ${summary.episodes} episodes · ${summary.versions} versions · ${summary.duplicates} duplicates · ${summary.unmatchedTitles} unmatched · ${summary.removedItems} removed`,
        at: summary.at,
      },
      enabledLibraryIds: enabledIds ?? libraries.map((library) => library.id),
    },
    connection.profileId,
  );
  return { libraries, itemCount, removedItems };
}

export async function synchronizeMediaServer(
  connection: MediaServerConnection,
  onProgress?: (message: string) => void,
): Promise<{ libraries: MediaServerLibrary[]; itemCount: number; removedItems: number }> {
  try {
    return await synchronizeMediaServerInner(connection, onProgress);
  } finally {
    emitProgress({ connectionId: connection.id, active: false, message: "" });
  }
}
