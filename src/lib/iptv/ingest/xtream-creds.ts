import type { IptvPlaylistSource } from "../types";
import { credsFromServer, parseXtreamUrl, type XtreamCreds } from "../xtream";

export { parseXtreamUrl };

export function credsFromSource(src: IptvPlaylistSource): XtreamCreds | null {
  if (src.xtream) {
    const fromStructured = credsFromServer(
      src.xtream.server,
      src.xtream.username,
      src.xtream.password,
    );
    if (fromStructured) return fromStructured;
  }
  return parseXtreamUrl(src.url);
}

export function looksLikeXtreamUrl(url: string): boolean {
  return parseXtreamUrl(url) != null;
}
