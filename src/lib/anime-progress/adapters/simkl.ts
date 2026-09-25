import { simklRequest } from "@/lib/simkl/client";
import { getSession } from "@/lib/simkl/session";
import type { AnimeProgressIds, NormalizedAnimeProgress } from "../types";

type RawIds = {
  simkl?: number;
  imdb?: string;
  tmdb?: number | string;
  tvdb?: number;
  mal?: number | string;
  anidb?: number | string;
  kitsu?: number | string;
  anilist?: number | string;
};

type RawNode = {
  title?: string;
  year?: number | null;
  ids?: RawIds;
};

type RawEntry = {
  status?: string;
  last_watched_at?: string | null;
  show?: RawNode;
  seasons?: Array<{
    number?: number;
    episodes?: Array<{ number?: number; watched_at?: string | null; watched?: boolean }>;
  }>;
};

type RawAllItems = { movies?: RawEntry[]; shows?: RawEntry[]; anime?: RawEntry[] };

export function numId(v: number | string | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Pure raw → normalized mapping, exported for unit tests. */
export function normalizeSimklEntry(raw: RawEntry): NormalizedAnimeProgress | null {
  const node = raw.show;
  if (!node?.ids) return null;
  const watching = raw.status === "watching";
  if (!watching) return null; // only active "Watching" list status
  const idsRaw = node.ids;
  const watchedEpisodes = new Set<string>();
  let count = 0;
  for (const s of raw.seasons ?? []) {
    if (typeof s.number !== "number" || s.number < 1) continue;
    for (const e of s.episodes ?? []) {
      const known = e.watched === true || e.watched_at != null;
      if (!known || typeof e.number !== "number" || e.number < 1) continue;
      watchedEpisodes.add(`${s.number}:${e.number}`);
      count += 1;
    }
  }
  const mal = numId(idsRaw.mal);
  const anilist = numId(idsRaw.anilist);
  const kitsu = numId(idsRaw.kitsu);
  const anidb = numId(idsRaw.anidb);
  const tmdb = numId(idsRaw.tmdb);
  const simkl = numId(idsRaw.simkl);
  const imdb =
    typeof idsRaw.imdb === "string" && /^tt\d+$/.test(idsRaw.imdb) ? idsRaw.imdb : null;
  const ids: AnimeProgressIds = {
    mal,
    anilist,
    kitsu,
    anidb,
    simkl,
    imdb,
    tmdb,
    tvdb: numId(idsRaw.tvdb) ?? null,
  };
  const title = (node.title ?? "").trim();
  return {
    // Prefer a MAL key so Simkl agrees with MAL/AniList on the canonical anime.
    key: mal != null ? `mal:${mal}` : (kitsu != null ? `kitsu:${kitsu}` : anilist != null ? `anilist:${anilist}` : anidb != null ? `anidb:${anidb}` : simkl != null ? `simkl:${simkl}` : (imdb ?? `simkl:${simkl ?? ""}`)),
    source: "simkl",
    kind: "exact",
    status: raw.status ?? "watching",
    watching: true,
    watchedEpisodes,
    watchedCount: count,
    totalEpisodes: null,
    ids,
    titles: title ? [title] : [],
    year: node.year ?? null,
    updatedAt: raw.last_watched_at ?? null,
  };
}

/** Anime entries the user is actively watching on Simkl, with exact episodes. */
export async function fetchSimklAnimeProgress(): Promise<NormalizedAnimeProgress[]> {
  if (!getSession()) return [];
  const data = await simklRequest<RawAllItems>(
    "/sync/all-items/all/all?extended=full&episode_watched_at=yes",
  ).catch(() => ({}) as RawAllItems);
  const out: NormalizedAnimeProgress[] = [];
  const seen = new Set<string>();
  for (const e of data.anime ?? []) {
    const n = normalizeSimklEntry(e);
    if (n && !seen.has(n.key)) {
      seen.add(n.key);
      out.push(n);
    }
  }
  return out;
}