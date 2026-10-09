import { putJlLibraryItem, readJlLibrary } from "./jl/local-library";
import { readResumeEntry, readResumeSource } from "@/lib/resume";
import { isDetectedAnime } from "./anime-detect";


const CW_FINISHED_RATIO = 0.9;

export type User = {
  _id: string;
  email: string;
  fullname?: string;
  avatar?: string;
};

export type ExternalCwSource = "simkl" | "trakt";

export type LibraryItem = {
  _id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  state?: {
    timeOffset: number;
    duration: number;
    season?: number;
    episode?: number;
    timeWatched?: number;
    flaggedWatched?: number;
    timesWatched?: number;
    watched?: string;
    video_id?: string;
    lastWatched?: string;
  };
  removed: boolean;
  temp: boolean;
  _ctime: string;
  _mtime: string;
  external?: ExternalCwSource;
  isAnime?: boolean;
  upNext?: boolean;
  local?: boolean;
  manualWatched?: boolean;
};

export function libraryMetaType(t: string): import("@/lib/cinemeta").MetaType {
  return t === "series" || t === "channel" || t === "tv" || t === "anime" || t === "other"
    ? t
    : "movie";
}

export function isAnimeCwItem(i: LibraryItem): boolean {
  return /^(kitsu|mal|anilist|anidb):/.test(i._id) || i.isAnime === true || isDetectedAnime(i._id);
}

export function episodeFromVideoId(
  videoId: string | undefined | null,
): { season: number; episode: number } | null {
  if (!videoId) return null;
  const parts = videoId.split(":");
  if (parts.length < 3) return null;
  const season = Number(parts[parts.length - 2]);
  const episode = Number(parts[parts.length - 1]);
  if (!Number.isInteger(season) || !Number.isInteger(episode) || season < 0 || episode < 0) {
    return null;
  }
  return { season, episode };
}

function resumeForItem(i: LibraryItem): { ms: number; t: number } | null {
  const vid = i.state?.video_id ?? "";
  const kitsuThreeSeg = /^(kitsu|mal|anilist|anidb):/.test(i._id) && vid.split(":").length === 3;
  const se = kitsuThreeSeg ? null : episodeFromVideoId(i.state?.video_id);
  const season = i.state?.season ?? (kitsuThreeSeg ? 1 : se?.season);
  const episode = i.state?.episode ?? (kitsuThreeSeg ? Number(vid.split(":")[2]) : se?.episode);
  return readResumeEntry(i._id, season, episode);
}

export function resumeSourceForItem(i: LibraryItem): ExternalCwSource | undefined {
  const vid = i.state?.video_id ?? "";
  const kitsuThreeSeg = /^(kitsu|mal|anilist|anidb):/.test(i._id) && vid.split(":").length === 3;
  const se = kitsuThreeSeg ? null : episodeFromVideoId(i.state?.video_id);
  const season = i.state?.season ?? (kitsuThreeSeg ? 1 : se?.season);
  const episode = i.state?.episode ?? (kitsuThreeSeg ? Number(vid.split(":")[2]) : se?.episode);
  return readResumeSource(i._id, season, episode);
}

// True only when CW eligibility comes from the harbor.resume fallback (no cloud
// progress of its own), so a disabled source's backfill cannot resurrect library cards.
export function cwMemberViaResume(i: LibraryItem): boolean {
  if (i.removed && !i.temp) return false;
  if (!i.state) return (resumeForItem(i)?.ms ?? 0) > 0;
  const duration = i.state.duration ?? 0;
  const finishedByRatio = duration > 0 && i.state.timeOffset / duration >= CW_FINISHED_RATIO;
  if (i.type === "movie" && ((i.state.flaggedWatched ?? 0) > 0 || finishedByRatio)) return false;
  if (i.state.timeOffset > 0) return false;
  if ((i.state.flaggedWatched ?? 0) > 0) return false;
  const local = resumeForItem(i)?.ms ?? 0;
  if (local <= 0) return false;
  if (duration > 0 && local / duration >= CW_FINISHED_RATIO) return false;
  return true;
}

export function cwSortKey(i: LibraryItem): number {
  const lastWatched = Date.parse(i.state?.lastWatched ?? "");
  const m = i._mtime as unknown;
  const mtime = typeof m === "number" ? m : Date.parse(String(m ?? ""));
  // Recency must agree with the dismiss check's itemActivity: Harbor and external
  // playback imports record freshness in `harbor.resume` without touching the cloud
  // _mtime/lastWatched. Otherwise an item un-dismissed by fresh resume keeps sorting
  // by its stale cloud timestamp and sinks to the end of Continue Watching.
  let best = resumeForItem(i)?.t ?? 0;
  if (Number.isFinite(lastWatched)) best = Math.max(best, lastWatched);
  if (Number.isFinite(mtime)) best = Math.max(best, mtime);
  return best;
}

