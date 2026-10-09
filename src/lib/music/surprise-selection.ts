import { dailyArtistKey } from "./daily-discovery-selection";
import { mixRecordings } from "./mix-quality";
import { knownArtistQuota, type SurpriseBlend } from "./surprise-preferences";
import { musicTrackIdentity } from "./track-identity";
import type { MusicTrack } from "./types";

export function shuffleSurprise<T>(values: readonly T[], random = Math.random): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Familiar artists are welcome; known recordings never pad a discovery queue. */
export function selectSurpriseTracks(
  candidates: readonly MusicTrack[], familiar: ReadonlySet<string>, excluded: ReadonlySet<string>,
  previous: readonly MusicTrack[] = [], size = 12, random = Math.random,
  options: { knownArtists?: ReadonlySet<string>; blend?: SurpriseBlend; strict?: boolean } = {},
): MusicTrack[] {
  const pool = shuffleSurprise(mixRecordings(candidates).filter(track => !excluded.has(musicTrackIdentity(track))), random);
  const fresh = pool.filter(track => !familiar.has(musicTrackIdentity(track)));
  const out: MusicTrack[] = [];
  const artists = new Map<string, number>();
  for (const track of previous.slice(-4)) artists.set(dailyArtistKey(track), (artists.get(dailyArtistKey(track)) ?? 0) + 1);
  const take = (lane: MusicTrack[]) => {
    const before = out.at(-1) ?? previous.at(-1);
    const last = before ? dailyArtistKey(before) : "";
    const index = lane.findIndex(track => dailyArtistKey(track) !== last && (artists.get(dailyArtistKey(track)) ?? 0) < 2);
    if (index < 0) return false;
    const track = lane.splice(index, 1)[0];
    artists.set(dailyArtistKey(track), (artists.get(dailyArtistKey(track)) ?? 0) + 1);
    out.push({ ...track, mediaKind: "audio" });
    return true;
  };
  const knownArtists = options.knownArtists ?? new Set<string>();
  const quota = knownArtistQuota(options.blend ?? "balanced");
  const heard: MusicTrack[] = [];
  const unheard: MusicTrack[] = [];
  for (const track of fresh) (knownArtists.has(dailyArtistKey(track)) ? heard : unheard).push(track);
  let knownTaken = 0;
  while (out.length < size) {
    const allowed = quota >= 6 ? size : Math.floor(((out.length + 1) * quota) / 6);
    const preferKnown = quota >= 6 || knownTaken < allowed;
    const first = preferKnown ? heard : unheard;
    const second = preferKnown ? unheard : heard;
    if (take(first)) {
      if (first === heard) knownTaken += 1;
      continue;
    }
    // Once the familiar quota is spent, a short queue is the honest answer: the caller
    // widens the catalogue instead of topping the mix up with artists already on repeat.
    if (!preferKnown && options.strict) break;
    if (!take(second)) break;
    if (second === heard) knownTaken += 1;
  }
  return out;
}
