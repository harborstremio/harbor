import { safeFetchBytes } from "@/lib/safe-fetch";
import { GameRequestPool } from "./request-pool";
import { detailExtrasRequest, parseDetailExtras, parseDeckCompatibility, parsePublicAchievements, parseGameBroadcasts, type GameBroadcast, type GameDetailExtras, type PublicGameAchievement } from "./detail-extras-data";

const pool = new GameRequestPool(2);
const cache = new Map<string, { at: number; data: unknown }>();
const LIMIT = 2 * 1024 * 1024;

async function load<T>(url: string, parse: (body: string) => T, signal: AbortSignal, ttl = 30 * 60_000): Promise<T> {
  signal.throwIfAborted();
  const held = cache.get(url);
  if (held && Date.now() - held.at < ttl) return held.data as T;
  return pool.run(async () => {
    const response = await safeFetchBytes(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) }, 15_000, LIMIT);
    if (!response.ok) throw Error(`Steam ${response.status}`);
    if (Number(response.headers.get("content-length")) > LIMIT) throw Error("Detail response too large");
    const reader = response.body?.getReader(), decoder = new TextDecoder();
    let body = "", bytes = 0;
    if (reader) {
      try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > LIMIT) throw Error("Detail response too large"); body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } else { body = await response.text(); if (body.length > LIMIT) throw Error("Detail response too large"); }
    const data = parse(body); signal.throwIfAborted();
    cache.delete(url); cache.set(url, { at: Date.now(), data });
    if (cache.size > 60) cache.delete(cache.keys().next().value!);
    return data;
  }, signal);
}

export async function loadDetailExtras(appId: number, signal: AbortSignal): Promise<GameDetailExtras> {
  const request = detailExtrasRequest(appId);
  const [extras, deck] = await Promise.allSettled([
    load(request, body => parseDetailExtras(JSON.parse(body), appId), signal),
    load(`https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport?nAppID=${appId}`, body => parseDeckCompatibility(JSON.parse(body), appId), signal),
  ]);
  signal.throwIfAborted();
  if (extras.status === "rejected") throw extras.reason;
  return { ...extras.value, ...(deck.status === "fulfilled" ? { deck: deck.value } : {}) };
}
export function loadPublicAchievements(appId: number, signal: AbortSignal): Promise<PublicGameAchievement[]> {
  if (!Number.isSafeInteger(appId) || appId <= 0) return Promise.reject(Error("Invalid game ID"));
  return load(`https://steamcommunity.com/stats/${appId}/achievements/?l=english`, body => parsePublicAchievements(body, appId), signal);
}
export function loadGameBroadcasts(appId: number, signal: AbortSignal): Promise<GameBroadcast[]> {
  if (!Number.isSafeInteger(appId) || appId <= 0) return Promise.reject(Error("Invalid game ID"));
  return load("https://store.steampowered.com/broadcast/ajaxgetpopularpartnerbroadcasts/", body => parseGameBroadcasts(JSON.parse(body)), signal, 60_000).then(items => items.filter(item => item.appId === appId).slice(0, 4));
}
