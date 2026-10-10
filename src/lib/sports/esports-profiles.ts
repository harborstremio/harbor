/** Public OpenDota records. Account statistics cover tracked games, not only professional play. */
export type EsportsTeam = {
  id: number;
  name: string;
  tag: string;
  logo: string;
  rating: number | null;
  wins: number | null;
  losses: number | null;
  lastMatchTime: number | null;
};
export type EsportsPlayer = {
  accountId: number;
  name: string;
  avatar: string;
  games: number | null;
  wins: number | null;
  current: boolean;
};
export type EsportsRecordMatch = {
  id: number;
  at: number | null;
  won: boolean | null;
  duration: number | null;
  opponent: string;
  opponentId: number | null;
  opponentLogo: string;
  tournament: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
};
export type EsportsTeamRecord = {
  team: EsportsTeam | null;
  players: EsportsPlayer[];
  matches: EsportsRecordMatch[];
  partial: boolean;
};
export type EsportsPlayerRecord = {
  accountId: number;
  name: string;
  avatar: string;
  country: string;
  wins: number | null;
  losses: number | null;
  totals: { field: string; count: number; sum: number }[];
  matches: EsportsRecordMatch[];
  partial: boolean;
};
type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
const list = (value: unknown) => (Array.isArray(value) ? value : []);
const txt = (value: unknown) => (typeof value === "string" ? value.slice(0, 200) : "");
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const id = (value: unknown) => {
  const n = num(value);
  return n && Number.isSafeInteger(n) ? n : null;
};
export function esportsImage(value: unknown): string {
  try {
    const url = new URL(txt(value));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}
export function parseEsportsTeam(value: unknown): EsportsTeam | null {
  const data = row(value),
    teamId = id(data.team_id);
  if (!teamId || !txt(data.name)) return null;
  const last = num(data.last_match_time);
  return {
    id: teamId,
    name: txt(data.name),
    tag: txt(data.tag),
    logo: esportsImage(data.logo_url),
    rating: num(data.rating),
    wins: num(data.wins),
    losses: num(data.losses),
    lastMatchTime: last ? last * 1000 : null,
  };
}
export function parseEsportsTeams(raw: unknown, now = Date.now()): EsportsTeam[] {
  const unique = new Map<number, EsportsTeam>();
  for (const value of list(raw).slice(0, 1000)) {
    const team = parseEsportsTeam(value);
    if (
      team &&
      team.lastMatchTime &&
      team.lastMatchTime >= now - 90 * 86400000 &&
      team.lastMatchTime <= now + 86400000
    )
      unique.set(team.id, team);
  }
  return [...unique.values()].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)).slice(0, 200);
}

/** Past fixtures still need their teams' marks, even after a team leaves the active rankings. */
export function parseEsportsTeamLogos(raw: unknown): Map<string, string> {
  const logos = new Map<string, string>();
  for (const value of list(raw).slice(0, 1000)) {
    const team = parseEsportsTeam(value);
    if (team?.logo) logos.set(String(team.id), team.logo);
  }
  return logos;
}
export function parseEsportsRoster(raw: unknown, pros: unknown): EsportsPlayer[] {
  const identities = new Map(
    list(pros)
      .slice(0, 10000)
      .map((value) => {
        const data = row(value);
        return [id(data.account_id), data];
      }),
  );
  const unique = new Map<number, EsportsPlayer>();
  for (const value of list(raw).slice(0, 100)) {
    const data = row(value),
      accountId = id(data.account_id);
    if (!accountId || accountId === 4294967295) continue;
    const person = identities.get(accountId) ?? {};
    unique.set(accountId, {
      accountId,
      name: txt(data.name) || txt(person.name) || txt(person.personaname) || String(accountId),
      avatar: esportsImage(person.avatarfull) || esportsImage(person.avatarmedium),
      games: num(data.games_played),
      wins: num(data.wins),
      current: data.is_current_team_member === true,
    });
  }
  return [...unique.values()].sort(
    (a, b) => Number(b.current) - Number(a.current) || (b.games ?? 0) - (a.games ?? 0),
  );
}
export function parseEsportsMatches(raw: unknown, scope: "team" | "player"): EsportsRecordMatch[] {
  const unique = new Map<number, EsportsRecordMatch>();
  for (const value of list(raw).slice(0, 100)) {
    const data = row(value),
      matchId = id(data.match_id);
    if (!matchId) continue;
    const slot = num(data.player_slot);
    const radiant =
      scope === "team"
        ? typeof data.radiant === "boolean"
          ? data.radiant
          : null
        : slot !== null && slot <= 255
          ? slot < 128
          : null;
    const won =
      radiant === null || typeof data.radiant_win !== "boolean"
        ? null
        : radiant === data.radiant_win;
    const started = num(data.start_time);
    unique.set(matchId, {
      id: matchId,
      at: started ? started * 1000 : null,
      won,
      duration: num(data.duration),
      opponent: txt(data.opposing_team_name),
      opponentId: id(data.opposing_team_id),
      opponentLogo: esportsImage(data.opposing_team_logo),
      tournament: txt(data.league_name),
      kills: num(data.kills),
      deaths: num(data.deaths),
      assists: num(data.assists),
    });
  }
  return [...unique.values()].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 24);
}
export function parseEsportsPlayer(
  accountId: number,
  profile: unknown,
  wl: unknown,
  totals: unknown,
  matches: unknown,
): EsportsPlayerRecord {
  const person = row(row(profile).profile),
    record = row(wl);
  return {
    accountId,
    name: txt(person.name) || txt(person.personaname) || String(accountId),
    avatar: esportsImage(person.avatarfull) || esportsImage(person.avatarmedium),
    country: /^[A-Z]{2}$/.test(txt(person.loccountrycode)) ? txt(person.loccountrycode) : "",
    wins: num(record.win),
    losses: num(record.lose),
    totals: list(totals)
      .slice(0, 100)
      .flatMap((value) => {
        const item = row(value),
          count = num(item.n),
          sum = num(item.sum);
        return txt(item.field) && count !== null && count > 0 && sum !== null
          ? [{ field: txt(item.field), count, sum }]
          : [];
      }),
    matches: parseEsportsMatches(matches, "player"),
    partial: false,
  };
}

