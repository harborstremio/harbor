import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { XIV_MARKET, parseXivCenters, parseXivMarket, parseXivSearch, xivMarketUrl, xivSearchUrl, type XivCenter } from "./ffxiv-data";

const cooldown = new Map<string, number>();
const requests = new CompanionRequests(async (url, signal) => {
  const origin = new URL(url).origin;
  if ((cooldown.get(origin) ?? 0) > Date.now()) throw Error("Market source rate limited");
  const response = await safeFetchBytes(url, { signal, credentials: "omit" }, 12_000, 512 * 1024);
  if (response.status === 429) cooldown.set(origin, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`Market source ${response.status}`);
  const reader = response.body?.getReader(); let body = "", bytes = 0;
  if (reader) { const decoder = new TextDecoder(); try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 512 * 1024) throw Error("Market response too large"); body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); } }
  else { body = await response.text(); if (new TextEncoder().encode(body).length > 512 * 1024) throw Error("Market response too large"); }
  return JSON.parse(body) as unknown;
});
export async function loadXivCenters(signal: AbortSignal, refresh = false) {
  const ttl = refresh ? 0 : 86_400_000;
  const [centers, worlds] = await Promise.all([requests.get(`${XIV_MARKET}/data-centers`, ttl, value => value, signal), requests.get(`${XIV_MARKET}/worlds`, ttl, value => value, signal)]);
  return parseXivCenters(centers.data, worlds.data);
}
export function searchXivItems(query: string, language: string, signal: AbortSignal, next?: { cursor: string; version: string }) {
  return requests.get(xivSearchUrl(query, language, next?.cursor, next?.version), 60 * 60_000, raw => parseXivSearch(raw, next?.version), signal);
}
export function loadXivMarket(center: XivCenter, item: number, world: number | null, quality: string, signal: AbortSignal, refresh = false) {
  return requests.get(xivMarketUrl(center, item, world, quality), refresh ? 30_000 : 5 * 60_000, raw => parseXivMarket(raw, center, item, world, quality), signal);
}
