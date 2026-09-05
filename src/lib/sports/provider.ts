import type { LeagueDef, LeagueGroupDef, SportsGame, SportsMatchDetail } from "./espn-types";
import { LEAGUES, LEAGUE_GROUPS, leagueByKey } from "./espn-leagues";
import { fetchSports, sortGames } from "./espn-scoreboard";
import { fetchMatchSummary } from "./espn-summary";
import { apiSportsProvider } from "./providers/api-sports";
import { sportsDbProvider } from "./providers/sportsdb";

export type SportsProvider = {
  id: string;
  label: string;
  listLeagues(): LeagueDef[];
  fetchScoreboard(leagueKey: string, dateYmd?: string): Promise<SportsGame[]>;
  fetchSummary(leagueKey: string, eventId: string): Promise<SportsMatchDetail | null>;
  needsKey?: boolean;
};

const ESPN_ID = "espn";
const SLICE_CONCURRENCY = 6;

const espnProvider: SportsProvider = {
  id: ESPN_ID,
  label: "ESPN",
  listLeagues: () => LEAGUES,
  fetchScoreboard: (leagueKey, dateYmd) => fetchSports([leagueKey], dateYmd),
  fetchSummary: (leagueKey, eventId) => {
    const def = leagueByKey(leagueKey);
    return def ? fetchMatchSummary(def.tag, eventId) : Promise.resolve(null);
  },
};

const SPORTS_PROVIDERS: SportsProvider[] = [espnProvider, apiSportsProvider, sportsDbProvider];

const EXTRA_GROUPS: LeagueGroupDef[] = [
  { key: "volleyball", label: "الكرة الطائرة", labelEn: "Volleyball", labelRu: "Волейбол", icon: "🏐" },
];

function unionLeagues(): LeagueDef[] {
  const seen = new Set<string>();
  const out: LeagueDef[] = [];
  for (const provider of SPORTS_PROVIDERS) {
    for (const league of provider.listLeagues()) {
      if (seen.has(league.key)) continue;
      seen.add(league.key);
      out.push(league);
    }
  }
  return out;
}

export const SPORTS_LEAGUES: LeagueDef[] = unionLeagues();
export const SPORTS_GROUPS: LeagueGroupDef[] = [
  ...LEAGUE_GROUPS,
  ...EXTRA_GROUPS.filter((g) => SPORTS_LEAGUES.some((l) => l.group === g.key)),
];

const BY_KEY = new Map(SPORTS_LEAGUES.map((l) => [l.key, l] as const));
const BY_TAG = new Map<string, LeagueDef>();
for (const league of SPORTS_LEAGUES) if (!BY_TAG.has(league.tag)) BY_TAG.set(league.tag, league);
const KEYS_OF = new Map(
  SPORTS_PROVIDERS.map((p) => [p.id, new Set(p.listLeagues().map((l) => l.key))] as const),
);

export function sportsLeagueByTag(tag: string): LeagueDef | undefined {
  return BY_TAG.get(tag);
}

function unlockedProviders(): SportsProvider[] {
  return SPORTS_PROVIDERS.filter((p) => !p.needsKey);
}

function providerFor(leagueKey: string, pool = unlockedProviders()): SportsProvider | null {
  return pool.find((p) => KEYS_OF.get(p.id)?.has(leagueKey)) ?? null;
}

export function lockedLeagues(leagueKeys: string[]): LeagueDef[] {
  const pool = unlockedProviders();
  const out: LeagueDef[] = [];
  for (const key of leagueKeys) {
    if (providerFor(key, pool)) continue;
    const def = BY_KEY.get(key);
    if (def && SPORTS_PROVIDERS.some((p) => KEYS_OF.get(p.id)?.has(key))) out.push(def);
  }
  return out;
}

async function pooled<T>(items: string[], run: (item: string) => Promise<T[]>, limit: number): Promise<T[]> {
  const out: T[][] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await run(items[i]).catch(() => [] as T[]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out.flat();
}

function stamp(games: SportsGame[], source: string): SportsGame[] {
  return games.map((g) => (g.source === source ? g : { ...g, source }));
}

function providerSlice(provider: SportsProvider, keys: string[], dateYmd?: string): Promise<SportsGame[]> {
  const load =
    provider.id === ESPN_ID
      ? fetchSports(keys, dateYmd).catch(() => [] as SportsGame[])
      : pooled(keys, (key) => provider.fetchScoreboard(key, dateYmd), SLICE_CONCURRENCY);
  return load.then((games) => stamp(games, provider.id));
}

const lastSlices = new Map<string, SportsGame[]>();

export async function fetchSportsBoard(
  leagueKeys: string[],
  dateYmd?: string,
  onPartial?: (games: SportsGame[]) => void,
): Promise<SportsGame[]> {
  const byProvider = new Map<SportsProvider, string[]>();
  const tags = new Set<string>();
  const pool = unlockedProviders();
  for (const key of leagueKeys) {
    const provider = providerFor(key, pool);
    if (!provider) continue;
    const list = byProvider.get(provider);
    if (list) list.push(key);
    else byProvider.set(provider, [key]);
    const def = BY_KEY.get(key);
    if (def) tags.add(def.tag);
  }
  const sliceKey = (provider: SportsProvider) => `${provider.id}@${dateYmd ?? ""}`;
  const fresh = new Map<string, SportsGame[]>();
  const merged = () => {
    const all: SportsGame[] = [];
    for (const provider of byProvider.keys()) {
      const games = fresh.get(provider.id) ?? lastSlices.get(sliceKey(provider)) ?? [];
      for (const g of games) if (tags.has(g.league)) all.push(g);
    }
    return sortGames(all);
  };
  const jobs = [...byProvider.entries()].map(async ([provider, keys]) => {
    const games = await providerSlice(provider, keys, dateYmd);
    fresh.set(provider.id, games);
    lastSlices.set(sliceKey(provider), games);
    if (onPartial && fresh.size < byProvider.size) onPartial(merged());
  });
  await Promise.all(jobs);
  return merged();
}

export function fetchGameSummary(game: SportsGame): Promise<SportsMatchDetail | null> {
  const source = game.source ?? ESPN_ID;
  const provider = SPORTS_PROVIDERS.find((p) => p.id === source);
  if (!provider || provider.needsKey) return Promise.resolve(null);
  const def = provider.listLeagues().find((l) => l.tag === game.league);
  return def ? provider.fetchSummary(def.key, game.id) : Promise.resolve(null);
}
