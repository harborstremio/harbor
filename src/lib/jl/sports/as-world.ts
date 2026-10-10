import {
  SPORT_BASE,
  cleanName,
  gamesSegment,
  hexColor,
  tables,
  toGames,
  tournamentPath,
  type AsGame,
  type AsGet,
  type Table,
} from "./as-core.ts";

/**
 * World sports from AllSports: pick a sport, then a country (or region), then a league, and see
 * its table and fixtures. Parsers are plain functions; loaders take the getter.
 */

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export type WorldSport = { key: string; label: string };

/** Head-to-head sports with a country → league catalog. */
export const WORLD_SPORTS: WorldSport[] = [
  { key: "football", label: "Soccer" },
  { key: "basketball", label: "Basketball" },
  { key: "american-football", label: "American football" },
  { key: "ice-hockey", label: "Hockey" },
  { key: "baseball", label: "Baseball" },
  { key: "tennis", label: "Tennis" },
  { key: "cricket", label: "Cricket" },
  { key: "rugby", label: "Rugby" },
  { key: "volleyball", label: "Volleyball" },
  { key: "handball", label: "Handball" },
  { key: "esport", label: "Esports" },
];

export const worldSport = (key: string): WorldSport | null =>
  WORLD_SPORTS.find((s) => s.key === key) ?? null;

export const categoriesPath = (slug: string) => `${SPORT_BASE[slug]}/tournament/categories`;
export const leaguesPath = (slug: string, categoryId: number) =>
  `${SPORT_BASE[slug]}/${slug === "handball" || slug === "volleyball" ? "unique-tournament" : "tournament"}/all/category/${categoryId}`;

// ---- Parsers -----------------------------------------------------------------------------------

export type Category = { id: number; name: string; alpha2: string | null };

// Regions and competitions that span countries come first, then countries A–Z.
const REGIONS =
  /^(world|international|europe|south america|north america|africa|asia|oceania|concacaf|atp|wta|itf)/i;

export function parseCategories(d: unknown): Category[] {
  const byId = new Map<number, Category>();
  for (const raw of list(rec(d).categories)) {
    const c = rec(raw);
    const id = Number(c.id);
    const name = cleanName(c.name);
    if (id > 0 && name && !byId.has(id))
      byId.set(id, { id, name, alpha2: typeof c.alpha2 === "string" ? c.alpha2 : null });
  }
  return [...byId.values()].sort(
    (a, b) =>
      Number(REGIONS.test(b.name)) - Number(REGIONS.test(a.name)) || a.name.localeCompare(b.name),
  );
}

export type League = { id: number; name: string; color: string | null };

/** Leagues in a category: { groups: [{ uniqueTournaments }] }, or a flat list in some sports. */
export function parseLeagues(d: unknown): League[] {
  const r = rec(d);
  const rows = [
    ...list(r.groups).flatMap((g) => list(rec(g).uniqueTournaments)),
    ...list(r.uniqueTournaments),
    ...list(r.tournaments),
  ];
  const seen = new Set<number>();
  const out: League[] = [];
  for (const row of rows) {
    const t = rec(row);
    const id = Number(t.id);
    if (!(id > 0) || seen.has(id) || !t.name) continue;
    seen.add(id);
    out.push({ id, name: cleanName(t.name), color: hexColor(t.primaryColorHex) });
  }
  return out;
}

export type Season = { id: number; name: string };
export function parseSeasons(d: unknown): Season[] {
  return list(rec(d).seasons)
    .map((s) => ({ id: Number(rec(s).id), name: cleanName(rec(s).name ?? rec(s).year) }))
    .filter((s) => s.id > 0);
}

// ---- Loaders -----------------------------------------------------------------------------------

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export async function loadCategories(get: AsGet, slug: string): Promise<Category[]> {
  return parseCategories(await get(categoriesPath(slug), DAY));
}

export async function loadLeagues(get: AsGet, slug: string, categoryId: number): Promise<League[]> {
  return parseLeagues(await get(leaguesPath(slug, categoryId), DAY));
}

export type LeagueView = {
  name: string;
  color: string | null;
  season: Season | null;
  /** The season the table is from (last season's when this one hasn't started). */
  tableSeason: Season | null;
  standings: Table[];
  next: AsGame[];
  last: AsGame[];
};

export async function loadLeague(get: AsGet, slug: string, id: number): Promise<LeagueView> {
  const path = tournamentPath(slug, id);
  const soft = <T>(p: Promise<T | null>) => p.catch(() => null);
  const [info, seasonsRaw] = await Promise.all([
    soft(get<{ uniqueTournament?: unknown }>(path, DAY)),
    get(`${path}/seasons`, DAY),
  ]);
  const seasons = parseSeasons(seasonsRaw);
  const season = seasons[0] ?? null;
  let tableSeason: Season | null = null;
  let standings: Table[] = [];
  for (const s of seasons.slice(0, 2)) {
    standings = tables(await soft(get(`${path}/season/${s.id}/standings/total`, HOUR)));
    if (standings.length) {
      tableSeason = s;
      break;
    }
  }
  const seg = gamesSegment(slug);
  const [next, last] = season
    ? await Promise.all([
        soft(get(`${path}/season/${season.id}/${seg}/next/0`, 15 * 60_000)),
        soft(get(`${path}/season/${season.id}/${seg}/last/0`, 10 * 60_000)),
      ])
    : [null, null];
  const u = rec(info?.uniqueTournament);
  return {
    name: cleanName(u.name),
    color: hexColor(u.primaryColorHex),
    season,
    tableSeason,
    standings,
    next: toGames(next, slug)
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 20),
    last: toGames(last, slug)
      .sort((a, b) => b.startMs - a.startMs)
      .slice(0, 20),
  };
}
