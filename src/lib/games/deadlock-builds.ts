import { deadlockRequests } from "./deadlock";
import { deadlockLanguage } from "./deadlock-data";
import { deadlockBuildItemsUrl, deadlockBuildsUrl, parseDeadlockBuildAbilities, parseDeadlockBuildItems, parseDeadlockBuilds, type DeadlockBuildSort } from "./deadlock-builds-data";

export function loadDeadlockBuilds(hero: number, sort: DeadlockBuildSort, query: string, language: string, start: number, signal: AbortSignal, refresh = false) {
  return deadlockRequests.get(deadlockBuildsUrl(hero, sort, query, language, start), refresh ? 0 : 10 * 60_000, raw => parseDeadlockBuilds(raw, hero), signal);
}
export async function loadDeadlockBuildDefinitions(hero: number, language: string, signal: AbortSignal, refresh = false) {
  const [items, abilities] = await Promise.allSettled([
    deadlockRequests.get(deadlockBuildItemsUrl(language), refresh ? 0 : 6 * 3600_000, parseDeadlockBuildItems, signal),
    deadlockRequests.get(`https://api.deadlock-api.com/v1/assets/items/by-hero-id/${hero}?language=${deadlockLanguage(language)}`, refresh ? 0 : 6 * 3600_000, raw => parseDeadlockBuildAbilities(raw, hero), signal),
  ]);
  signal.throwIfAborted();
  return { items: items.status === "fulfilled" ? items.value.data : [], abilities: abilities.status === "fulfilled" ? abilities.value.data : [], partial: items.status === "rejected" || abilities.status === "rejected" };
}
