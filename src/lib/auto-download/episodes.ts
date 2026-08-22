import type { AutoDlSeries } from "@/lib/auto-download";
import type { Meta } from "@/lib/cinemeta";
import { activeDownloadFor } from "@/lib/download/downloads-store";
import type { PlayEpisode } from "@/lib/view";

type AiredEpisode = {
  season: number;
  episode: number;
  rel: number;
  videoId?: string;
  name?: string;
};

export function grabKey(seriesId: string, season: number, episode: number): string {
  return `${seriesId}:S${season}E${episode}`;
}

function airedEpisodes(meta: Meta): AiredEpisode[] {
  const now = Date.now();
  const out: AiredEpisode[] = [];
  for (const v of meta.videos ?? []) {
    const season = v.season;
    const episode = v.episode ?? v.number;
    if (typeof season !== "number" || typeof episode !== "number") continue;
    if (season < 1) continue;
    const raw = v.released ?? v.firstAired;
    const rel = raw ? Date.parse(raw) : NaN;
    if (!Number.isFinite(rel) || rel > now) continue;
    out.push({ season, episode, rel, videoId: v.id, name: v.name ?? v.title });
  }
  return out;
}

export function nextUnairedDate(meta: Meta): number | null {
  const now = Date.now();
  let soonest: number | null = null;
  for (const v of meta.videos ?? []) {
    const season = v.season;
    const episode = v.episode ?? v.number;
    if (typeof season !== "number" || season < 1) continue;
    if (typeof episode !== "number") continue;
    const raw = v.released ?? v.firstAired;
    const rel = raw ? Date.parse(raw) : NaN;
    if (!Number.isFinite(rel) || rel <= now) continue;
    if (soonest == null || rel < soonest) soonest = rel;
  }
  return soonest;
}

function alreadyDownloaded(metaId: string, season: number, episode: number): boolean {
  const d = activeDownloadFor(metaId, season, episode);
  if (!d) return false;
  return d.status !== "canceled" && d.status !== "error";
}

export function eligibleEpisodes(
  series: AutoDlSeries,
  meta: Meta,
  grabbed: Set<string>,
): PlayEpisode[] {
  const aired = airedEpisodes(meta).filter((a) => a.rel >= series.addedAt);
  if (aired.length === 0) return [];

  let pool = aired;
  if (series.stop.kind === "seasonEnd") {
    const maxSeason = Math.max(...aired.map((a) => a.season));
    pool = aired.filter((a) => a.season === maxSeason);
  }
  pool = pool.slice().sort((a, b) => a.season - b.season || a.episode - b.episode);

  const remaining =
    series.stop.kind === "count"
      ? Math.max(
          0,
          series.stop.value - (series.grabbedCount - (series.stop.from ?? series.grabbedCount)),
        )
      : Infinity;

  const eps: PlayEpisode[] = [];
  const picked = new Set<string>();
  for (const a of pool) {
    if (eps.length >= remaining) break;
    const key = grabKey(series.id, a.season, a.episode);
    if (picked.has(key)) continue;
    if (grabbed.has(key)) continue;
    if (alreadyDownloaded(series.id, a.season, a.episode)) continue;
    picked.add(key);
    eps.push({ season: a.season, episode: a.episode, videoId: a.videoId, name: a.name });
  }
  return eps;
}
