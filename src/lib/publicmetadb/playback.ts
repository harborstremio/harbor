import { pmdbRequest } from "./client";
import { isAuthenticated } from "./session";
import { isCwDismissed } from "@/lib/cw-dismiss";
import { readResumeEntry, saveResumeMs } from "@/lib/resume";
import type { LibraryItem } from "@/lib/stremio";
import type { PmdbResumePoint, PmdbResumeResponse } from "./types";

const DURATION_MS = { movie: 6_300_000, series: 2_640_000 };
const RESUME_PER_PAGE = 100;
const RESUME_MAX_PAGES = 10;

function toLibraryItem(raw: PmdbResumePoint): LibraryItem | null {
  const durMs = raw.runtime_ms > 0
    ? raw.runtime_ms
    : raw.media_type === "movie"
      ? DURATION_MS.movie
      : DURATION_MS.series;

  const posMs = raw.position_ms;
  const ratio = durMs > 0 ? posMs / durMs : (raw.progress > 1 ? raw.progress / 100 : raw.progress);
  if (ratio < 0.02 || ratio > 0.98) return null;

  const isMovie = raw.media_type === "movie";
  const id = isMovie ? `tmdb:movie:${raw.tmdb_id}` : `tmdb:tv:${raw.tmdb_id}`;
  const hasEpisode = !isMovie && raw.season != null && raw.season > 0 && raw.episode != null && raw.episode > 0;
  const when = raw.updated || raw.created || new Date().toISOString();

  return {
    _id: id,
    type: isMovie ? "movie" : "series",
    name: raw.title ?? (isMovie ? `Movie (${raw.tmdb_id})` : `Series (${raw.tmdb_id})`),
    poster: raw.poster ?? undefined,
    state: {
      timeOffset: Math.round(posMs),
      duration: durMs,
      season: hasEpisode ? raw.season! : undefined,
      episode: hasEpisode ? raw.episode! : undefined,
      video_id: hasEpisode ? `tmdb:tv:${raw.tmdb_id}:${raw.season}:${raw.episode}` : undefined,
      lastWatched: when,
    },
    removed: false,
    temp: false,
    _ctime: raw.created || when,
    _mtime: when,
    external: "publicmetadb",
  };
}

async function fetchAllResumePoints(): Promise<PmdbResumePoint[]> {
  const out: PmdbResumePoint[] = [];
  try {
    const first = await pmdbRequest<PmdbResumeResponse>(
      `/api/external/resume?page=1&perPage=${RESUME_PER_PAGE}`,
      { method: "GET" },
    );
    if (Array.isArray(first?.items)) out.push(...first.items);
    const totalPages = Math.max(1, Number(first?.totalPages ?? 1) || 1);
    const pages = Math.min(totalPages, RESUME_MAX_PAGES);
    for (let page = 2; page <= pages; page++) {
      try {
        const data = await pmdbRequest<PmdbResumeResponse>(
          `/api/external/resume?page=${page}&perPage=${RESUME_PER_PAGE}`,
          { method: "GET" },
        );
        if (!Array.isArray(data?.items) || data.items.length === 0) break;
        out.push(...data.items);
      } catch {
        break;
      }
    }
  } catch {
    return out;
  }
  return out;
}

export async function fetchPublicMetaDbPlaybackItems(): Promise<LibraryItem[]> {
  if (!isAuthenticated()) return [];

  const all = await fetchAllResumePoints();
  if (all.length === 0) return [];

  const items: LibraryItem[] = [];
  const seen = new Set<string>();

  for (const r of all) {
    const item = toLibraryItem(r);
    if (!item?.state) continue;

    const key = `${item._id}|${item.state.season ?? ""}|${item.state.episode ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);

    if (isCwDismissed(item)) continue;

    const existing = readResumeEntry(item._id, item.state.season, item.state.episode);
    const remoteT = Date.parse(item.state.lastWatched ?? "");
    const remoteValid = Number.isFinite(remoteT) && remoteT > 0;
    const shouldWrite =
      !existing ||
      (remoteValid && remoteT >= existing.t) ||
      (!existing.t && item.state.timeOffset > existing.ms);

    if (shouldWrite) {
      const pct01 = item.state.duration > 0 ? item.state.timeOffset / item.state.duration : 0;
      saveResumeMs(
        item._id,
        item.state.timeOffset,
        item.state.season,
        item.state.episode,
        undefined,
        pct01,
        "publicmetadb",
      );
    }
  }

  return items;
}
