import { PRODUCT_NAME } from "@/lib/i18n/brand";
const SOURCE_LABEL: Record<string, string> = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  youtube: "YouTube Music",
  youtubemusic: "YouTube Music",
  "youtube-music": "YouTube Music",
  youtube_music: "YouTube Music",
  local: "Local files",
  direct: "Local files",
  plex: "Plex",
  jellyfin: "Jellyfin",
  navidrome: "Navidrome",
  subsonic: "Subsonic",
  lastfm: "Last.fm",
  "last-fm": "Last.fm",
  listenbrainz: "ListenBrainz",
  bandcamp: "Bandcamp",
  deezer: "Deezer",
  musicbrainz: "MusicBrainz",
  itunes: "iTunes",
  tidal: "Tidal",
  apple: "Apple Music",
  applemusic: "Apple Music",
  harbor: PRODUCT_NAME,
};

export function sourceLabel(id: string, override?: string): string {
  if (override && override.trim()) return override.trim();
  const key = id.trim().toLowerCase();
  if (!key) return "";
  const known = SOURCE_LABEL[key];
  if (known) return known;
  const words = key.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

