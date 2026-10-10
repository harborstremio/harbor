import { musicTrackCredit, musicTrackIdentity, dedupeMusicTracks } from "./track-identity";
import { artistCreditParts } from "./search-artists";
import { normalizeName } from "./search-normalize";
import { backingTrackVersion, compatibleVocalVersion } from "./source-version";
import type { MusicTrack } from "./types";

/** Repeated recent songs by one artist should not spend the entire discovery budget. */
export function snippetSeedArtists(tracks: readonly MusicTrack[]): MusicTrack[] {
  const artists = new Set<string>();
  return dedupeMusicTracks(tracks).filter(track => {
    const credit = musicTrackCredit(track);
    const key = normalizeName(artistCreditParts(credit.artist)[0] ?? credit.artist);
    if (!key || artists.has(key)) return false;
    artists.add(key); return true;
  }).slice(0, 12);
}

/** Match catalog and resolved uploads by their original recording credit, not provider alone. */
export function unheardSnippetCandidates(candidates: readonly MusicTrack[], seed: MusicTrack | null, excluded: readonly MusicTrack[], heard: ReadonlySet<string>): MusicTrack[] {
  const keys = new Set([...heard, ...excluded.map(musicTrackIdentity), ...(seed ? [musicTrackIdentity(seed)] : [])]);
  const ids = new Set(excluded.flatMap(track => [track.id, track.collectionOrigin?.id].filter(Boolean)));
  return dedupeMusicTracks(candidates.filter(track => track.mediaKind !== "video"
    && !keys.has(musicTrackIdentity(track)) && !ids.has(track.id)
    && (seed ? compatibleVocalVersion(seed, track) : !backingTrackVersion(track))));
}
