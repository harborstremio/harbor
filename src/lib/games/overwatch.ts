import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { OVERWATCH_API, OVERWATCH_TTL, overwatchKey, overwatchLocale, parseOverwatchHeroes, parseOverwatchHero, parseOverwatchMaps, parseOverwatchModes, type OverwatchHero } from "./overwatch-data";

const MAX_BYTES = 2 * 1024 * 1024;
let retryAt = 0;
const requests = new CompanionRequests(async (url, signal) => {
  if (Date.now() < retryAt) throw Error("Overwatch provider is rate limiting requests");
  const response = await safeFetchBytes(url, { signal, credentials: "omit" }, 15_000, MAX_BYTES);
  if (response.status === 429 || response.status === 503) retryAt = Math.max(retryAt, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`Overwatch provider ${response.status}`);
  const reader = response.body?.getReader(); let text = "";
  if (reader) {
    let size = 0; const decoder = new TextDecoder();
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_BYTES) throw Error("Overwatch response too large"); text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } else { text = await response.text(); if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("Overwatch response too large"); }
  return JSON.parse(text) as unknown;
});
export function loadOverwatchHeroes(language: string, signal: AbortSignal, refresh = false) {
  return requests.get(`${OVERWATCH_API}/heroes?locale=${overwatchLocale(language)}`, refresh ? 0 : OVERWATCH_TTL, parseOverwatchHeroes, signal);
}
export function loadOverwatchHero(hero: OverwatchHero, language: string, signal: AbortSignal, refresh = false) {
  if (!overwatchKey(hero.key)) return Promise.reject(Error("Invalid Overwatch hero"));
  // Cache raw detail per locale; validate against today's roster even on a cache hit.
  return requests.get(`${OVERWATCH_API}/heroes/${hero.key}?locale=${overwatchLocale(language)}`, refresh ? 0 : OVERWATCH_TTL, raw => { parseOverwatchHero(raw, hero); return raw; }, signal)
    .then(value => ({ at: value.at, data: parseOverwatchHero(value.data, hero) }));
}
export function loadOverwatchMaps(signal: AbortSignal, refresh = false) {
  return requests.get(`${OVERWATCH_API}/maps`, refresh ? 0 : OVERWATCH_TTL, parseOverwatchMaps, signal);
}
export function loadOverwatchModes(signal: AbortSignal, refresh = false) {
  return requests.get(`${OVERWATCH_API}/gamemodes`, refresh ? 0 : OVERWATCH_TTL, parseOverwatchModes, signal);
}
