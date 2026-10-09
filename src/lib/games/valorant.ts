import { readGuideSource } from "./guides-fetch";
import { CompanionRequests } from "./companion-request";
import { VALORANT_API, parseValorantAgents, parseValorantMaps, parseValorantMeta, parseValorantWeapons, valorantLocale, valorantMetaUrl, type ValorantFilters } from "./valorant-data";

// The shared reader bounds responses, honors rate limits and rejects failed parses.
const reference = new CompanionRequests((url, signal) => readGuideSource(url, signal, JSON.parse, 0));
export function loadValorantAgents(language: string, signal: AbortSignal) {
  return reference.get(`${VALORANT_API}/agents?isPlayableCharacter=true&language=${valorantLocale(language)}`, 86_400_000, parseValorantAgents, signal);
}
export function loadValorantMaps(language: string, signal: AbortSignal) {
  return reference.get(`${VALORANT_API}/maps?language=${valorantLocale(language)}`, 86_400_000, parseValorantMaps, signal);
}
export function loadValorantWeapons(language: string, signal: AbortSignal) {
  return reference.get(`${VALORANT_API}/weapons?language=${valorantLocale(language)}`, 86_400_000, parseValorantWeapons, signal);
}
const meta = new CompanionRequests((url, signal) => readGuideSource(url, signal, html => html, 0));
export function loadValorantMeta(filters: ValorantFilters, signal: AbortSignal, refresh = false) {
  return meta.get(valorantMetaUrl(filters), refresh ? 0 : 600_000, html => parseValorantMeta(html, filters), signal);
}
