import { createCatalogPublicationGate } from "./catalog-publication-gate";
import {
  deleteIptvCache,
  iptvSourceSignature,
  isPersistentCacheFresh,
  readIptvCache,
  writeIptvCache,
} from "./persistent-cache";
import type { IptvChannel, IptvPlaylist, IptvPlaylistSource } from "./types";
import { buildVodLibrary, type VodLibrary, type VodMovie, type VodSeries } from "./vod";
import { credsFromServer } from "./xtream";
import { fetchXtreamSeries, fetchXtreamVod } from "./xtream-vod";

export type XtreamVodSnapshot = {
  library: VodLibrary;
  fetchedAt: number | null;
  moviesLoading: boolean;
  seriesLoading: boolean;
  movieError: string | null;
  seriesError: string | null;
  movieTotal: number | null;
  seriesTotal: number | null;
};

type PersistedSnapshot = Pick<
  XtreamVodSnapshot,
  "library" | "fetchedAt" | "movieTotal" | "seriesTotal"
>;

type SnapshotPatch = Partial<Omit<XtreamVodSnapshot, "library">> & {
  library?: Partial<VodLibrary>;
};

type Inflight = {
  revision: number;
  promise: Promise<void>;
};

const EMPTY_LIBRARY: VodLibrary = { movies: [], series: [] };
const EMPTY: XtreamVodSnapshot = {
  library: EMPTY_LIBRARY,
  fetchedAt: null,
  moviesLoading: false,
  seriesLoading: false,
  movieError: null,
  seriesError: null,
  movieTotal: null,
  seriesTotal: null,
};
const cache = new Map<string, XtreamVodSnapshot>();
const cacheSignatures = new Map<string, string>();
const inflight = new Map<string, Inflight>();
const listeners = new Set<() => void>();
const revisions = new Map<string, number>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeXtreamVodLibrary(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getXtreamVodSnapshot(id?: string): XtreamVodSnapshot {
  return (id ? cache.get(id) : undefined) ?? EMPTY;
}

function makeLibrary(source: IptvPlaylistSource, channels: readonly IptvChannel[]): VodLibrary {
  const playlist: IptvPlaylist = {
    id: source.id,
    name: source.name,
    url: source.url,
    epgUrl: source.epgUrl ?? null,
    channels: [...channels],
    fetchedAt: Date.now(),
    groups: [],
  };
  return buildVodLibrary([playlist], new Map([[source.id, source.name]]));
}

function appendUnique<T extends { id: string }>(
  target: T[],
  seen: Set<string>,
  items: readonly T[],
) {
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    target.push(item);
  }
}

