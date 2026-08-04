import { safeFetch as fetch } from "@/lib/safe-fetch";
import { readResumeEntry } from "@/lib/resume";
import { isDetectedAnime } from "./anime-detect";

const API = "https://api.strem.io/api";

const CW_FINISHED_RATIO = 0.9;

export type User = {
  _id: string;
  email: string;
  fullname?: string;
  avatar?: string;
};

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
  external?: "simkl";
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

export function cwSortKey(i: LibraryItem): number {
  const lastWatched = Date.parse(i.state?.lastWatched ?? "");
  if (Number.isFinite(lastWatched)) return lastWatched;
  const m = i._mtime as unknown;
  const mtime = typeof m === "number" ? m : Date.parse(String(m ?? ""));
  if (Number.isFinite(mtime)) return mtime;
  return resumeForItem(i)?.t ?? 0;
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

async function call<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: { error?: { message?: string }; result?: unknown };
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`stremio ${path} ${res.status}: invalid response`);
  }
  if (json.error) throw new Error(json.error.message ?? "Request failed");
  if (!res.ok) throw new Error(`stremio ${path} failed (${res.status})`);
  return json.result as T;
}

export function login(email: string, password: string) {
  return call<{ authKey: string; user: User }>("login", {
    email,
    password,
    facebook: false,
  });
}

export function getUser(authKey: string) {
  return call<User>("getUser", { authKey });
}

export function logout(authKey: string) {
  return call<unknown>("logout", { authKey });
}

export async function library(authKey: string): Promise<LibraryItem[]> {
  const ids = await call<Array<[string, string]>>("datastoreMeta", {
    authKey,
    collection: "libraryItem",
  });
  if (!ids?.length) return [];
  return call<LibraryItem[]>("datastoreGet", {
    authKey,
    collection: "libraryItem",
    ids: ids.map(([id]) => id),
    all: true,
  });
}

export async function libraryGetOne(authKey: string, id: string): Promise<LibraryItem | null> {
  const items = await call<LibraryItem[]>("datastoreGet", {
    authKey,
    collection: "libraryItem",
    ids: [id],
    all: false,
  }).catch(() => [] as LibraryItem[]);
  return items?.find((it) => it._id === id) ?? null;
}

export async function libraryGetOneStrict(
  authKey: string,
  id: string,
): Promise<LibraryItem | null> {
  const items = await call<LibraryItem[]>("datastoreGet", {
    authKey,
    collection: "libraryItem",
    ids: [id],
    all: false,
  });
  return items?.find((it) => it._id === id) ?? null;
}

export async function libraryPut(authKey: string, item: LibraryItem): Promise<void> {
  if (ANIME_CLOUD_ID.test(item._id) && item.removed !== true) return;
  await call<unknown>("datastorePut", {
    authKey,
    collection: "libraryItem",
    changes: [item],
  });
}

export async function removeStremioLibraryItem(authKey: string, id: string): Promise<void> {
  const items = await call<LibraryItem[]>("datastoreGet", {
    authKey,
    collection: "libraryItem",
    ids: [id],
    all: false,
  });
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
  const existing = await libraryGetOne(authKey, id).catch(() => null);
  if (!existing) return;
  await libraryPut(authKey, {
    ...existing,
    removed: true,
    temp: false,
    _mtime: new Date().toISOString(),
  });
}
