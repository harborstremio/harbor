import type { AniZipMapping } from "@/lib/providers/anizip";
import type { PlayEpisode } from "@/lib/view";

const ANIME_SCHEME = /^(kitsu|mal|anilist|anidb):/;

export function isAnimeScheme(metaId: string): boolean {
  return ANIME_SCHEME.test(metaId);
}

export function needsAniZipSyncIds(metaId: string, ep: PlayEpisode | null | undefined): boolean {
  if (!ep || !isAnimeScheme(metaId)) return false;
  return ep.tvdbEpisodeId == null || ep.imdbSeason == null || ep.imdbEpisode == null;
}

export function aniZipLookupKey(metaId: string): { scheme: string; id: number } | null {
  const [scheme, rawId] = metaId.split(":");
  const id = Number(rawId);
  if (!scheme || !Number.isFinite(id) || id <= 0) return null;
  return ANIME_SCHEME.test(`${scheme}:`) ? { scheme, id } : null;
}

export type ResolvedStoredEpisode = {
  season: number;
  episode: number;
  remappedMixed: boolean;
};

export function resolveEffectiveEpisode(
  list: PlayEpisode[],
  season: number,
  episode: number,
  preferredSeason?: number | null,
): ResolvedStoredEpisode {
  if (list.some((e) => e.season === season && e.episode === episode)) {
    return { season, episode, remappedMixed: false };
  }
  const imdbExact = list.find((e) => e.imdbSeason === season && e.imdbEpisode === episode);
  if (imdbExact) {
    return { season: imdbExact.season, episode: imdbExact.episode, remappedMixed: false };
  }
  const mixedCandidates = list.filter((e) => e.imdbSeason === season && e.episode === episode);
  const mixed =
    (preferredSeason != null && preferredSeason >= 1
      ? mixedCandidates.find((e) => e.season === preferredSeason)
      : undefined) ?? mixedCandidates[0];
  if (mixed) {
    return { season: mixed.season, episode: mixed.episode, remappedMixed: true };
  }
  return { season, episode, remappedMixed: false };
}

export function preferredMixedSeason(
  viewedSeason: number | null | undefined,
  lastPlayedSeason: number | null | undefined,
): number | null {
  if (viewedSeason != null && viewedSeason >= 1) return viewedSeason;
  if (lastPlayedSeason != null && lastPlayedSeason >= 1) return lastPlayedSeason;
  return null;
}

export function providerAliasCoords(
  list: PlayEpisode[],
  season: number,
  episode: number,
): Array<{ season: number; episode: number }> {
  const item = list.find((e) => e.season === season && e.episode === episode);
  if (!item) return [];
  const out: Array<{ season: number; episode: number }> = [];
  const seen = new Set<string>();
  const push = (s: number | null | undefined, e: number | null | undefined) => {
    if (s == null || e == null || !Number.isFinite(s) || !Number.isFinite(e)) return;
    if (s === season && e === episode) return;
    const k = `${s}:${e}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ season: s, episode: e });
  };
  push(item.imdbSeason, item.imdbEpisode);
  push(item.imdbSeason, episode);
  return out;
}

export function applyAniZipEpisode(ep: PlayEpisode, az: AniZipMapping | null): PlayEpisode {
  if (!az) return ep;
  const azEp = az.episodes?.[String(ep.episode)];
  const out: PlayEpisode = { ...ep };
  if (out.tvdbEpisodeId == null && azEp?.tvdbId) out.tvdbEpisodeId = azEp.tvdbId;
  if (out.imdbSeason == null && azEp?.seasonNumber != null && azEp.seasonNumber >= 1) {
    out.imdbSeason = azEp.seasonNumber;
  }
  if (out.imdbEpisode == null && azEp?.episodeNumber != null) out.imdbEpisode = azEp.episodeNumber;
  if (out.absoluteNumber == null && azEp?.absoluteEpisodeNumber) {
    out.absoluteNumber = azEp.absoluteEpisodeNumber;
  }
  const m = az.mappings;
  if (!out.imdbId && m?.imdb_id) out.imdbId = m.imdb_id;
  if (!out.kitsuStreamId && m?.kitsu_id) out.kitsuStreamId = `kitsu:${m.kitsu_id}:${ep.episode}`;
  return out;
}
