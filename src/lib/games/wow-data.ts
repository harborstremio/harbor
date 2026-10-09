export const WOW_REGIONS = ["us", "eu", "kr", "tw", "cn"] as const;
export type WowRegion = typeof WOW_REGIONS[number];
export const WOW_WEEK_TTL = 10 * 60_000;
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const time = (value: unknown) => typeof value === "string" ? Date.parse(value) : NaN;
const slug = (value: unknown) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length < 100 ? value : "";
export function wowRegion(value: unknown): WowRegion { return WOW_REGIONS.includes(value as WowRegion) ? value as WowRegion : "us"; }
export function wowLocale(language: string): string { return ({ zh: "cn", ko: "ko", ru: "ru", pt: "pt", it: "it", fr: "fr", es: "es", de: "de" } as Record<string, string>)[language] ?? "en"; }
export function wowImage(value: unknown): string {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && url.hostname === "cdn.raiderio.net" && !url.username && !url.password && !url.port && /^\/images\/(?:wow\/icons|dungeons)\/.+\.(?:jpg|png|webp)$/.test(url.pathname) ? url.href : "";
  } catch { return ""; }
}
export type WowPeriod = { region: WowRegion; current: number; periods: { id: number; start: number; end: number }[] };
export function parseWowPeriods(raw: unknown): WowPeriod[] {
  const list = row(raw).periods;
  if (!Array.isArray(list) || list.length > 10) throw Error("Invalid reset periods");
  const seen = new Set<string>();
  const result = list.flatMap(value => {
    const item = row(value), region = item.region as WowRegion;
    if (!WOW_REGIONS.includes(region) || seen.has(region)) return [];
    seen.add(region);
    const periods = [item.previous, item.current, item.next].flatMap(value => {
      const period = row(value), start = time(period.start), end = time(period.end);
      return id(period.period) && Number.isFinite(start) && end > start && end - start <= 8 * 86400_000 ? [{ id: period.period, start, end }] : [];
    });
    return periods.length ? [{ region, current: Number(row(item.current).period), periods }] : [];
  });
  if (!result.length) throw Error("Missing reset periods");
  return result;
}
export function activeWowPeriod(data: WowPeriod[], region: WowRegion, now: number) {
  const observed = data.find(item => item.region === region);
  const period = observed?.periods.find(item => item.start <= now && item.end > now);
  return period ? { ...period, matchesProvider: period.id === observed?.current } : null;
}
export type WowAffixes = { region: WowRegion; season: string; url: string; affixes: { id: number; name: string; description: string; image: string }[] };
export function parseWowAffixes(raw: unknown): WowAffixes {
  const item = row(raw), region = item.region as WowRegion;
  if (!WOW_REGIONS.includes(region) || !Array.isArray(item.affix_details) || item.affix_details.length > 20) throw Error("Invalid affix data");
  const url = new URL(String(item.leaderboard_url));
  const season = url.pathname.match(/^\/mythic-plus-affix-rankings\/(season-[a-z0-9-]+)\//)?.[1];
  if (url.protocol !== "https:" || url.hostname !== "raider.io" || url.username || url.password || url.port || !season) throw Error("Invalid season identity");
  const seen = new Set<number>();
  const affixes = item.affix_details.flatMap(value => {
    const affix = row(value), name = text(affix.name), description = text(affix.description, 2000);
    if (!id(affix.id) || !name || !description || seen.has(affix.id)) return [];
    seen.add(affix.id); return [{ id: affix.id, name, description, image: wowImage(affix.icon_url) }];
  });
  if (!affixes.length) throw Error("Missing affixes");
  return { region, season, url: url.href, affixes };
}
// Published expansion identifiers. An unknown future season fails closed instead
// of falling back to an old dungeon pool labelled as current.
export function wowExpansion(season: string): number | null {
  const prefix = season.match(/^season-(mn|tww|df|sl|bfa)-\d/)?.[1];
  return prefix ? ({ mn: 11, tww: 10, df: 9, sl: 8, bfa: 7 } as Record<string, number>)[prefix]! : null;
}
export type WowDungeon = { id: number; slug: string; name: string; seconds: number; image: string };
export type WowSeason = { slug: string; name: string; start: number; end: number; dungeons: WowDungeon[] };
export function parseWowSeason(raw: unknown, season: string, region: WowRegion): WowSeason | null {
  const seasons = row(raw).seasons;
  if (!Array.isArray(seasons) || seasons.length > 100) throw Error("Invalid seasons");
  const item = row(seasons.find(value => row(value).slug === season && row(value).is_main_season === true));
  if (!item.slug) return null;
  const start = time(row(item.starts)[region]), end = time(row(item.ends)[region]);
  if (!Number.isFinite(start) || !(end > start) || !Array.isArray(item.dungeons) || item.dungeons.length > 50) throw Error("Invalid season");
  const seen = new Set<number>();
  const dungeons = item.dungeons.flatMap(value => {
    const dungeon = row(value), name = text(dungeon.name), key = slug(dungeon.slug), seconds = dungeon.keystone_timer_seconds;
    if (!id(dungeon.id) || !name || !key || !id(seconds) || seconds > 14_400 || seen.has(dungeon.id)) return [];
    seen.add(dungeon.id); return [{ id: dungeon.id, slug: key, name, seconds, image: wowImage(dungeon.background_image_url) }];
  });
  return { slug: season, name: text(item.name), start, end, dungeons };
}
export type WowEncounter = { id: number | null; slug: string; name: string };
export type WowRaid = { slug: string; name: string; start: number; end: number; bosses: WowEncounter[]; image: string };
export function parseWowRaids(raw: unknown, region: WowRegion): WowRaid[] {
  const list = row(raw).raids;
  if (!Array.isArray(list) || list.length > 100) throw Error("Invalid raids");
  return list.flatMap(value => {
    const item = row(value), name = text(item.name), key = slug(item.slug), start = time(row(item.starts)[region]), end = time(row(item.ends)[region]);
    if (!key || !name || !Number.isFinite(start) || !(end > start) || !Array.isArray(item.encounters) || item.encounters.length > 50) return [];
    const bosses = item.encounters.flatMap(value => {
      const encounter = row(value), name = text(encounter.name);
      return name ? [{ id: id(encounter.id) ? encounter.id : null, slug: slug(encounter.slug), name }] : [];
    });
    const icon = typeof item.icon === "string" && /^[a-z0-9_]{1,120}$/.test(item.icon) ? item.icon : "";
    return bosses.length ? [{ slug: key, name, start, end, bosses, image: icon ? `https://cdn.raiderio.net/images/wow/icons/large/${icon}.jpg` : "" }] : [];
  });
}
export function wowDungeonUrl(season: string, dungeon: string, region: WowRegion): string {
  return `https://raider.io/mythic-plus-rankings/${encodeURIComponent(season)}/${encodeURIComponent(dungeon)}/${region}/leaderboards`;
}
export function retryAfterTime(value: string | null, now: number): number {
  const seconds = value && /^\d+$/.test(value) ? Number(value) : NaN;
  const at = Number.isFinite(seconds) ? now + seconds * 1000 : value ? Date.parse(value) : NaN;
  return Number.isFinite(at) && at > now ? at : now + 60_000;
}
