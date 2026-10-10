export type EsportsRankedPlayer = {
  id: string;
  name: string;
  image?: string;
  url?: string;
};
export type EsportsRankedTeam = {
  id: string;
  name: string;
  logo: string;
  rank: number;
  /** Points and movement from this provider's dated snapshot, not an HLTV rating. */
  points?: number;
  rankChange?: number;
  url?: string;
  players: EsportsRankedPlayer[];
};
export type EsportsRankings = {
  teams: EsportsRankedTeam[];
  fetchedAt: number;
  asOf: string;
  updatedAt: number | null;
  sourceUrl: string;
  sourceName: string;
  isOfficial: boolean;
  stale: boolean;
};
export type EsportsRankedTeamStats = {
  teamId: string;
  matches?: number;
  matchWins?: number;
  matchLosses?: number;
  maps?: number;
  mapWins?: number;
  mapLosses?: number;
  rounds?: number;
  roundWins?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
};

// Observed in Bo3.gg's public team ranking widget. The default date is the latest snapshot.
export const CS_RANKINGS_URL =
  "https://api.bo3.gg/api/v2/team_rankings?with=team,players&filter%5Bdiscipline_id%5D%5Beq%5D=1&per_page=100&page=1";
const SOURCE_URL = "https://bo3.gg/teams/valve-rankings/world";
type Row = Record<string, unknown>;
const object = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 250) : "");
const identity = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? String(value)
    : /^\d{1,15}$/.test(text(value)) && Number(value) > 0
      ? String(value)
      : "";
const finiteNumber = (value: unknown): number | undefined => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return undefined;
  const result = typeof value === "number" ? value : Number(text(value));
  return Number.isFinite(result) ? result : undefined;
};
function image(value: unknown): string {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      ["files.bo3.gg", "image-proxy.bo3.gg"].includes(url.hostname)
      ? url.href
      : "";
  } catch {
    return "";
  }
}
function sourceLink(value: unknown, type: "teams" | "players"): string | undefined {
  const slug = text(value);
  return /^[a-z0-9][a-z0-9-]{0,180}$/.test(slug) ? `https://bo3.gg/${type}/${slug}` : undefined;
}

export function parseEsportsRankedTeamStats(raw: unknown, teamId: string): EsportsRankedTeamStats {
  const data = object(raw);
  if (identity(data.team_id) !== teamId) throw new Error("Team statistics do not match this team");
  const count = (key: string) => {
    const value = finiteNumber(data[key]);
    return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  };
  return {
    teamId,
    matches: count("matches_count"),
    matchWins: count("matches_won_count"),
    matchLosses: count("matches_lost_count"),
    maps: count("games_count"),
    mapWins: count("games_won_count"),
    mapLosses: count("games_lost_count"),
    rounds: count("rounds_count"),
    roundWins: count("rounds_won_count"),
    kills: count("kills_sum"),
    deaths: count("deaths_sum"),
    assists: count("assists_sum"),
  };
}

export function createEsportsRankedTeamStatsClient(
  request: (url: string, signal: AbortSignal) => Promise<unknown>,
) {
  const cache = new Map<string, { at: number; data: EsportsRankedTeamStats }>();
  return async (team: EsportsRankedTeam, signal: AbortSignal): Promise<EsportsRankedTeamStats> => {
    signal.throwIfAborted();
    const match = /^https:\/\/bo3\.gg\/teams\/([a-z0-9][a-z0-9-]{0,180})$/.exec(team.url || "");
    if (!match || !/^\d+$/.test(team.id)) throw new Error("Team statistics are unavailable");
    const hit = cache.get(team.id);
    if (hit && Date.now() - hit.at < 15 * 60000) return hit.data;
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(9000)]);
    const work = request(`https://api.bo3.gg/api/v1/teams/${match[1]}/general_stats`, deadline);
    const raw = await new Promise<unknown>((resolve, reject) => {
      const abort = () => reject(deadline.reason);
      deadline.addEventListener("abort", abort, { once: true });
      work.then(
        (value) => {
          deadline.removeEventListener("abort", abort);
          if (!deadline.aborted) resolve(value);
        },
        (error) => {
          deadline.removeEventListener("abort", abort);
          reject(error);
        },
      );
      if (deadline.aborted) abort();
    });
    deadline.throwIfAborted();
    const data = parseEsportsRankedTeamStats(raw, team.id);
    if (cache.size >= 30) cache.delete(cache.keys().next().value!);
    cache.set(team.id, { at: Date.now(), data });
    return data;
  };
}