type Loader = (url: string, signal: AbortSignal) => Promise<unknown>;
/** Shared bounded client: no per-card fetch, three network requests at once, cancel on last subscriber. */
export function createEsportsProfileClient(loader: Loader) {
  const cache = new Map<string, { at: number; data: unknown }>();
  const inflight = new Map<
    string,
    { controller: AbortController; users: number; promise: Promise<unknown> }
  >();
  let running = 0;
  const waiting: (() => void)[] = [];
  const execute = async (path: string, signal: AbortSignal) => {
    await new Promise<void>((resolve, reject) => {
      const start = () => {
        signal.removeEventListener("abort", cancel);
        running++;
        resolve();
      };
      const cancel = () => {
        const index = waiting.indexOf(start);
        if (index >= 0) waiting.splice(index, 1);
        reject(signal.reason);
      };
      if (signal.aborted) return reject(signal.reason);
      if (running < 3) start();
      else {
        waiting.push(start);
        signal.addEventListener("abort", cancel, { once: true });
      }
    });
    try {
      signal.throwIfAborted();
      return await loader(
        `https://api.opendota.com/api/${path}`,
        AbortSignal.any([signal, AbortSignal.timeout(9000)]),
      );
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
  const json = (path: string, signal: AbortSignal): Promise<unknown> => {
    signal.throwIfAborted();
    const cached = cache.get(path);
    if (cached && Date.now() - cached.at < 600000) return Promise.resolve(cached.data);
    let request = inflight.get(path);
    if (!request) {
      const controller = new AbortController();
      request = {
        controller,
        users: 0,
        promise: execute(path, controller.signal)
          .then((data) => {
            controller.signal.throwIfAborted();
            cache.delete(path);
            cache.set(path, { at: Date.now(), data });
            while (cache.size > 50) cache.delete(cache.keys().next().value!);
            return data;
          })
          .finally(() => {
            if (inflight.get(path)?.controller === controller) inflight.delete(path);
          }),
      };
      inflight.set(path, request);
    }
    const shared = request;
    shared.users++;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (run: () => void) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", cancel);
        shared.users--;
        if (!shared.users && inflight.get(path) === shared) {
          inflight.delete(path);
          shared.controller.abort();
        }
        run();
      };
      const cancel = () => finish(() => reject(signal.reason));
      signal.addEventListener("abort", cancel, { once: true });
      shared.promise.then(
        (data) => finish(() => resolve(data)),
        (error) => finish(() => reject(error)),
      );
    });
  };
  const valid = (value: number) => {
    if (!id(value) || value === 4294967295) throw new Error("Invalid profile identity");
  };
  const result = (entry: PromiseSettledResult<unknown>) =>
    entry.status === "fulfilled" ? entry.value : null;
  return {
    fetchTeams: async (signal: AbortSignal) => parseEsportsTeams(await json("teams", signal)),
    fetchTeamLogos: async (signal: AbortSignal) => parseEsportsTeamLogos(await json("teams", signal)),
    fetchTeam: async (teamId: number, signal: AbortSignal): Promise<EsportsTeamRecord> => {
      valid(teamId);
      const budget = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      const responses = await Promise.allSettled([
        json(`teams/${teamId}`, budget),
        json(`teams/${teamId}/players`, budget),
        json(`teams/${teamId}/matches`, budget),
        json("proPlayers", budget),
      ]);
      signal.throwIfAborted();
      if (responses.slice(0, 3).every((item) => item.status === "rejected"))
        throw new Error("Team records unavailable");
      return {
        team: parseEsportsTeam(result(responses[0])),
        players: parseEsportsRoster(result(responses[1]), result(responses[3])),
        matches: parseEsportsMatches(result(responses[2]), "team"),
        partial: responses.some((item) => item.status === "rejected"),
      };
    },
    fetchPlayer: async (accountId: number, signal: AbortSignal): Promise<EsportsPlayerRecord> => {
      valid(accountId);
      const budget = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      const responses = await Promise.allSettled([
        json(`players/${accountId}`, budget),
        json(`players/${accountId}/wl`, budget),
        json(`players/${accountId}/totals`, budget),
        json(`players/${accountId}/recentMatches`, budget),
      ]);
      signal.throwIfAborted();
      if (responses.every((item) => item.status === "rejected"))
        throw new Error("Player records unavailable");
      return {
        ...parseEsportsPlayer(
          accountId,
          ...(responses.map(result) as [unknown, unknown, unknown, unknown]),
        ),
        partial: responses.some((item) => item.status === "rejected"),
      };
    },
  };
}
const client = createEsportsProfileClient(async (url, signal) => {
  const { safeFetch } = await import("../safe-fetch");
  const response = await safeFetch(url, { signal });
  if (!response.ok) throw new Error("OpenDota is unavailable");
  return response.json();
});
export const fetchEsportsTeams = client.fetchTeams;
export const fetchEsportsTeamLogos = client.fetchTeamLogos;
export const fetchEsportsTeamProfile = client.fetchTeam;
export const fetchEsportsPlayerProfile = client.fetchPlayer;
