import type { Meta } from "@/lib/cinemeta";
import { libraryGetOne, libraryPut, type LibraryItem } from "@/lib/stremio";
import { encodeWatchedEpisodes } from "@/lib/stremio-watched";

type CinemetaVideo = NonNullable<Meta["videos"]>[number];

type FullState = {
  lastWatched: string;
  timeWatched: number;
  timeOffset: number;
  overallTimeWatched: number;
  timesWatched: number;
  flaggedWatched: number;
  duration: number;
  video_id: string | null;
  watched: string | null;
  lastVidReleased: string | null;
  noNotif: boolean;
};

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function baseState(base: LibraryItem | null): FullState {
  const s = (base?.state ?? {}) as Record<string, unknown>;
  return {
    lastWatched: typeof s.lastWatched === "string" ? s.lastWatched : new Date().toISOString(),
    timeWatched: num(s.timeWatched, 0),
    timeOffset: num(s.timeOffset, 0),
    overallTimeWatched: num(s.overallTimeWatched, 0),
    timesWatched: num(s.timesWatched, 0),
    flaggedWatched: num(s.flaggedWatched, 0),
    duration: num(s.duration, 0),
    video_id: typeof s.video_id === "string" ? s.video_id : null,
    watched: typeof s.watched === "string" && s.watched.length > 0 ? s.watched : null,
    lastVidReleased: typeof s.lastVidReleased === "string" ? s.lastVidReleased : null,
    noNotif: s.noNotif === true,
  };
}

async function putWithState(
  authKey: string,
  meta: Meta,
  canonicalId: string,
  patch: (base: LibraryItem | null, prev: FullState) => Partial<FullState>,
): Promise<boolean> {
  const base = await libraryGetOne(authKey, canonicalId).catch(() => null);
  const prev = baseState(base);
  const now = new Date().toISOString();
  const state: FullState = { ...prev, ...patch(base, prev), lastWatched: now };
  const name = (base?.name?.trim() || meta.name || "").trim();
  if (!name) return false;
  const baseRecord = base as unknown as Record<string, unknown> | null;
  const baseHints = (baseRecord?.behaviorHints ?? {}) as Record<string, unknown>;
  const posterShape = baseRecord?.posterShape;
  const item = {
    _id: canonicalId,
    type: base?.type ?? (meta.type === "series" ? "series" : "movie"),
    name,
    poster: meta.poster ?? base?.poster ?? null,
    posterShape:
      posterShape === "square" || posterShape === "landscape" || posterShape === "poster" ? posterShape : "poster",
    background: meta.background ?? base?.background,
    state,
    behaviorHints: {
      defaultVideoId: baseHints.defaultVideoId ?? null,
      featuredVideoId: baseHints.featuredVideoId ?? null,
      hasScheduledVideos: baseHints.hasScheduledVideos ?? false,
    },
    removed: false,
    temp: false,
    _ctime: base?._ctime ?? now,
    _mtime: now,
  };
  try {
    await libraryPut(authKey, item as unknown as LibraryItem);
    return true;
  } catch {
    return false;
  }
}

export function markMovieWatchedStremio(
  authKey: string,
  meta: Meta,
  canonicalId: string,
  watched: boolean,
): Promise<boolean> {
  return putWithState(authKey, meta, canonicalId, (_base, prev) => ({
    flaggedWatched: watched ? 1 : 0,
    timesWatched: watched ? Math.max(1, prev.timesWatched) : prev.timesWatched,
  }));
}

export async function setEpisodesWatchedStremio(
  authKey: string,
  meta: Meta,
  canonicalId: string,
  watchedKeys: Set<string>,
  videos: CinemetaVideo[] | undefined,
): Promise<boolean> {
  const field = await encodeWatchedEpisodes(watchedKeys, videos);
  if (field == null) return false;
  return putWithState(authKey, meta, canonicalId, () => ({ watched: field }));
}