export const fetchEsportsRankedTeamStats = createEsportsRankedTeamStatsClient(
  async (url, signal) => {
    const { safeFetch } = await import("../safe-fetch");
    const response = await safeFetch(url, { signal });
    if (!response.ok) throw new Error("Team statistics are unavailable");
    return response.json();
  },
);
/** Preserve the provider's rank, never replace it with a row index or imply an internal projection is official. */
export function parseEsportsRankings(raw: unknown, now = Date.now()): EsportsRankings {
  const data = object(raw),
    meta = object(data.meta);
  if (
    Number(meta.discipline_id) !== 1 ||
    meta.region !== "worldwide" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(text(meta.ranking_date))
  )
    throw new Error("CS2 global rankings are unavailable");
  const asOf = text(meta.ranking_date);
  const timestamp = Date.parse(`${asOf}T00:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== asOf ||
    timestamp > now + 86400000
  )
    throw new Error("CS2 ranking date is invalid");
  const found = new Map<string, EsportsRankedTeam>();
  for (const value of list(data.data).slice(0, 100)) {
    const entry = object(value),
      team = object(entry.team),
      id = identity(team.id),
      name = text(team.name);
    const rank = typeof entry.rank === "number" ? entry.rank : Number(text(entry.rank));
    if (
      !id ||
      !name ||
      !Number.isSafeInteger(rank) ||
      rank < 1 ||
      rank > 100 ||
      text(entry.ranking_date) !== asOf ||
      (identity(entry.team_id) && identity(entry.team_id) !== id)
    )
      continue;
    if (found.has(id) && found.get(id)!.rank <= rank) continue;
    const players = new Map<string, EsportsRankedPlayer>();
    for (const value of list(entry.roster_players).slice(0, 10)) {
      const person = object(value),
        playerId = identity(person.id),
        playerName = text(person.nickname);
      if (playerId && playerName)
        players.set(playerId, {
          id: playerId,
          name: playerName,
          image: image(person.image_url) || undefined,
          url: sourceLink(person.slug, "players"),
        });
    }
    found.set(id, {
      id,
      name,
      rank,
      points: (() => {
        const points = finiteNumber(entry.score);
        return points !== undefined && points >= 0 ? points : undefined;
      })(),
      rankChange: (() => {
        const change = finiteNumber(entry.rank_diff);
        return change !== undefined && Number.isSafeInteger(change) ? change : undefined;
      })(),
      logo: image(team.image_url),
      url: sourceLink(team.slug, "teams"),
      players: [...players.values()],
    });
  }
  const teams = [...found.values()].sort((a, b) => a.rank - b.rank).slice(0, 100);
  if (!teams.length) throw new Error("CS2 team rankings are unavailable");
  const updated = Date.parse(text(meta.updated_at));
  return {
    teams,
    fetchedAt: now,
    asOf,
    updatedAt: Number.isFinite(updated) ? updated : null,
    sourceUrl: SOURCE_URL,
    sourceName: "Bo3.gg",
    isOfficial: meta.is_official === true,
    stale: now - timestamp > 14 * 86400000,
  };
}

type RequestText = (url: string, ttl: number) => Promise<string>;
export function createEsportsRankingsClient(request: RequestText) {
  let cached: EsportsRankings | null = null;
  let pending: Promise<EsportsRankings> | null = null;
  return function fetchRankings(signal: AbortSignal, force = false): Promise<EsportsRankings> {
    signal.throwIfAborted();
    if (!force && cached && Date.now() - cached.fetchedAt < 15 * 60000)
      return Promise.resolve(cached);
    if (!pending)
      pending = request(CS_RANKINGS_URL, force ? 0 : 15 * 60000)
        .then((raw) => {
          const result = parseEsportsRankings(JSON.parse(raw));
          cached = result;
          return result;
        })
        .catch((error) => {
          if (cached && Date.now() - cached.fetchedAt < 86400000) return { ...cached, stale: true };
          throw error;
        })
        .finally(() => {
          pending = null;
        });
    const work = pending;
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      work.then(
        (value) => {
          signal.removeEventListener("abort", abort);
          if (!signal.aborted) resolve(value);
        },
        (error) => {
          signal.removeEventListener("abort", abort);
          reject(error);
        },
      );
    });
  };
}
export const fetchEsportsRankings = createEsportsRankingsClient(async (url, ttl) => {
  const { requestEsportsText } = await import("./esports-feeds.ts");
  return requestEsportsText(url, ttl);
});
