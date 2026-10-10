import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { retryAfterTime } from "./wow-data";
import { DRAGON, LEAGUE_MCP, leagueApiName, leagueKey, leagueLocale, leaguePatch, parseLeagueAssets, parseLeagueBuild, parseLeagueCatalog, parseLeagueKit, parseLeagueMeta, type LeagueChampion, type LeagueRole } from "./league-data";
import { parseLeagueWire } from "./league-wire";
import { LEAGUE_STATS, parseLeagueTiers, parseLeagueVersions } from "./league-tier-data";

const TTL = 24 * 3600_000, META_TTL = 15 * 60_000, MAX = 1_500_000;
const retryAt = new Map<string, number>();
const requests = new CompanionRequests(async (key, signal) => {
  const input = new URL(key), isMeta = input.origin === new URL(LEAGUE_MCP).origin;
  if (Date.now() < (retryAt.get(input.host) ?? 0)) throw Error("League source cooling down");
  const response = await safeFetchBytes(isMeta ? LEAGUE_MCP : key, {
    signal, credentials: "omit", ...(isMeta ? { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: JSON.parse(input.searchParams.get("request")!) }) } : {}),
  }, 15_000, MAX);
  if (response.status === 429 || response.status === 503) retryAt.set(input.host, retryAfterTime(response.headers.get("retry-after"), Date.now()));
  if (!response.ok) throw Error(`League source ${response.status}`);
  const reader = response.body?.getReader(); let text = "";
  if (reader) {
    const decoder = new TextDecoder(); let bytes = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > MAX) throw Error("League response too large"); text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  } else { text = await response.text(); if (new TextEncoder().encode(text).length > MAX) throw Error("League response too large"); }
  return JSON.parse(text) as unknown;
});
export async function loadLeagueCatalog(language: string, signal: AbortSignal, refresh = false) {
  const version = await requests.get(`${DRAGON}/api/versions.json`, refresh ? 0 : 3600_000, raw => {
    const latest = Array.isArray(raw) && leaguePatch(raw[0]); if (!latest) throw Error("League patch unavailable"); return latest;
  }, signal);
  const patch = version.data;
  const champions = await requests.get(`${DRAGON}/cdn/${patch}/data/${leagueLocale(language)}/champion.json`, TTL, raw => parseLeagueCatalog(raw, patch), signal);
  return { data: { patch, champions: champions.data }, at: champions.at };
}
function opggKey(name: "lol_list_lane_meta_champions" | "lol_get_champion_analysis", args: Record<string, unknown>) {
  return `${LEAGUE_MCP}?request=${encodeURIComponent(JSON.stringify({ name, arguments: args }))}`;
}
export function loadLeagueMeta(signal: AbortSignal, refresh = false) {
  return requests.get(opggKey("lol_list_lane_meta_champions", { lang: "en_US", position: "all", desired_output_fields: ["data.positions", "position_filter"] }), refresh ? 0 : META_TTL, raw => parseLeagueMeta(parseLeagueWire(raw)), signal);
}
export function loadLeagueVersions(signal: AbortSignal, refresh = false) {
  return requests.get(`${LEAGUE_STATS}/meta/versions?hl=en_US`, refresh ? 0 : 3600_000, parseLeagueVersions, signal);
}
export function loadLeagueTiers(patch: string, signal: AbortSignal, refresh = false) {
  if (!leaguePatch(patch)) return Promise.reject(Error("Invalid League patch"));
  return requests.get(`${LEAGUE_STATS}/global/champions/ranked?tier=emerald_plus&version=${encodeURIComponent(patch)}`, refresh ? 0 : META_TTL, raw => parseLeagueTiers(raw, patch), signal);
}
export function loadLeagueBuild(champion: LeagueChampion, role: LeagueRole, signal: AbortSignal, refresh = false) {
  return requests.get(opggKey("lol_get_champion_analysis", { champion: leagueApiName(champion), position: role, game_mode: "ranked", tier: "all", lang: "en_US", desired_output_fields: ["champion", "position", "data.summary.id", "data.core_items", "data.boots", "data.starter_items", "data.runes", "data.summoner_spells", "data.skills", "data.skill_masteries.ids", "data.strong_counters", "data.weak_counters", "data.skill_combos", "data.trends.win"] }), refresh ? 0 : META_TTL, raw => parseLeagueBuild(parseLeagueWire(raw), champion, role), signal);
}
export function loadLeagueKit(champion: LeagueChampion, patch: string, language: string, signal: AbortSignal) {
  if (!leagueKey(champion.key) || !leaguePatch(patch)) return Promise.reject(Error("Invalid champion"));
  return requests.get(`${DRAGON}/cdn/${patch}/data/${leagueLocale(language)}/champion/${champion.key}.json`, TTL, raw => parseLeagueKit(raw, champion, patch), signal);
}
export function loadLeagueAssets(patch: string, language: string, kind: "item" | "spell" | "rune", signal: AbortSignal) {
  if (!leaguePatch(patch)) return Promise.reject(Error("Invalid League patch"));
  const file = kind === "rune" ? "runesReforged" : kind === "spell" ? "summoner" : "item";
  return requests.get(`${DRAGON}/cdn/${patch}/data/${leagueLocale(language)}/${file}.json`, TTL, raw => parseLeagueAssets(raw, patch, kind), signal);
}