export async function loadXtreamVodLibrary(
  source: IptvPlaylistSource,
  force = false,
): Promise<void> {
  if (source.kind !== "xtream" || !source.xtream) return;
  const sourceSignature = iptvSourceSignature(source);
  const previousSignature = cacheSignatures.get(source.id);
  if (previousSignature && previousSignature !== sourceSignature) {
    cache.delete(source.id);
    revisions.set(source.id, (revisions.get(source.id) ?? 0) + 1);
    void deleteIptvCache("xtream-vod", source.id);
  }
  cacheSignatures.set(source.id, sourceSignature);
  const revision = revisions.get(source.id) ?? 0;
  const pending = inflight.get(source.id);
  if (pending?.revision === revision) return pending.promise;

  const creds = credsFromServer(
    source.xtream.server,
    source.xtream.username,
    source.xtream.password,
  );
  if (!creds) return;

  const isCurrent = () => (revisions.get(source.id) ?? 0) === revision;
  const publish = (patch: SnapshotPatch): boolean => {
    if (!isCurrent()) return false;
    const current = getXtreamVodSnapshot(source.id);
    cache.set(source.id, {
      ...current,
      ...patch,
      library: patch.library ? { ...current.library, ...patch.library } : current.library,
    });
    notify();
    return true;
  };

  const promise = (async () => {
    if (!force && !cache.has(source.id)) {
      const stored = await readIptvCache<PersistedSnapshot>("xtream-vod", source.id);
      if (!isCurrent()) return;
      if (stored?.sourceSignature === sourceSignature && isPersistedSnapshot(stored.value)) {
        cache.set(source.id, {
          ...EMPTY,
          ...stored.value,
          library: stored.value.library,
        });
        notify();
      } else if (stored) {
        void deleteIptvCache("xtream-vod", source.id);
      }
    }

    const restored = getXtreamVodSnapshot(source.id);
    if (!force && isPersistentCacheFresh(restored.fetchedAt)) return;

    publish({
      moviesLoading: true,
      seriesLoading: true,
      movieError: null,
      seriesError: null,
    });

    const movies: VodMovie[] = [];
    const movieIds = new Set<string>();
    const series: VodSeries[] = [];
    const seriesIds = new Set<string>();
    let moviesSucceeded = false;
    let seriesSucceeded = false;

    const seriesGate = createCatalogPublicationGate<VodSeries>((items) => {
      publish({ library: { series: [...items] } });
    });

    const movieTask = fetchXtreamVod(creds, source.id, {
      onStart: (total) => {
        publish({ movieTotal: total });
        if (total === 0) {
          publish({ library: { movies: [] } });
          seriesGate.release();
        }
      },
      onBatch: (channels) => {
        appendUnique(movies, movieIds, makeLibrary(source, channels).movies);
        const accepted = publish({ library: { movies: movies.slice() } });
        if (accepted) seriesGate.release();
        return accepted;
      },
    })
      .then(() => {
        moviesSucceeded = true;
        return publish({ moviesLoading: false });
      })
      .catch((error) => {
        if (restored.library.movies.length > 0) {
          publish({ library: { movies: restored.library.movies } });
        }
        seriesGate.release();
        return publish({
          moviesLoading: false,
          movieError: error instanceof Error ? error.message : String(error),
        });
      });

    const seriesTask = fetchXtreamSeries(creds, source.id, {
      onStart: (total) => {
        publish({ seriesTotal: total });
        if (total === 0) seriesGate.update([]);
      },
      onBatch: (channels) => {
        if (!isCurrent()) return false;
        appendUnique(series, seriesIds, makeLibrary(source, channels).series);
        seriesGate.update(series.slice());
        return true;
      },
    })
      .then(() => {
        seriesSucceeded = true;
      })
      .catch((error) => {
        seriesGate.update(restored.library.series);
        return publish({
          seriesError: error instanceof Error ? error.message : String(error),
        });
      });

    await Promise.all([movieTask, seriesTask]);
    if (!isCurrent()) return;
    await seriesGate.whenReleased();
    if (!isCurrent()) return;
    publish({ seriesLoading: false });
    if (moviesSucceeded && seriesSucceeded) publish({ fetchedAt: Date.now() });

    const current = cache.get(source.id);
    if (!current) return;
    const persisted: PersistedSnapshot = {
      library: current.library,
      fetchedAt: current.fetchedAt,
      movieTotal: current.movieTotal,
      seriesTotal: current.seriesTotal,
    };
    await writeIptvCache("xtream-vod", source.id, {
      sourceSignature,
      savedAt: current.fetchedAt ?? Date.now(),
      value: persisted,
    });
  })().finally(() => {
    if (inflight.get(source.id)?.promise === promise) inflight.delete(source.id);
  });

  inflight.set(source.id, { revision, promise });
  return promise;
}

function isPersistedSnapshot(value: unknown): value is PersistedSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<PersistedSnapshot>;
  return (
    !!snapshot.library &&
    Array.isArray(snapshot.library.movies) &&
    Array.isArray(snapshot.library.series) &&
    (snapshot.fetchedAt == null || typeof snapshot.fetchedAt === "number")
  );
}

export function clearXtreamVodLibraryCache(id?: string) {
  if (id) {
    cache.delete(id);
    cacheSignatures.delete(id);
    revisions.set(id, (revisions.get(id) ?? 0) + 1);
    void deleteIptvCache("xtream-vod", id);
  } else {
    const ids = new Set([...cache.keys(), ...inflight.keys()]);
    cache.clear();
    cacheSignatures.clear();
    for (const sourceId of ids) {
      revisions.set(sourceId, (revisions.get(sourceId) ?? 0) + 1);
      void deleteIptvCache("xtream-vod", sourceId);
    }
  }
  notify();
}
