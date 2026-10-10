import type { IptvChannel } from "./types";
import { parseSeriesEpisode } from "./vod-title";

export type VodKind = "live" | "movie" | "series";

const VOD_EXT_RE = /\.(mkv|mp4|avi|m4v|mov|flv|wmv|mpg|mpeg|webm)(\?|$)/i;
const LIVE_EXT_RE = /\.(ts|m3u8)(\?|$)/i;
const MOVIE_GROUP_RE = /\b(vod|movie|movies|film|films|cinema|pel[ií]culas?|filme)\b/i;
const SERIES_GROUP_RE = /\b(serie|series|s[ée]ries|tv ?show|tv ?shows|staffel|temporada)\b/i;

export function isLiveChannel(ch: IptvChannel): boolean {
  const declared = (ch.attrs["tvg-type"] || ch.attrs["type"] || "").toLowerCase();
  if (declared === "movie" || declared === "series") return false;
  return !/\/(movie|series)\//i.test(ch.url || "");
}

export function classifyChannel(ch: IptvChannel): VodKind {
  // Query strings may carry signatures or nested URLs; they are not this file's path.
  let url = (ch.url || "").split(/[?#]/)[0];
  try {
    url = new URL(ch.url).pathname;
  } catch {
    /* Local/relative playlist path. */
  }
  const group = ch.group || "";
  const name = ch.name || "";
  const declared = (ch.attrs["tvg-type"] || ch.attrs["type"] || "").toLowerCase();

  if (declared === "movie") return "movie";
  if (declared === "series") return "series";

  if (/\/series\//i.test(url)) return "series";
  if (/\/movie\//i.test(url)) return "movie";
  if (/\/live\//i.test(url)) return "live";

  const vodExt = VOD_EXT_RE.test(url);
  const liveExt = LIVE_EXT_RE.test(url);
  if (!liveExt && parseSeriesEpisode(name)) return "series";

  if (SERIES_GROUP_RE.test(group) && !liveExt) return "series";
  if (MOVIE_GROUP_RE.test(group) && !liveExt) return "movie";

  if (vodExt && !liveExt) return "movie";
  return "live";
}
