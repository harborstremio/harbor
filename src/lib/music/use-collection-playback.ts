import { useMusicSourceRequest, musicSourceRequestMatches } from "./source-request";
import { toggleMusicPlayback, useMusicPlayer } from "./player";
import { useMusicTransport } from "@/components/music/music-queue";
import type { MusicTrack } from "./types";

const identity = (track: MusicTrack) =>
  `${track.collectionOrigin?.connectorId ?? track.connectorId}:${track.collectionOrigin?.id ?? track.id}`;

export function useCollectionPlayback(
  tracks: MusicTrack[],
  onPlay: (track: MusicTrack, queue: MusicTrack[]) => void,
): { playing: boolean; busy: boolean; play: () => void } {
  const player = useMusicPlayer();
  const sourceRequest = useMusicSourceRequest();
  const transport = useMusicTransport();
  const sameQueue =
    tracks.length > 0 &&
    tracks.length === player.queue.length &&
    tracks.every((track, index) => identity(track) === identity(player.queue[index]));
  const selected = Boolean(
    sameQueue &&
      player.current &&
      tracks.some((track) => identity(track) === identity(player.current!)),
  );
  const playing = selected && player.phase === "playing";
  const busy = (selected && player.phase === "resolving") || tracks.some(track => musicSourceRequestMatches(sourceRequest, track));
  const play = () => {
    if (selected && (player.phase === "playing" || player.phase === "paused")) {
      toggleMusicPlayback();
      return;
    }
    const first = tracks[transport.shuffle ? Math.floor(Math.random() * tracks.length) : 0];
    if (first) onPlay(first, tracks);
  };
  return { playing, busy, play };
}
