import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { parseWowAffixes, parseWowPeriods, parseWowRaids, parseWowSeason, retryAfterTime, wowExpansion, wowLocale, WOW_WEEK_TTL, type WowRegion } from "./wow-data";
import { parseWowCharacter, wowCharacterUrl, type WowCharacterTarget } from "./wow-character-data";
import { parseWowDungeonRuns, parseWowRunEquipment, wowRunQueryUrl, type WowDungeonRun, type WowRunQuery } from "./wow-dungeon-runs";

const BASE = "https://raider.io/api/v1", MAX_BYTES = 2 * 1024 * 1024;
let retryAt = 0;
export class WowApiError extends Error { constructor(public status: number) { super(`Raider.IO ${status}`); } }
const requests = new CompanionRequests(async (url, signal) => {
  if (Date.now() < retryAt) throw new WowApiError(429);
  const response = await safeFetchBytes(url, { signal }, 15_000, MAX_BYTES);
  if (response.status === 429) retryAt = Math.max(retryAt, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw new WowApiError(response.status);
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text(); if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("WoW response too large");
    return JSON.parse(text) as unknown;
  }
  let size = 0, text = ""; const decoder = new TextDecoder();
  try {
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_BYTES) throw Error("WoW response too large"); text += decoder.decode(part.value, { stream: true }); }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
});

export async function loadWowCompanion(region: WowRegion, language: string, signal: AbortSignal) {
  const [periods, affixes] = await Promise.allSettled([
    requests.get(`${BASE}/periods`, WOW_WEEK_TTL, parseWowPeriods, signal),
    requests.get(`${BASE}/mythic-plus/affixes?region=${region}&locale=${wowLocale(language)}`, WOW_WEEK_TTL, raw => { const value = parseWowAffixes(raw); if (value.region !== region) throw Error("Wrong region"); return value; }, signal),
  ]);
  signal.throwIfAborted();
  if (periods.status === "rejected" && affixes.status === "rejected") throw Error("WoW weekly data unavailable");
  const affixData = affixes.status === "fulfilled" ? affixes.value.data : null;
  const expansion = affixData ? wowExpansion(affixData.season) : null;
  const [season, raids] = await Promise.allSettled(expansion && affixData ? [
    requests.get(`${BASE}/mythic-plus/static-data?expansion_id=${expansion}`, 6 * 3600_000, raw => { parseWowSeason(raw, affixData.season, region); return raw; }, signal).then(value => parseWowSeason(value.data, affixData.season, region)),
    requests.get(`${BASE}/raiding/static-data?expansion_id=${expansion}`, 6 * 3600_000, raw => { parseWowRaids(raw, region); return raw; }, signal).then(value => parseWowRaids(value.data, region)),
  ] : [Promise.resolve(null), Promise.resolve(null)] as const);
  signal.throwIfAborted();
  return { region, periods: periods.status === "fulfilled" ? periods.value.data : [], affixes: affixData,
    season: season.status === "fulfilled" ? season.value : null, raids: raids.status === "fulfilled" ? raids.value : null,
    observedAt: Math.min(...[periods, affixes].flatMap(value => value.status === "fulfilled" ? [value.value.at] : [])) };
}
export type WowCompanionData = Awaited<ReturnType<typeof loadWowCompanion>>;

export const WOW_CHARACTER_TTL = 5 * 60_000;
export function loadWowCharacter(target: WowCharacterTarget, season: string | null, signal: AbortSignal, refresh = false) {
  return requests.get(wowCharacterUrl(target, season), refresh ? 0 : WOW_CHARACTER_TTL, raw => parseWowCharacter(raw, target, season), signal);
}

export function loadWowDungeonRuns(query: WowRunQuery, signal: AbortSignal, refresh = false) {
  return requests.get(wowRunQueryUrl(query), refresh ? 0 : WOW_WEEK_TTL, raw => parseWowDungeonRuns(raw, query), signal);
}
export function loadWowRunEquipment(query: WowRunQuery, run: WowDungeonRun, signal: AbortSignal, refresh = false) {
  wowRunQueryUrl(query);
  if (!Number.isSafeInteger(run.id) || run.id <= 0) return Promise.reject(Error("Invalid run identity"));
  return requests.get(`${BASE}/mythic-plus/run-details?${new URLSearchParams({ season: query.season, id: String(run.id) })}`, refresh ? 0 : WOW_WEEK_TTL, raw => parseWowRunEquipment(raw, query, run), signal);
}
