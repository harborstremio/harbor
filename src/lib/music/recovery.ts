import type { MusicTrack } from "./types";

export function musicSourceName(track: MusicTrack): string {
  const names: Record<string, string> = {
    youtube: "YouTube Music",
    youtube_music: "YouTube Music",
    soundcloud: "SoundCloud",
    spotify: "Spotify",
    local: "Harbor",
    plex: "Plex",
    jellyfin: "Jellyfin",
    subsonic: "Subsonic",
    navidrome: "Navidrome",
  };
  return names[track.connectorId ?? ""] ?? "Harbor";
}

export function musicRecoveryKey(error: string, track: MusicTrack): string {
  if (track.connectorId === "spotify" && /client.?id|redirect.uri/i.test(error))
    return "music.recovery.setup";
  if (track.connectorId === "spotify" && /premium/i.test(error)) return "music.recovery.premium";
  if (track.connectorId === "local") return "music.recovery.local";
  if (/timed? ?out|network|connection|dns|offline/i.test(error)) return "music.recovery.network";
  return "music.recovery.source";
}

export function musicProviderSearch(track: MusicTrack): string | null {
  const query = encodeURIComponent(`${track.title} ${track.artist}`);
  if (track.connectorId === "youtube" || track.connectorId === "youtube_music") {
    const id = track.sourceId;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? `https://music.youtube.com/watch?v=${id}`
      : `https://music.youtube.com/search?q=${query}`;
  }
  if (track.connectorId === "soundcloud") return `https://soundcloud.com/search/sounds?q=${query}`;
  if (track.connectorId === "spotify") return `https://open.spotify.com/search/${query}`;
  return null;
}
