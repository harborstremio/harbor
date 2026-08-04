import type { Meta } from "@/lib/cinemeta";
import { libraryGetOneStrict, type LibraryItem } from "@/lib/stremio";
import { cloudLibraryPut } from "@/lib/stremio-write-queue";
import { decodeWatchedEpisodes, encodeWatchedEpisodes } from "@/lib/stremio-watched";
import { withItemLock } from "@/lib/stremio-item-lock";
import { detectAnimeForCw, isDetectedAnime } from "@/lib/anime-detect";

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

const FRESH_KEY = "harbor.stremio.freshwatched.v1";
const FRESH_CAP = 300;
const freshWatched = new Map<string, { watched: string | null; mtime: number }>();
let freshLoaded = false;

function loadFresh(): void {
  if (freshLoaded) return;
  freshLoaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(FRESH_KEY) ?? "null");
    if (raw && typeof raw === "object") {
      for (const [id, v] of Object.entries(
        raw as Record<string, { watched?: unknown; mtime?: unknown }>,
      )) {
        if (v && typeof v.mtime === "number") {
          freshWatched.set(id, {
            watched: typeof v.watched === "string" ? v.watched : null,
            mtime: v.mtime,
          });
        }
      }
    }
  } catch {}
}

function setFresh(id: string, watched: string, mtime: number): void {
  loadFresh();
  freshWatched.set(id, { watched, mtime });
  try {
    if (freshWatched.size > FRESH_CAP) {
      const sorted = [...freshWatched.entries()].sort((a, b) => a[1].mtime - b[1].mtime);
      for (let i = 0; i < sorted.length - FRESH_CAP; i++) freshWatched.delete(sorted[i][0]);
    }
    localStorage.setItem(FRESH_KEY, JSON.stringify(Object.fromEntries(freshWatched)));
  } catch {}
}

export function freshestWatched(id: string): { watched: string | null; mtime: number } | undefined {
  loadFresh();
  return freshWatched.get(id);
}

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
  patch: (
    base: LibraryItem | null,
    prev: FullState,
  ) => Partial<FullState> | Promise<Partial<FullState>>,
): Promise<boolean> {
  return withItemLock(canonicalId, async () => {
    let base: LibraryItem | null;
    try {
      base = await libraryGetOneStrict(authKey, canonicalId);
    } catch {
      return false;
    }
    const prev = baseState(base);
    const now = new Date().toISOString();
    const state: FullState = { ...prev, ...(await patch(base, prev)), lastWatched: now };
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
        posterShape === "square" || posterShape === "landscape" || posterShape === "poster"
          ? posterShape
          : "poster",
      background: meta.background ?? base?.background,
      state,
      behaviorHints: {
        defaultVideoId: baseHints.defaultVideoId ?? null,
        featuredVideoId: baseHints.featuredVideoId ?? null,
        hasScheduledVideos: baseHints.hasScheduledVideos ?? false,
      },
      removed: base ? base.removed === true : false,
      temp: base ? base.temp === true : false,
      _ctime: base?._ctime ?? now,
      _mtime: now,
    };
    const ok = await cloudLibraryPut(authKey, item as unknown as LibraryItem);
    if (state.watched != null) setFresh(canonicalId, state.watched, Date.parse(now));
    return ok;
  });
}

export function markMovieWatchedStremio(
  authKey: string,
  meta: Meta,
  canonicalId: string,
  watched: boolean,
): Promise<boolean> {
  return putWithState(authKey, meta, canonicalId, (_base, prev) => ({
    flaggedWatched: watched ? 1 : 0,
    timesWatched: watched ? Math.max(1, prev.timesWatched) : 0,
  }));
}

export async function setEpisodesWatchedStremio(
  authKey: string,
  meta: Meta,
  canonicalId: string,
  videos: CinemetaVideo[] | undefined,
  localWatched: Set<string>,
  localUnwatched: Set<string>,
): Promise<boolean> {
  if (ANIME_ID.test(meta.id) || meta.type === "anime") return false;
  if (/^tt\d+$/.test(meta.id) && !isDetectedAnime(meta.id)) {
    await detectAnimeForCw([{ _id: meta.id, type: "series" }]);
  }
  if (isDetectedAnime(meta.id)) return false;
  return putWithState(authKey, meta, canonicalId, async (base) => {
    const server = await decodeWatchedEpisodes(base?.state?.watched, videos).catch(
      () => new Set<string>(),
    );
    const merged = new Set(server);
    for (const k of localWatched) merged.add(k);
    for (const k of localUnwatched) merged.delete(k);
    const field = await encodeWatchedEpisodes(merged, videos);
    return field == null ? {} : { watched: field };
  });
}
