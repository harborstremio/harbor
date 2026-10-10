export const DEADLOCK_STEAM_ID = 1422450;
export const DEADLOCK_STATS_TTL = 10 * 60_000;
export type DeadlockHero = { id: number; name: string; image: string; role: string; playstyle: string };
export type DeadlockHeroStats = { id: number; wins: number; matches: number; winRate: number };
export type DeadlockRosterHero = DeadlockHero & { stats?: DeadlockHeroStats };

const object = (raw: unknown): Record<string, unknown> => raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
const text = (raw: unknown, max: number) => typeof raw === "string" ? raw.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
const integer = (raw: unknown) => typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? raw : undefined;

export function deadlockImage(raw: unknown): string {
  try {
    const url = new URL(typeof raw === "string" ? raw : "");
    if (url.protocol !== "https:" || url.hostname !== "assets-bucket.deadlock-api.com" || url.port || url.username || url.password || !url.pathname.startsWith("/assets-api-res/images/heroes/") || !/\.(png|webp)$/.test(url.pathname)) return "";
    return url.href;
  } catch { return ""; }
}

export function parseDeadlockHeroes(raw: unknown): DeadlockHero[] {
  if (!Array.isArray(raw)) throw Error("Hero roster unavailable");
  const seen = new Set<number>();
  const heroes = raw.slice(0, 200).flatMap(value => {
    const hero = object(value), id = integer(hero.id), name = text(hero.name, 100), description = object(hero.description), images = object(hero.images);
    if (!id || !name || seen.has(id) || hero.player_selectable !== true || hero.disabled === true || hero.in_development === true) return [];
    seen.add(id);
    return [{ id, name, image: deadlockImage(images.icon_hero_card_webp) || deadlockImage(images.icon_hero_card), role: text(description.role, 180), playstyle: text(description.playstyle, 1200) }];
  });
  if (!heroes.length) throw Error("Hero roster unavailable");
  return heroes;
}

/** No bucket is requested: repeated IDs, inconsistent totals and small samples cannot become rankings. */
export function parseDeadlockStats(raw: unknown): DeadlockHeroStats[] {
  if (!Array.isArray(raw)) throw Error("Hero statistics unavailable");
  const ids = raw.slice(0, 200).map(value => integer(object(value).hero_id));
  return raw.slice(0, 200).flatMap(value => {
    const row = object(value), id = integer(row.hero_id), wins = integer(row.wins), losses = integer(row.losses), matches = integer(row.matches);
    if (!id || ids.filter(value => value === id).length !== 1 || wins === undefined || losses === undefined || matches === undefined || matches < 100 || wins + losses !== matches || (row.bucket !== undefined && row.bucket !== 0)) return [];
    return [{ id, wins, matches, winRate: wins / matches }];
  });
}

export function deadlockStatsUrl(now: number): { url: string; from: number; to: number } {
  // Fixed ten-minute windows let a quick return reuse the same observation.
  const to = Math.floor(now / DEADLOCK_STATS_TTL) * DEADLOCK_STATS_TTL / 1000, from = to - 7 * 86400;
  const query = new URLSearchParams({ bucket: "no_bucket", game_mode: "normal", match_mode: "ranked,unranked", min_unix_timestamp: String(from), max_unix_timestamp: String(to) });
  return { url: `https://api.deadlock-api.com/v1/analytics/hero-stats?${query}`, from, to };
}

const languages: Record<string, string> = { de: "german", es: "spanish", fr: "french", id: "indonesian", it: "italian", ja: "japanese", ko: "koreana", pl: "polish", pt: "brazilian", ru: "russian", tr: "turkish", vi: "vietnamese", zh: "schinese" };
export const deadlockLanguage = (language: string) => languages[language] ?? "english";

export function deadlockRoster(heroes: DeadlockHero[], stats: DeadlockHeroStats[], query: string, sort: "matches" | "winRate" | "name"): DeadlockRosterHero[] {
  const indexed = new Map(stats.map(row => [row.id, row]));
  const needle = query.trim().toLocaleLowerCase();
  return heroes.filter(hero => hero.name.toLocaleLowerCase().includes(needle)).map(hero => ({ ...hero, stats: indexed.get(hero.id) }))
    .sort((a, b) => (sort === "name" ? 0 : (b.stats?.[sort] ?? -1) - (a.stats?.[sort] ?? -1)) || a.name.localeCompare(b.name));
}
