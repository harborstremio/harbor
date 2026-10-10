import { safeFetchBytes } from "@/lib/safe-fetch";
import { GameRequestPool } from "./request-pool";
import { parseGameNews, parseGameReviews, parseReviewAuthor, reviewAuthorRequest, reviewRequest, type GameNews, type GameReviewAuthor, type GameReviewFilters, type GameReviewPage } from "./community";

const pool = new GameRequestPool(2);
const authorPool = new GameRequestPool(2);
const cache = new Map<string, { at: number; data: unknown }>();
const LIMIT = 2 * 1024 * 1024;

async function load<T>(url: string, parse: (value: unknown) => T, signal: AbortSignal, refresh = false, requests = pool, limit = LIMIT): Promise<T> {
  signal.throwIfAborted();
  const held = cache.get(url);
  if (!refresh && held && Date.now() - held.at < 10 * 60_000) return held.data as T;
  return requests.run(async () => {
    const response = await safeFetchBytes(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]) }, 12_000, limit);
    if (!response.ok) throw Error(`Steam ${response.status}`);
    if (Number(response.headers.get("content-length")) > limit) throw Error("Steam response too large");
    const reader = response.body?.getReader(), decoder = new TextDecoder();
    let body = "", bytes = 0;
    if (reader) {
      try {
        while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > limit) throw Error("Steam response too large"); body += decoder.decode(part.value, { stream: true }); }
        body += decoder.decode();
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } else { body = await response.text(); if (body.length > limit) throw Error("Steam response too large"); }
    const data = parse(JSON.parse(body));
    signal.throwIfAborted();
    cache.delete(url); cache.set(url, { at: Date.now(), data });
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    return data;
  }, signal);
}

export function loadGameNews(appId: number, signal: AbortSignal, refresh = false): Promise<GameNews[]> {
  if (!Number.isSafeInteger(appId) || appId <= 0) return Promise.reject(Error("Invalid game ID"));
  // Steam's maxlength mode removes block boundaries ("INTRODuring"). Parse the original markup locally.
  return load(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=6&maxlength=0&feeds=steam_community_announcements`, value => parseGameNews(value, appId), signal, refresh);
}
export function loadGameReviews(appId: number, filters: GameReviewFilters, cursor: string, signal: AbortSignal): Promise<GameReviewPage> {
  return load(reviewRequest(appId, filters, cursor), value => parseGameReviews(value, cursor), signal);
}
export function loadReviewAuthor(steamId: string, signal: AbortSignal): Promise<GameReviewAuthor> {
  return load(reviewAuthorRequest(steamId), parseReviewAuthor, signal, false, authorPool, 64 * 1024);
}
