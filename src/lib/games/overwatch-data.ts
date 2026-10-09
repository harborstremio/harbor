import type { GameSummary } from "./types";

export const OVERWATCH_API = "https://overfast-api.tekrop.fr";
export const OVERWATCH_TTL = 24 * 3600_000;
export const OVERWATCH_ROLES = ["tank", "damage", "support"] as const;
export type OverwatchRole = typeof OVERWATCH_ROLES[number];
export const OVERWATCH_LOGO = "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt12c582d9d58631b9/69d573c3c714e07b0dc39b07/overwatch_logo.png?width=600&format=webp";
// Original Blizzard role marks, published by OverFast's /roles endpoint.
export const OVERWATCH_ROLE_ICONS: Record<OverwatchRole, string> = {
  tank: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/bltf0889daa1ef606db/6504cff74d2a764cb7973991/Tank.svg",
  damage: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt05d482c88096959a/6504cff7d9caa1285f64b6bd/Damage.svg",
  support: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt3ccd5df488163b33/6504cff7fc2ae4d7c50445c4/Support.svg",
};
export function isOverwatch(game: Pick<GameSummary, "id" | "steamId">): boolean {
  // Native discovery uses the Battle.net product name, not the Pro launch code.
  // An exact IGDB edition never inherits today's game via a linked Steam port.
  if (game.id.startsWith("battlenet:")) return game.id === "battlenet:prometheus";
  return game.id === "steam:2357570" && game.steamId === 2357570;
}
export function overwatchLocale(language: string): string {
  return ({ de: "de-de", es: "es-es", fr: "fr-fr", it: "it-it", ja: "ja-jp", ko: "ko-kr", pl: "pl-pl", pt: "pt-br", ru: "ru-ru", zh: "zh-tw" } as Record<string, string>)[language] ?? "en-us";
}
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
export const overwatchKey = (value: unknown): string => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length < 100 ? value : "";
const role = (value: unknown): OverwatchRole | null => OVERWATCH_ROLES.includes(value as OverwatchRole) ? value as OverwatchRole : null;
const keys = (value: unknown): string[] => Array.isArray(value) && value.length <= 30 ? [...new Set(value.map(overwatchKey).filter(Boolean))] : [];
export function overwatchMedia(value: unknown, video = false): string {
  if (typeof value !== "string" || value.length > 2083) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    if (video) return url.hostname === "blz-contentstack-assets.akamaized.net" && /^\/v3\/assets\/[^?#]+\.(mp4|webm)$/i.test(url.pathname) ? url.href : "";
    const publisher = url.hostname === "blz-contentstack-images.akamaized.net" && url.pathname.startsWith("/v3/assets/");
    const portrait = url.hostname === "d15f34w2p8l1cc.cloudfront.net" && /^\/overwatch\/[a-f0-9]+\.png$/.test(url.pathname);
    const map = url.hostname === "overfast-api.tekrop.fr" && /^\/static\/(maps|gamemodes)\/[a-z0-9-]+\.(jpg|png|avif|svg)$/.test(url.pathname);
    return (publisher || portrait || map) && /\.(png|jpe?g|webp|avif|svg)$/i.test(url.pathname) ? url.href : "";
  } catch { return ""; }
}
export type OverwatchHero = { key: string; name: string; portrait: string; role: OverwatchRole; modes: string[] };
export type OverwatchList<T> = { items: T[]; partial: boolean };
function list<T>(raw: unknown, parse: (value: Row) => T | null, identity: (value: T) => string, max = 250): OverwatchList<T> {
  if (!Array.isArray(raw) || !raw.length || raw.length > max) throw Error("Invalid Overwatch catalog");
  const seen = new Set<string>(), items: T[] = [];
  for (const value of raw) {
    const item = parse(row(value));
    if (!item || seen.has(identity(item))) continue;
    seen.add(identity(item)); items.push(item);
  }
  if (!items.length) throw Error("Overwatch catalog unavailable");
  return { items, partial: items.length !== raw.length };
}
export function parseOverwatchHeroes(raw: unknown): OverwatchList<OverwatchHero> {
  return list(raw, value => {
    const key = overwatchKey(value.key), name = text(value.name), type = role(value.role), modes = keys(value.gamemodes);
    return key && name && type ? { key, name, portrait: overwatchMedia(value.portrait), role: type, modes } : null;
  }, value => value.key);
}
export type OverwatchAbility = { name: string; description: string; icon: string; video: string; poster: string };
export type OverwatchHeroDetail = OverwatchHero & { description: string; background: string; abilities: OverwatchAbility[]; minor: OverwatchAbility[]; major: OverwatchAbility[]; stadium: OverwatchAbility[]; story: string; partial: boolean };
function abilities(value: unknown, required = false) {
  if (!Array.isArray(value) || value.length > 30) {
    if (required) throw Error("Overwatch abilities unavailable");
    return { items: [], partial: value !== null && value !== undefined };
  }
  const items = value.flatMap(raw => {
    const item = row(raw), name = text(item.name), description = text(item.description, 2400), video = row(item.video);
    return name && description ? [{ name, description, icon: overwatchMedia(item.icon), video: overwatchMedia(row(video.link).mp4, true), poster: overwatchMedia(video.thumbnail) }] : [];
  });
  if (required && !items.length) throw Error("Overwatch abilities unavailable");
  return { items, partial: items.length !== value.length };
}
export function parseOverwatchHero(raw: unknown, expected: OverwatchHero): OverwatchHeroDetail {
  const value = row(raw), name = text(value.name), type = role(value.role);
  // Detail responses carry no key: require the same localized roster identity.
  if (name.normalize("NFKC") !== expected.name.normalize("NFKC") || type !== expected.role) throw Error("Mismatched Overwatch hero");
  const backgrounds = Array.isArray(value.backgrounds) && value.backgrounds.length <= 12 ? value.backgrounds.map(row) : [];
  const medium = backgrounds.find(item => Array.isArray(item.sizes) && item.sizes.includes("md"));
  const background = overwatchMedia(medium?.url) || backgrounds.map(item => overwatchMedia(item.url)).find(Boolean) || "";
  const base = abilities(value.abilities, true), minor = abilities(row(value.perks).minor), major = abilities(row(value.perks).major), stadium = abilities(value.stadium_powers);
  return { ...expected, description: text(value.description, 2000), background, abilities: base.items, minor: minor.items, major: major.items, stadium: stadium.items,
    story: text(row(value.story).summary, 4000), partial: [base, minor, major, stadium].some(group => group.partial) };
}
export type OverwatchMap = { key: string; name: string; image: string; modes: string[]; location: string };
export function parseOverwatchMaps(raw: unknown): OverwatchList<OverwatchMap> {
  return list(raw, value => {
    const key = overwatchKey(value.key), name = text(value.name), modes = keys(value.gamemodes);
    return key && name && modes.length ? { key, name, modes, image: overwatchMedia(value.screenshot), location: text(value.location) } : null;
  }, value => value.key);
}
export type OverwatchMode = { key: string; name: string; description: string; icon: string };
export function parseOverwatchModes(raw: unknown): OverwatchList<OverwatchMode> {
  return list(raw, value => {
    const key = overwatchKey(value.key), name = text(value.name), description = text(value.description, 1800);
    return key && name && description ? { key, name, description, icon: overwatchMedia(value.icon) } : null;
  }, value => value.key, 50);
}
export function filterOverwatchHeroes(items: OverwatchHero[], query: string, type: string, stadium: boolean): OverwatchHero[] {
  const needle = query.normalize("NFKC").trim().toLocaleLowerCase();
  return items.filter(item => (type === "all" || item.role === type) && (!stadium || item.modes.includes("stadium")) && (!needle || `${item.name} ${item.key}`.normalize("NFKC").toLocaleLowerCase().includes(needle)));
}
export function overwatchHeroUrl(key: string, language: string): string {
  return overwatchKey(key) ? `https://overwatch.blizzard.com/${overwatchLocale(language)}/heroes/${key}/` : "";
}
