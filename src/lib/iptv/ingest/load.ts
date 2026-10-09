import { parseM3uAsync } from "../parse-m3u-async";
import { fetchM3uText, shapePlaylist } from "../store";
import { liveContainerPref } from "../settings-bridge";
import type { IptvChannel, IptvPlaylist, IptvPlaylistSource } from "../types";
import {
  fetchXtreamLiveChannels,
  fetchXtreamUserInfo,
  XtreamAuthError,
  XtreamEmptyError,
  type XtreamCreds,
} from "../xtream";
import type { ProviderShape } from "./detect";

const MIDDLEWARE_CANDIDATES = ["/iptv/m3u", "/m3u", "/playlist.m3u", "/get.php?type=m3u_plus"];

export async function loadFromShape(
  src: IptvPlaylistSource,
  shape: ProviderShape,
  onProgress?: (channels: IptvChannel[]) => void,
  signal?: AbortSignal,
): Promise<IptvPlaylist> {
  signal?.throwIfAborted();
  if (shape.kind === "invalid") throw new Error(shape.reason);
  if (shape.kind === "epg") return shapePlaylist({ ...src, url: shape.url }, []);
  if (shape.kind === "xtream") return loadXtream(src, shape.creds, onProgress, signal);
  return loadM3u(src, shape.url, shape.middleware, onProgress, signal);
}

async function loadXtream(
  src: IptvPlaylistSource,
  creds: XtreamCreds,
  onProgress?: (channels: IptvChannel[]) => void,
  signal?: AbortSignal,
): Promise<IptvPlaylist> {
  const caps = await fetchXtreamUserInfo(creds, signal);
  const container = liveContainerPref();
  const live = await fetchXtreamLiveChannels(creds, src.id, container, caps, onProgress, signal);
  if (live.length === 0) {
    throw new XtreamEmptyError(
      "Logged in to the Xtream server, but it returned no live channels. The account may have no active package.",
    );
  }
  return shapePlaylist(src, live);
}

async function loadM3u(
  src: IptvPlaylistSource,
  url: string,
  middleware: boolean,
  onProgress?: (channels: IptvChannel[]) => void,
  signal?: AbortSignal,
): Promise<IptvPlaylist> {
  const text = await fetchM3uText(url, signal);
  if (isM3u(text)) return parseAndShape(src, text, onProgress, signal);
  if (middleware) {
    const recovered = await probeMiddleware(url, signal);
    if (recovered)
      return parseAndShape({ ...src, url: recovered.url }, recovered.text, onProgress, signal);
  }
  const preview = text.slice(0, 120).replace(/\s+/g, " ");
  throw new Error(`Server response was not an M3U playlist. Got: ${preview || "(empty)"}`);
}

async function probeMiddleware(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<{ url: string; text: string } | null> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return null;
  }
  for (const path of MIDDLEWARE_CANDIDATES) {
    signal?.throwIfAborted();
    const candidate = origin + path;
    if (candidate === baseUrl) continue;
    try {
      const text = await fetchM3uText(candidate, signal);
      if (isM3u(text)) return { url: candidate, text };
    } catch {
      signal?.throwIfAborted();
      continue;
    }
  }
  return null;
}

function isM3u(text: string): boolean {
  return text.replace(/^﻿/, "").trimStart().startsWith("#EXTM3U");
}

async function parseAndShape(
  src: IptvPlaylistSource,
  text: string,
  onProgress?: (channels: IptvChannel[]) => void,
  signal?: AbortSignal,
): Promise<IptvPlaylist> {
  const channels = await parseM3uAsync(text, src.id, onProgress, signal);
  if (channels.length === 0) {
    throw new Error("Playlist parsed but contained no channels.");
  }
  return shapePlaylist(src, channels);
}

export { XtreamAuthError, XtreamEmptyError };