export function isCwMember(i: LibraryItem): boolean {
  if (i.removed && !i.temp) return false;
  if (!i.state) {
    const local = resumeForItem(i)?.ms ?? 0;
    return local > 0;
  }
  const duration = i.state.duration ?? 0;
  const finishedByRatio = duration > 0 && i.state.timeOffset / duration >= CW_FINISHED_RATIO;
  if (i.type === "movie" && ((i.state.flaggedWatched ?? 0) > 0 || finishedByRatio)) return false;
  if (i.state.timeOffset > 0) return true;
  if ((i.state.flaggedWatched ?? 0) > 0) return false;
  const local = resumeForItem(i)?.ms ?? 0;
  if (local <= 0) return false;
  if (duration > 0 && local / duration >= CW_FINISHED_RATIO) return false;
  return true;
}

// Historical exports are retained for library callers, with JL local persistence.
export async function login(_email: string, _password: string): Promise<{ authKey: string; user: User }> {
  throw new Error("Use your JL Media Vision account sign-in.");
}
export async function getUser(_authKey: string): Promise<User> {
  throw new Error("External account credentials are not used by JL Media Vision.");
}
export async function logout(_authKey: string): Promise<void> {}
export async function library(scope: string): Promise<LibraryItem[]> { return readJlLibrary(scope); }
export async function libraryIfChanged(scope: string): Promise<LibraryItem[]> { return readJlLibrary(scope); }
export function invalidateLibraryCache(): void {}
export async function libraryGetOne(scope: string, id: string): Promise<LibraryItem | null> {
  return readJlLibrary(scope).find((item) => item._id === id) ?? null;
}
export const libraryGetOneStrict = libraryGetOne;
export async function libraryPut(scope: string, item: LibraryItem): Promise<void> { putJlLibraryItem(scope, item); }

export async function removeStremioLibraryItem(authKey: string, id: string): Promise<void> {
  const items = await library(authKey);
  const item = items?.find((it) => it._id === id);
  if (!item) return;
  await libraryPut(authKey, {
    ...item,
    removed: true,
    temp: false,
    _mtime: new Date().toISOString(),
  });
}

export const CLOUD_OK = /^(tt\d|kitsu:|mal:|anilist:|anidb:|tmdb:)/;

export const ANIME_CLOUD_ID = /^(kitsu|mal|anilist|anidb):/;
export function cloudWriteId(
  metaId: string,
  resolved: string | null,
  verified: boolean,
): string | null {
  if (metaId.startsWith("tt")) return metaId;
  if (ANIME_CLOUD_ID.test(metaId)) return null;
  if (verified && resolved && resolved.startsWith("tt")) return resolved;
  return CLOUD_OK.test(metaId) ? metaId : null;
}

export async function saveStremioBookmark(
  authKey: string,
  id: string,
  input: { type?: string; name?: string; poster?: string },
): Promise<void> {
  const now = new Date().toISOString();
  let existing: LibraryItem | null;
  try {
    existing = await libraryGetOneStrict(authKey, id);
  } catch {
    return;
  }
  if (existing) {
    await libraryPut(authKey, { ...existing, removed: false, temp: false, _mtime: now });
    return;
  }
  const type =
    input.type === "series" || input.type === "tv" || input.type === "channel" ? "series" : "movie";
  const item = {
    _id: id,
    name: input.name ?? "",
    type,
    poster: input.poster ?? null,
    posterShape: "poster",
    removed: false,
    temp: false,
    _ctime: now,
    _mtime: now,
    state: {
      lastWatched: null,
      timeWatched: 0,
      timeOffset: 0,
      overallTimeWatched: 0,
      timesWatched: 0,
      flaggedWatched: 0,
      duration: 0,
      video_id: null,
      watched: null,
      lastVidReleased: null,
      noNotif: false,
    },
    behaviorHints: { defaultVideoId: null, featuredVideoId: null, hasScheduledVideos: false },
  };
  await libraryPut(authKey, item as unknown as LibraryItem);
}

export async function removeStremioBookmark(authKey: string, id: string): Promise<void> {
  const existing = await libraryGetOneStrict(authKey, id);
  if (!existing || existing.removed) return;
  await libraryPut(authKey, {
    ...existing,
    removed: true,
    // Removing a bookmark keeps playback/history, like a title watched without saving it.
    // Explicit History removal still uses removeStremioLibraryItem's full tombstone.
    temp: true,
    _mtime: new Date().toISOString(),
  });
}
