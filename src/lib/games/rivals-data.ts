export const RIVALS_STEAM_ID = 2767030;
export const RIVALS_SOURCE = "https://batru.gg";
export const RIVALS_OFFICIAL = "https://www.marvelrivals.com/heroes/index.html";
export const RIVALS_LOGO = "https://www.marvelrivals.com/pc/gw/20241128194803/img/logo_95906827.png";
export const RIVALS_TTL = 30 * 60_000;
export const RIVALS_STALE = 48 * 3600_000;
export type RivalsRole = "vanguard" | "duelist" | "strategist" | "unknown";
export type RivalsOfficialHero = { id: string; name: string; roles: RivalsRole[]; portrait: string; thumbnail: string; url: string; guideUrl?: string };
export type RivalsHeroStat = { id: number; name: string; slug: string; matches: number; wins: number; winRate: number; pickRate: number };
export type RivalsSnapshot<T> = { generatedAt: number; season: number; minimum: number; rows: T[]; partial: boolean };
export type RivalsStats = RivalsSnapshot<RivalsHeroStat> & { total: number };
export type RivalsPair = { id: number; matches: number; winRate: number };
export type RivalsPairRow = { id: number; pairs: RivalsPair[] };
export type RivalsPairs = RivalsSnapshot<RivalsPairRow>;
export type RivalsHero = { key: string; name: string; role: RivalsRole; portrait: string; thumbnail: string; url: string; guide?: { name: string; url: string }; stat?: RivalsHeroStat };
const ROLES: RivalsRole[] = ["vanguard", "duelist", "strategist"];
const object = (raw: unknown): Record<string, unknown> => raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
const integer = (raw: unknown, max = 1_000_000_000): number | null => Number.isSafeInteger(raw) && Number(raw) >= 0 && Number(raw) <= max ? Number(raw) : null;
const rate = (raw: unknown): number | null => typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : null;
const text = (raw: unknown, max = 100): string => typeof raw === "string" ? raw.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
function metadata(raw: unknown, now: number) {
  const data = object(raw), generatedAt = typeof data.generated_at === "string" ? Date.parse(data.generated_at) : NaN;
  const season = integer(data.season, 10_000), minimum = integer(data.min_matches, 1_000_000);
  if (!Number.isFinite(generatedAt) || generatedAt < Date.UTC(2024, 0) || generatedAt > now + 5 * 60_000 || season === null || minimum === null || minimum < 1 || !Array.isArray(data.heroes) || data.heroes.length > 300) throw Error("Invalid Rivals snapshot");
  return { data, generatedAt, season, minimum, heroes: data.heroes as unknown[] };
}
export function parseRivalsStats(raw: unknown, now = Date.now()): RivalsStats {
  const { data, generatedAt, season, minimum, heroes } = metadata(raw, now), total = integer(data.total_matches);
  if (total === null) throw Error("Invalid Rivals sample");
  const rows: RivalsHeroStat[] = [], seen = new Set<number>(); let partial = false;
  for (const value of heroes) {
    const row = object(value), id = integer(row.hero_id, 1_000_000), matches = integer(row.matches), wins = integer(row.wins), winRate = rate(row.winrate), pickRate = rate(row.pick_rate), name = text(row.name), slug = text(row.short_name);
    if (!id || matches === null || wins === null || wins > matches || matches > total || winRate === null || pickRate === null || !name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || (matches > 0 && Math.abs(winRate - wins / matches) > .00015)) { partial = true; continue; }
    if (seen.has(id)) throw Error("Duplicate Rivals hero"); seen.add(id);
    if (matches >= Math.max(200, minimum)) rows.push({ id, matches, wins, winRate, pickRate, name, slug });
  }
  if (heroes.length && !seen.size) throw Error("Unreadable Rivals heroes");
  return { generatedAt, season, minimum, total, rows, partial };
}
export function parseRivalsPairs(raw: unknown, now = Date.now()): RivalsPairs {
  const { generatedAt, season, minimum, heroes } = metadata(raw, now), rows: RivalsPairRow[] = [], seen = new Set<number>(); let partial = false;
  for (const value of heroes) {
    const row = object(value), id = integer(row.hero_id, 1_000_000);
    if (!id || !Array.isArray(row.vs) || (row.vs_more !== undefined && !Array.isArray(row.vs_more))) { partial = true; continue; }
    if (seen.has(id)) throw Error("Duplicate matchup hero"); seen.add(id);
    const values = [...row.vs, ...(Array.isArray(row.vs_more) ? row.vs_more : [])]; if (values.length > 600) throw Error("Oversized matchup roster");
    const pairs: RivalsPair[] = [], opponents = new Set<number>();
    for (const value of values) {
      const pair = object(value), other = integer(pair.opponent_id, 1_000_000), matches = integer(pair.matches), winRate = rate(pair.winrate);
      if (!other || other === id || matches === null || winRate === null) { partial = true; continue; }
      if (opponents.has(other)) throw Error("Duplicate matchup opponent"); opponents.add(other);
      if (matches >= Math.max(100, minimum)) pairs.push({ id: other, matches, winRate });
    }
    rows.push({ id, pairs });
  }
  if (heroes.length && !rows.length) throw Error("Unreadable Rivals matchups");
  return { generatedAt, season, minimum, rows, partial };
}
function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2]?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() ?? "";
}
export function rivalsImage(raw: string): string {
  try { const url = new URL(raw); return url.protocol === "https:" && ["www.marvelrivals.com", "r.res.easebar.com", "nie.res.netease.com"].includes(url.hostname) && !url.username && !url.password && !url.port && /\.(?:png|webp|jpe?g)$/i.test(url.pathname) ? url.href : ""; } catch { return ""; }
}
export function rivalsGuideUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return url.origin === "https://www.marvelrivals.com" && !url.username && !url.password && !url.search && !url.hash && /^\/\d{8}\/41360_\d+\.html$/.test(url.pathname) ? url.href : "";
  } catch { return ""; }
}
/** Extract only the publisher's bounded roster records, never its scripts or markup. */
export function parseRivalsOfficial(raw: unknown): RivalsOfficialHero[] {
  if (typeof raw !== "string" || raw.length > 2_000_000) throw Error("Invalid official roster");
  const heroes: RivalsOfficialHero[] = [], ids = new Set<string>(), names = new Set<string>();
  for (const match of raw.matchAll(/<div\s+class=["']heroNewsList["']\s*>\s*(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
    if (heroes.length >= 200) throw Error("Oversized official roster");
    const id = attribute(match[1], "data-id"), name = text(attribute(match[1], "data-name") || attribute(match[1], "title")), role = attribute(match[1], "data-tag").toLowerCase().split(/\s+/), roles = ROLES.filter(value => role.includes(value));
    const images = [...match[2].matchAll(/<img\b[^>]*>/gi)].map(image => rivalsImage(attribute(image[0], "src")));
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) || !name || !roles.length || !images[2] || !images[0]) continue;
    if (ids.has(id) || names.has(normalize(name))) throw Error("Ambiguous official hero"); ids.add(id); names.add(normalize(name));
    heroes.push({ id, name, roles, portrait: images[2], thumbnail: images[0], url: `${RIVALS_OFFICIAL}?id=${id}`, guideUrl: rivalsGuideUrl(attribute(match[1], "data-url")) || undefined });
  }
  if (!heroes.length) throw Error("Official roster unavailable");
  return heroes;
}
export function rivalsRoster(official: RivalsOfficialHero[], stats: RivalsStats | null): RivalsHero[] {
  const heroes: RivalsHero[] = [], used = new Set<string>();
  for (const stat of stats?.rows ?? []) {
    const variant = stat.name.match(/ \((Vanguard|Duelist|Strategist)\)$/), base = stat.name.replace(/ \((Vanguard|Duelist|Strategist)\)$/, "");
    const ref = official.find(hero => normalize(hero.name) === normalize(base));
    const role: RivalsRole = ref ? variant && ref.roles.includes(variant[1].toLowerCase() as RivalsRole) ? variant[1].toLowerCase() as RivalsRole : ref.roles.length === 1 ? ref.roles[0] : "unknown" : "unknown";
    if (ref && role !== "unknown") used.add(`${ref.id}:${role}`);
    heroes.push({ key: ref && role !== "unknown" ? `${ref.id}:${role}` : `stats:${stat.id}`, name: stat.name, role, portrait: ref?.portrait ?? "", thumbnail: ref?.thumbnail ?? "", url: ref?.url ?? "", guide: ref?.guideUrl ? {name: ref.name, url: ref.guideUrl} : undefined, stat });
  }
  for (const ref of official) for (const role of ref.roles) if (!used.has(`${ref.id}:${role}`)) heroes.push({ key: `${ref.id}:${role}`, name: ref.roles.length > 1 ? `${ref.name} (${role})` : ref.name, role, portrait: ref.portrait, thumbnail: ref.thumbnail, url: ref.url, guide: ref.guideUrl ? {name:ref.name,url:ref.guideUrl} : undefined });
  return heroes;
}
export function filterRivalsHeroes(heroes: RivalsHero[], query: string, role: string, sort: string): RivalsHero[] {
  const needle = query.normalize("NFC").toLocaleLowerCase().trim();
  return heroes.filter(hero => (role === "all" || role === hero.role) && hero.name.normalize("NFC").toLocaleLowerCase().includes(needle)).sort((a,b) => (sort === "winRate" ? (b.stat?.winRate ?? -1)-(a.stat?.winRate ?? -1) : sort === "name" ? 0 : (b.stat?.matches ?? -1)-(a.stat?.matches ?? -1)) || a.name.localeCompare(b.name));
}
export function rivalsMatchups(hero: RivalsHero, roster: RivalsHero[], data: RivalsPairs | null, stats: RivalsStats | null, mode: "hardest" | "best" | "with") {
  if (!hero.stat || !stats || !data || data.season !== stats.season) return [];
  return (data.rows.find(row => row.id === hero.stat!.id)?.pairs ?? []).flatMap(pair => { const opponent = roster.find(item => item.stat?.id === pair.id); return opponent ? [{ ...pair, hero: opponent }] : []; })
    .sort((a,b) => (mode === "hardest" ? a.winRate-b.winRate : b.winRate-a.winRate) || b.matches-a.matches || a.id-b.id);
}
