import { playMusic } from "./player";
import { readMusicPreference } from "./preferences";
import { cancelMusicQueueAutomation } from "./queue-automation";
import { adoptRequestedIdentity } from "./queue-source";
import { getMusicSourceCandidates, musicSourcePriority } from "./sources";
import type { MusicTrack } from "./types";

export const MUSIC_SOURCE_KEY = "harbor.music.preferred-source.v1";
export const MUSIC_SOURCE_REQUIRED = "harbor:music-playback-source-required";

export type ResolvedMusicPlayback = { track: MusicTrack; queue: MusicTrack[] };

/**
 * Resolution is headless, so anything outside the Music view can start a song without the
 * picker's React context and without sending the listener to another page.
 */
export async function resolveAndPlayMusicTrack(
  track: MusicTrack,
  queue: MusicTrack[] = [track],
): Promise<ResolvedMusicPlayback | null> {
  cancelMusicQueueAutomation();
  if (track.playbackUrl) {
    await playMusic(track, queue);
    return { track, queue };
  }
  const preferred = readMusicPreference(MUSIC_SOURCE_KEY);
  const candidates = await getMusicSourceCandidates(track);
  const usable = candidates.filter((candidate) => candidate.health !== "offline");
  const match =
    usable.find((candidate) => candidate.connectorId === preferred) ??
    [...usable].sort(
      (left, right) => musicSourcePriority(left.connectorId) - musicSourcePriority(right.connectorId),
    )[0];
  if (!match) return null;
  const selected = adoptRequestedIdentity(match.track, track);
  const selectedQueue = queue.map((item) =>
    item.id === track.id && item.connectorId === track.connectorId ? selected : item,
  );
  await playMusic(selected, selectedQueue);
  return { track: selected, queue: selectedQueue };
}
