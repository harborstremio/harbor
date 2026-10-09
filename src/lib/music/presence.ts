import { setMusicPresence } from "@/lib/discord/presence";
import { getMusicState, subscribeMusic } from "./player";
import { musicAlbumPath, musicArtistPath, musicBounceUrl, musicTrackPath } from "./deep-link";
import type { MusicPlayerState, MusicTrack } from "./types";

const SEEK_TOLERANCE_SEC = 5;

let lastIdentity = "";
let lastPhase = "";
let lastAnchor = 0;

function identityOf(track: MusicTrack): string {
  return `${track.connectorId ?? ""}|${track.id}`;
}

function artworkOf(track: MusicTrack): string | undefined {
  const art = track.artwork?.trim();
  return art && art.startsWith("https://") && art.length <= 256 ? art : undefined;
}

function reset(): void {
  lastIdentity = "";
  lastPhase = "";
  lastAnchor = 0;
}

function publish(state: MusicPlayerState): void {
  const track = state.current;
  if (!track || state.phase === "idle" || state.phase === "error") {
    if (lastIdentity === "") return;
    reset();
    setMusicPresence(null);
    return;
  }
  if (state.phase === "resolving") return;
  const identity = identityOf(track);
  const playing = state.phase === "playing";
  const anchor = Math.floor(Date.now() / 1000 - state.currentTime);
  const drifted = playing && Math.abs(anchor - lastAnchor) > SEEK_TOLERANCE_SEC;
  if (identity === lastIdentity && state.phase === lastPhase && !drifted) return;
  lastIdentity = identity;
  lastPhase = state.phase;
  lastAnchor = anchor;
  const album = track.album?.trim() || undefined;
  const trackUrl = musicBounceUrl(musicTrackPath(track.artist, track.title));
  const artistUrl = musicBounceUrl(musicArtistPath(track.artist));
  const albumUrl = album ? musicBounceUrl(musicAlbumPath(track.artist, album)) : "";
  setMusicPresence({
    title: track.title,
    artist: track.artist,
    album,
    artwork: artworkOf(track),
    paused: !playing,
    positionSec: Math.max(0, state.currentTime),
    durationSec: state.duration > 0 ? state.duration : track.durationSeconds,
    trackUrl: trackUrl || undefined,
    artistUrl: artistUrl || undefined,
    albumUrl: albumUrl || undefined,
  });
}

export function startMusicPresence(): () => void {
  const stop = subscribeMusic(() => publish(getMusicState()));
  publish(getMusicState());
  return () => {
    stop();
    reset();
    setMusicPresence(null);
  };
}
