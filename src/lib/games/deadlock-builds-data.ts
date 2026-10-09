import { deadlockLanguage } from "./deadlock-data";

export const DEADLOCK_BUILD_PAGE = 8;
export type DeadlockBuildSort = "updated_at" | "weekly_favorites";
export type DeadlockBuildMod = { id: number; note: string; imbue: number | null; flex: number | null };
export type DeadlockBuildGroup = { name: string; note: string; optional: boolean; items: DeadlockBuildMod[] };
export type DeadlockBuild = { id: number; hero: number; version: number; name: string; note: string; updated: number | null; weekly: number | null; groups: DeadlockBuildGroup[] };
export type DeadlockBuildItem = { id: number; name: string; image: string; cost: number | null; shopable: boolean; slot: string };
export type DeadlockBuildAbility = { id: number; name: string; image: string };
/** Valve's built-in group names are localization tokens; author-written names stay verbatim. */
export function deadlockBuildGroupKey(name: string): string | null {
  const known: Record<string, string> = {
    Early: "early", EarlyGame: "early", Mid: "mid", MidGame: "mid", Late: "late", LateGame: "late",
    Lane: "lane", OptionalParens: "optional", OptionalShort: "optional",
  };
  return name.startsWith("#Citadel_HeroBuilds_") ? known[name.slice("#Citadel_HeroBuilds_".length)] ?? "group" : null;
}
const row = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const uint = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff ? value : null;
const id = (value: unknown) => { const n = uint(value); return n && n > 0 ? n : null; };
const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max) : "";
const list = (value: unknown, max: number) => { if (!Array.isArray(value) || value.length > max) throw Error("Invalid Deadlock build data"); return value; };

export function deadlockBuildImage(value: unknown): string {
  try { const url = new URL(typeof value === "string" ? value : ""); return url.protocol === "https:" && url.hostname === "assets-bucket.deadlock-api.com" && !url.port && !url.username && !url.password && /^\/assets-api-res\/images\/(items|upgrades|abilities)\/[a-zA-Z0-9_./-]+\.(webp|png)$/.test(url.pathname) ? url.href : ""; }
  catch { return ""; }
}

export function parseDeadlockBuilds(raw: unknown, hero: number) {
  if (!id(hero)) throw Error("Invalid hero");
  const values = list(raw, 100), builds = new Map<number, DeadlockBuild>();
  for (const value of values) {
    const wrapper = row(value), build = row(wrapper.hero_build), buildId = id(build.hero_build_id), version = uint(build.version), name = text(build.name, 240);
    if (!buildId || build.hero_id !== hero || version === null || !name) throw Error("Build identity mismatch");
    if (build.development_build === true) continue;
    const details = row(build.details);
    const groups = list(details.mod_categories ?? [], 50).map(value => {
      const group = row(value);
      return { name: text(group.name, 180), note: text(group.description, 6000), optional: group.optional === true,
        items: list(group.mods ?? [], 100).map(value => { const item = row(value), itemId = id(item.ability_id); if (!itemId) throw Error("Invalid build item"); return { id: itemId, note: text(item.annotation, 6000), imbue: id(item.imbue_target_ability_id), flex: uint(item.required_flex_slots) }; }) };
    });
    if (groups.reduce((total, group) => total + group.items.length, 0) > 500) throw Error("Build guide too large");
    const updated = uint(build.last_updated_timestamp);
    const parsed = { id: buildId, hero, version, name, note: text(build.description, 16000), updated: updated && updated >= 1_600_000_000 ? updated * 1000 : null, weekly: uint(wrapper.num_weekly_favorites), groups };
    const previous = builds.get(buildId); if (!previous || parsed.version > previous.version) builds.set(buildId, parsed);
  }
  return { builds: [...builds.values()].slice(0, DEADLOCK_BUILD_PAGE), more: values.length > DEADLOCK_BUILD_PAGE };
}

export function parseDeadlockBuildItems(raw: unknown): DeadlockBuildItem[] {
  const seen = new Set<number>();
  const items = list(raw, 1500).flatMap(value => {
    const item = row(value), itemId = id(item.id), name = text(item.name, 180);
    if (!itemId || !name || item.type !== "upgrade") return [];
    if (seen.has(itemId)) throw Error("Duplicate item identity"); seen.add(itemId);
    return [{ id: itemId, name, image: deadlockBuildImage(item.shop_image_webp) || deadlockBuildImage(item.image_webp) || deadlockBuildImage(item.shop_image) || deadlockBuildImage(item.image), cost: uint(item.cost), shopable: item.shopable === true, slot: ["weapon", "vitality", "spirit"].includes(String(item.item_slot_type)) ? String(item.item_slot_type) : "" }];
  });
  if (!items.length) throw Error("Item definitions unavailable"); return items;
}

export function parseDeadlockBuildAbilities(raw: unknown, hero: number): DeadlockBuildAbility[] {
  return list(raw, 100).flatMap(value => {
    const ability = row(value), abilityId = id(ability.id), name = text(ability.name, 180);
    return abilityId && name && ability.type === "ability" && (ability.hero === hero || Array.isArray(ability.heroes) && ability.heroes.includes(hero)) ? [{ id: abilityId, name, image: deadlockBuildImage(ability.image_webp) || deadlockBuildImage(ability.image) }] : [];
  });
}

const languages: Record<string, string> = { en: "English", de: "German", fr: "French", es: "SpanishSpain", it: "Italian", ko: "Korean", zh: "ChineseSimplified", ru: "Russian", ja: "Japanese", pl: "Polish", tr: "Turkish", pt: "PortugueseBrazil", vi: "Vietnamese" };
export const deadlockBuildLanguage = (language: string) => languages[language] ? language : "en";
export function deadlockBuildsUrl(hero: number, sort: DeadlockBuildSort, query: string, language: string, start: number) {
  if (!id(hero) || !Number.isSafeInteger(start) || start < 0 || start > 10_000 || !["updated_at", "weekly_favorites"].includes(sort)) throw Error("Invalid build query");
  const params = new URLSearchParams({ hero_id: String(hero), only_latest: "true", sort_by: sort, sort_direction: "desc", start: String(start), limit: String(DEADLOCK_BUILD_PAGE + 1) });
  if (query.trim()) params.set("search_name", query.trim().slice(0, 100));
  if (language !== "all") params.set("build_language", languages[deadlockBuildLanguage(language)]!);
  return `https://api.deadlock-api.com/v1/builds?${params}`;
}
export const deadlockBuildItemsUrl = (language: string) => `https://api.deadlock-api.com/v1/assets/items/by-type/upgrade?language=${deadlockLanguage(language)}`;
