import { HARBOR_RELAY_BASE } from "@/lib/config/endpoints";

export type MusicDeepLink = {
  kind: "track" | "album" | "artist";
  artist: string;
  name?: string;
};

const PREFIX = "harbor://music/";
const BOUNCE_PARAM = "harbor-music";
const MAX_SEGMENT = 200;
const MAX_URL = 480;

function seg(value: string): string {
  const chars = Array.from(value.trim()).slice(0, MAX_SEGMENT);
  while (chars.length > 0 && encodeURIComponent(chars.join("")).length > MAX_SEGMENT) chars.pop();
  return encodeURIComponent(chars.join(""));
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return "";
  }
}

export function musicTrackPath(artist: string, title: string): string {
  return `track/${seg(artist)}/${seg(title)}`;
}

export function musicAlbumPath(artist: string, album: string): string {
  return `album/${seg(artist)}/${seg(album)}`;
}

export function musicArtistPath(artist: string): string {
  return `artist/${seg(artist)}`;
}

export function musicDeepLinkUrl(path: string): string {
  return `${PREFIX}${path}`;
}

export function musicBounceUrl(path: string): string {
  const url = `${HARBOR_RELAY_BASE}/?${BOUNCE_PARAM}=${path}`;
  return url.length <= MAX_URL ? url : "";
}

export function isMusicDeepLink(url: string): boolean {
  return url.startsWith(PREFIX);
}

export function parseMusicDeepLink(url: string): MusicDeepLink | null {
  if (!isMusicDeepLink(url)) return null;
  const parts = url
    .slice(PREFIX.length)
    .split("/")
    .filter((p) => p.length > 0);
  const kind = parts[0];
  if (kind !== "track" && kind !== "album" && kind !== "artist") return null;
  const artist = decode(parts[1] ?? "");
  if (!artist) return null;
  const name = parts[2] ? decode(parts[2]) : "";
  if (kind !== "artist" && !name) return null;
  return { kind, artist, name: name || undefined };
}

export function musicDeepLinkQuery(link: MusicDeepLink): string {
  return link.name ? `${link.artist} ${link.name}` : link.artist;
}

export function takeMusicBounce(): string | null {
  if (typeof window === "undefined") return null;
  const search = window.location?.search ?? "";
  const found = new RegExp(`[?&]${BOUNCE_PARAM}=([^&#]*)`).exec(search);
  if (!found || !found[1]) return null;
  const url = musicDeepLinkUrl(found[1]);
  return parseMusicDeepLink(url) ? url : null;
}
