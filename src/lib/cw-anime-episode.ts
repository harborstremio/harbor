import type { AniZipMapping } from "@/lib/providers/anizip";
import type { PlayEpisode } from "@/lib/view";
import { isGenericEpisodeTitle, pickPreferredEpisodeTitle } from "./episode-title.ts";
import { pickEpisodeTitle } from "./providers/anizip-episode-title.ts";

const ANIME_SCHEME = /^(kitsu|mal|anilist|anidb):/;

export function isAnimeScheme(metaId: string): boolean {
  return ANIME_SCHEME.test(metaId);
}

export function effectiveAnimeLookupId(
  metaId: string,
  storedAnimeId: string | null | undefined,
): string | null {
  if (isAnimeScheme(metaId)) return metaId;
  return storedAnimeId && isAnimeScheme(storedAnimeId) ? storedAnimeId : null;
}

export function needsAniZipEpisodeLookup(
  metaId: string,
  ep: PlayEpisode | null | undefined,
): boolean {
  if (!ep || !isAnimeScheme(metaId)) return false;
  return (
    isGenericEpisodeTitle(ep.name, ep.episode) ||
    ep.tvdbEpisodeId == null ||
    ep.imdbSeason == null ||
    ep.imdbEpisode == null
  );
}

export function aniZipLookupKey(metaId: string): { scheme: string; id: number } | null {
  const [scheme, rawId] = metaId.split(":");
  const id = Number(rawId);
  if (!scheme || !Number.isFinite(id) || id <= 0) return null;
  return ANIME_SCHEME.test(`${scheme}:`) ? { scheme, id } : null;
}

export function applyAniZipEpisode(ep: PlayEpisode, az: AniZipMapping | null): PlayEpisode {
  if (!az) return ep;
  const azEp = az.episodes?.[String(ep.episode)];
  const out: PlayEpisode = { ...ep };
  const title = pickEpisodeTitle(azEp);
  const preferredTitle = pickPreferredEpisodeTitle(out.episode, out.name, title);
  if (preferredTitle) out.name = preferredTitle;
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
