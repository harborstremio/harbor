import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { DOTA_API, DOTA_TTL, dotaHeroId, parseDotaHeroes, parseDotaMatchups } from "./dota-data";

const MAX_BYTES = 1024 * 1024;
let retryAt = 0;
const requests = new CompanionRequests(async (url, signal) => {
  if (Date.now() < retryAt) throw Error("OpenDota is rate limiting requests");
  const response = await safeFetchBytes(url, { signal, credentials: "omit" }, 15_000, MAX_BYTES);
  if (response.status === 429 || response.status === 503) retryAt = Math.max(retryAt, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`OpenDota ${response.status}`);
  const reader = response.body?.getReader(); let text = "";
  if (reader) {
    let size = 0; const decoder = new TextDecoder();
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_BYTES) throw Error("OpenDota response too large"); text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } else { text = await response.text(); if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("OpenDota response too large"); }
  return JSON.parse(text) as unknown;
});
export function loadDotaHeroes(signal: AbortSignal, refresh = false) {
  return requests.get(`${DOTA_API}/heroStats`, refresh ? 0 : DOTA_TTL, parseDotaHeroes, signal);
}
export function loadDotaMatchups(hero: number, signal: AbortSignal, refresh = false) {
  if (!dotaHeroId(hero)) return Promise.reject(Error("Invalid Dota hero"));
  return requests.get(`${DOTA_API}/heroes/${hero}/matchups`, refresh ? 0 : DOTA_TTL, raw => parseDotaMatchups(raw, hero), signal);
}
