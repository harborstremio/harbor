import { parseM3u } from "../m3u";
import { liveContainerPref } from "../settings-bridge";
import { commitHydratedPlaylist, fetchM3uText, markVodHydrated, shapePlaylist, unmarkVodHydrated } from "../store";
import type { IptvPlaylist, IptvPlaylistSource } from "../types";
import {
  fetchXtreamLiveChannels,
  fetchXtreamUserInfo,
  XtreamAuthError,
  XtreamEmptyError,
  type XtreamCreds,
} from "../xtream";
import { fetchXtreamVodAndSeries } from "../xtream-vod";
import type { ProviderShape } from "./detect";

const MIDDLEWARE_CANDIDATES = ["/iptv/m3u", "/m3u", "/playlist.m3u", "/get.php?type=m3u_plus"];

export async function loadFromShape(src: IptvPlaylistSource, shape: ProviderShape): Promise<IptvPlaylist> {
  if (shape.kind === "invalid") throw new Error(shape.reason);
  if (shape.kind === "epg") return shapePlaylist({ ...src, url: shape.url }, []);
  if (shape.kind === "xtream") return loadXtream(src, shape.creds);
  return loadM3u(src, shape.url, shape.middleware);
}

async function loadXtream(src: IptvPlaylistSource, creds: XtreamCreds): Promise<IptvPlaylist> {
  const caps = await fetchXtreamUserInfo(creds);
  const container = liveContainerPref();
  const live = await fetchXtreamLiveChannels(creds, src.id, container, caps);
  if (live.length === 0) {
    throw new XtreamEmptyError(
      "Logged in to the Xtream server, but it returned no live channels. The account may have no active package.",
    );
  }
  void hydrateXtreamVod(src, creds, live);
  return shapePlaylist(src, live);
}

async function hydrateXtreamVod(
  src: IptvPlaylistSource,
  creds: XtreamCreds,
  live: IptvPlaylist["channels"],
): Promise<void> {
  if (!markVodHydrated(src.id)) return;
  try {
    const vod = await fetchXtreamVodAndSeries(creds, src.id);
    if (vod.length === 0) return;
    commitHydratedPlaylist(src, [...live, ...vod]);
  } catch {
    unmarkVodHydrated(src.id);
  }
}

async function loadM3u(src: IptvPlaylistSource, url: string, middleware: boolean): Promise<IptvPlaylist> {
  const text = await fetchM3uText(url);
  if (isM3u(text)) return parseAndShape(src, text);
  if (middleware) {
    const recovered = await probeMiddleware(url);
    if (recovered) return parseAndShape({ ...src, url: recovered.url }, recovered.text);
  }
  const preview = text.slice(0, 120).replace(/\s+/g, " ");
  throw new Error(`Server response was not an M3U playlist. Got: ${preview || "(empty)"}`);
}

async function probeMiddleware(baseUrl: string): Promise<{ url: string; text: string } | null> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return null;
  }
  for (const path of MIDDLEWARE_CANDIDATES) {
    const candidate = origin + path;
    if (candidate === baseUrl) continue;
    try {
      const text = await fetchM3uText(candidate);
      if (isM3u(text)) return { url: candidate, text };
    } catch {
      continue;
    }
  }
  return null;
}

function isM3u(text: string): boolean {
  return text.replace(/^﻿/, "").trimStart().startsWith("#EXTM3U");
}

function parseAndShape(src: IptvPlaylistSource, text: string): IptvPlaylist {
  const channels = parseM3u(text, src.id);
  if (channels.length === 0) {
    throw new Error("Playlist parsed but contained no channels.");
  }
  return shapePlaylist(src, channels);
}

export { XtreamAuthError, XtreamEmptyError };
