import { isTauri } from "@tauri-apps/api/core";
import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { parseRivalsOfficial, parseRivalsPairs, parseRivalsStats, rivalsGuideUrl, RIVALS_OFFICIAL, RIVALS_SOURCE, RIVALS_TTL } from "./rivals-data";
import { parseRivalsGuide } from "./rivals-guide-data";

const MAX_BYTES = 2 * 1024 * 1024;
const cooldown = new Map<string, number>();
const requests = new CompanionRequests(async (url, signal) => {
  const host = new URL(url).hostname;
  if (Date.now() < (cooldown.get(host) ?? 0)) throw Error("Rivals provider is rate limiting requests");
  const headers = isTauri() ? { "User-Agent": "HarborGameCompanions/1.0" } : undefined;
  const response = await safeFetchBytes(url, { signal, credentials: "omit", headers }, 15_000, MAX_BYTES);
  if (response.status === 429) cooldown.set(host, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`Rivals provider ${response.status}`);
  const reader = response.body?.getReader(); let text = "";
  if (reader) {
    let size = 0; const decoder = new TextDecoder();
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > MAX_BYTES) throw Error("Rivals response too large"); text += decoder.decode(chunk.value, { stream: true }); } text += decoder.decode(); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } else { text = await response.text(); if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("Rivals response too large"); }
  return url === RIVALS_OFFICIAL || rivalsGuideUrl(url) ? text : JSON.parse(text) as unknown;
});
const statsUrl = `${RIVALS_SOURCE}/content/marvel-rivals/hero-tier-list.json`;
export function loadRivalsStats(signal: AbortSignal, refresh = false) { return requests.get(statsUrl, refresh ? 0 : RIVALS_TTL, parseRivalsStats, signal); }
export function loadRivalsOfficial(signal: AbortSignal, refresh = false) { return requests.get(RIVALS_OFFICIAL, refresh ? 0 : 24 * 3600_000, parseRivalsOfficial, signal); }
export function loadRivalsPairs(kind: "counters" | "synergy", signal: AbortSignal, refresh = false) { return requests.get(`${RIVALS_SOURCE}/content/marvel-rivals/hero-${kind}.json`, refresh ? 0 : RIVALS_TTL, parseRivalsPairs, signal); }
export function loadRivalsGuide(guide: { name: string; url: string }, signal: AbortSignal, refresh = false) {
  const url = rivalsGuideUrl(guide.url);
  if (!url) return Promise.reject(Error("Invalid official guide URL"));
  return requests.get(url, refresh ? 0 : 6 * 3600_000, raw => parseRivalsGuide(raw, guide.name), signal).then(value => {
    // A shared cached article must still match the requested canonical hero.
    if (value.data.name.toLowerCase().replace(/[^a-z0-9]/g, "") !== guide.name.toLowerCase().replace(/[^a-z0-9]/g, "")) throw Error("Hero reference identity mismatch");
    return value;
  });
}
