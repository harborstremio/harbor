export const DOTA_STEAM_ID = 570;
export const DOTA_API = "https://api.opendota.com/api";
export const DOTA_TTL = 15 * 60_000;
export const DOTA_LOGO = "https://cdn.steamstatic.com/apps/dota2/images/dota_react/global/dota2_logo_horiz.png";
export const DOTA_SAMPLES = ["pub", "1", "2", "3", "4", "5", "6", "7", "8", "turbo", "pro"] as const;
export type DotaSample = typeof DOTA_SAMPLES[number];
export const DOTA_ATTRIBUTES = ["str", "agi", "int", "all"] as const;
export type DotaAttribute = typeof DOTA_ATTRIBUTES[number];
export type DotaRecord = { games: number; wins: number };
export type DotaHero = { id: number; key: string; name: string; image: string; attribute: DotaAttribute; samples: Record<DotaSample, DotaRecord | null> };
export type DotaList<T> = { items: T[]; partial: boolean };
export type DotaMatchup = DotaRecord & { id: number };
const row = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
export function dotaHeroId(value: unknown): value is number { return count(value) && value > 0 && value < 10000; }
function record(games: unknown, wins: unknown): DotaRecord | null {
  return count(games) && count(wins) && wins <= games ? { games, wins } : null;
}
export function dotaHeroImage(path: unknown) {
  // OpenDota publishes Valve-relative image paths, not arbitrary image hosts.
  return typeof path === "string" && /^\/apps\/dota2\/images\/dota_react\/heroes\/[a-z0-9_]+\.png\??$/.test(path)
    ? `https://cdn.steamstatic.com${path.replace(/\?$/, "")}` : "";
}
export function parseDotaHeroes(raw: unknown): DotaList<DotaHero> {
  if (!Array.isArray(raw) || !raw.length || raw.length > 500) throw Error("Invalid Dota hero roster");
  const seen = new Set<number>(); let partial = false;
  const items = raw.flatMap(value => {
    const hero = row(value), key = typeof hero.name === "string" ? hero.name.match(/^npc_dota_hero_([a-z0-9_]{1,70})$/)?.[1] : "";
    const name = typeof hero.localized_name === "string" ? hero.localized_name.trim().slice(0, 120) : "";
    if (!dotaHeroId(hero.id) || !key || !name || !DOTA_ATTRIBUTES.includes(hero.primary_attr as DotaAttribute) || seen.has(hero.id)) { partial = true; return []; }
    seen.add(hero.id);
    const samples = Object.fromEntries(DOTA_SAMPLES.map(sample => {
      const suffix = sample === "turbo" ? "s" : "";
      const stats = record(hero[`${sample}_pick${suffix}`], hero[`${sample}_win${suffix}`]);
      if (!stats) partial = true;
      return [sample, stats];
    })) as DotaHero["samples"];
    return [{ id: hero.id, key, name, image: dotaHeroImage(hero.img), attribute: hero.primary_attr as DotaAttribute, samples }];
  });
  if (!items.length) throw Error("Missing Dota heroes");
  return { items, partial };
}
export function parseDotaMatchups(raw: unknown, selected: number): DotaList<DotaMatchup> {
  if (!dotaHeroId(selected) || !Array.isArray(raw) || raw.length > 500) throw Error("Invalid Dota matchups");
  const seen = new Set<number>(); let partial = false;
  const items = raw.flatMap(value => {
    const item = row(value), stats = record(item.games_played, item.wins);
    if (!dotaHeroId(item.hero_id) || item.hero_id === selected || seen.has(item.hero_id) || !stats) { partial = true; return []; }
    seen.add(item.hero_id); return [{ id: item.hero_id, ...stats }];
  });
  if (raw.length && !items.length) throw Error("No usable Dota matchups");
  return { items, partial };
}
export function dotaWinRate(stats: DotaRecord | null) { return stats && stats.games > 0 ? stats.wins / stats.games : null; }
export function filterDotaHeroes(heroes: DotaHero[], query: string, attribute: string, sample: DotaSample, sort: string): DotaHero[] {
  const search = query.trim().toLocaleLowerCase();
  return heroes.filter(hero => (!attribute || hero.attribute === attribute) && hero.name.toLocaleLowerCase().includes(search)).sort((a, b) => {
    const value = (hero: DotaHero) => sort === "win" ? dotaWinRate(hero.samples[sample]) ?? -1 : hero.samples[sample]?.games ?? -1;
    return (sort === "name" ? 0 : value(b) - value(a)) || a.name.localeCompare(b.name) || a.id - b.id;
  });
}
export function filterDotaMatchups(items: DotaMatchup[], heroes: DotaHero[], query: string, minimum: number, sort: string) {
  const roster = new Map(heroes.map(hero => [hero.id, hero])), search = query.trim().toLocaleLowerCase();
  return items.flatMap(item => {
    const hero = roster.get(item.id);
    return hero && item.games >= minimum && hero.name.toLocaleLowerCase().includes(search) ? [{ ...item, hero }] : [];
  }).sort((a, b) => {
    const ar = dotaWinRate(a), br = dotaWinRate(b);
    if (sort !== "games") {
      if (ar === null || br === null) return ar === br ? b.games - a.games : ar === null ? 1 : -1;
      const difference = sort === "low" ? ar - br : br - ar;
      if (difference) return difference;
    }
    return b.games - a.games || a.hero.name.localeCompare(b.hero.name);
  });
}
