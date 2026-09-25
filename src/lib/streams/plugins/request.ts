import { meta as cinemetaMeta } from "@/lib/cinemeta";
import { tmdbIdFromImdb } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import type { StreamRequest } from "../addons";
import { settingsValuesFor } from "./source";
import type { InstalledStreamPlugin, StreamPluginRequest } from "./types";

const MAP_KEY = "harbor.plugins.tmdb.v1";
const MAP_MAX = 500;
const MISS_TTL_MS = 10 * 60_000;
const misses = new Map<string, number>();

type TmdbRef = { id: number; kind: "movie" | "tv" };

let map: Map<string, TmdbRef | null> | null = null;
const inflight = new Map<string, Promise<TmdbRef | null>>();

function loadMap(): Map<string, TmdbRef | null> {
  if (map) return map;
  map = new Map();
  try {
    const raw = localStorage.getItem(MAP_KEY);
    if (raw) {
      for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, TmdbRef | null>)) if (v) map.set(k, v);
    }
  } catch {
    /* ignore */
  }
  return map;
}

function persistMap(): void {
  if (!map) return;
  try {
    while (map.size > MAP_MAX) {
      const first = map.keys().next().value;
      if (first === undefined) break;
      map.delete(first);
    }
    localStorage.setItem(MAP_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    /* ignore */
  }
}

function parseTmdbId(value: string | null, fallbackKind: "movie" | "tv"): TmdbRef | null {
  if (!value) return null;
  const m = /^tmdb:(?:(movie|tv):)?(\d+)/.exec(value);
  if (!m) return null;
  return { id: Number(m[2]), kind: (m[1] as "movie" | "tv" | undefined) ?? fallbackKind };
}

export async function resolveTmdb(
  imdbId: string,
  type: "movie" | "series",
  tmdbKey: string | undefined,
): Promise<TmdbRef | null> {
  const kind = type === "series" ? "tv" : "movie";
  const cacheKey = `${imdbId}:${kind}`;
  const cache = loadMap();
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const missedAt = misses.get(cacheKey);
  if (missedAt && Date.now() - missedAt < MISS_TTL_MS) return null;
  const pending = inflight.get(cacheKey);
  if (pending) return pending;
  const p = (async () => {
    let ref: TmdbRef | null = null;
    if (tmdbKey) {
      ref = parseTmdbId(await tmdbIdFromImdb(tmdbKey, imdbId, type).catch(() => null), kind);
    }
    if (!ref) {
      const m = (await cinemetaMeta(type, imdbId, true).catch(() => null)) as
        | ({ moviedb_id?: number } & Record<string, unknown>)
        | null;
      const id = m?.moviedb_id;
      if (typeof id === "number" && id > 0) ref = { id, kind };
    }
    if (ref) {
      cache.set(cacheKey, ref);
      persistMap();
      misses.delete(cacheKey);
    } else {
      misses.set(cacheKey, Date.now());
    }
    return ref;
  })().finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, p);
  return p;
}

const named = new Map<string, { title: string; year: number | null }>();

async function nameFromMeta(
  imdbId: string,
  type: "movie" | "series",
): Promise<{ title: string; year: number | null } | null> {
  const key = `${imdbId}:${type}`;
  const hit = named.get(key);
  if (hit) return hit;
  const m = (await cinemetaMeta(type, imdbId, true).catch(() => null)) as
    | ({ name?: unknown; releaseInfo?: unknown } & Record<string, unknown>)
    | null;
  const title = typeof m?.name === "string" ? m.name.trim() : "";
  if (!title) return null;
  const value = { title, year: parseInt(String(m?.releaseInfo ?? ""), 10) || null };
  if (named.size > MAP_MAX) named.clear();
  named.set(key, value);
  return value;
}

function imdbFromIds(ids: string[]): string | null {
  for (const id of ids) {
    const m = /^(tt\d+)/.exec(id);
    if (m) return m[1];
  }
  return null;
}

function tmdbFromIds(ids: string[], kind: "movie" | "tv"): TmdbRef | null {
  for (const id of ids) {
    const ref = parseTmdbId(id, kind);
    if (ref) return ref;
  }
  return null;
}

function episodeFromId(id: string): { season: number; episode: number } | null {
  const m = /^(?:tt\d+|tmdb:(?:movie:|tv:)?\d+):(\d+):(\d+)$/.exec(id);
  if (!m) return null;
  return { season: Number(m[1]), episode: Number(m[2]) };
}

export async function buildPluginRequest(
  req: StreamRequest,
  pickedId: string,
  plugin: InstalledStreamPlugin,
  tmdbKey: string | undefined,
): Promise<StreamPluginRequest> {
  const type: "movie" | "series" = req.type === "series" ? "series" : "movie";
  const kind = type === "series" ? "tv" : "movie";
  const ctx = req.context;
  const imdbId = ctx?.imdbId ?? imdbFromIds(req.ids);
  const fromId = episodeFromId(pickedId);
  let tmdb = tmdbFromIds(req.ids, kind);
  if (!tmdb && imdbId) tmdb = await resolveTmdb(imdbId, type, tmdbKey);
  let title = ctx?.title?.trim() ?? "";
  let year = ctx?.year ?? null;
  if (!title && imdbId) {
    const meta = await nameFromMeta(imdbId, type);
    if (meta) {
      title = meta.title;
      year = year ?? meta.year;
    }
  }
  return {
    type,
    id: pickedId,
    ids: req.ids,
    imdbId,
    tmdb,
    title,
    year,
    season: ctx?.season ?? fromId?.season ?? null,
    episode: ctx?.episode ?? fromId?.episode ?? null,
    absoluteEpisode: ctx?.absoluteEpisode ?? null,
    settings: settingsValuesFor(plugin),
  };
}
