import { esportsEmbedUrl } from "./esports-streams";
export type EsportsGameId = "dota2" | "cs2" | "valorant" | "lol" | "rocketleague";
export type EsportsMatchState = "live" | "upcoming" | "recent";

export interface EsportsTeam {
  id: string;
  name: string;
  code?: string;
  logo?: string;
  score?: number;
  winner?: boolean;
}

export interface EsportsStream {
  title: string;
  url: string;
  platform: "twitch" | "youtube" | "kick" | "external";
}

export interface EsportsMatch {
  id: string;
  game: EsportsGameId;
  state: EsportsMatchState;
  startMs: number;
  /** Last timestamp the provider explicitly reported for live data. */
  updatedMs?: number;
  event: { id: string; name: string; logo?: string; stage?: string };
  teams: [EsportsTeam, EsportsTeam];
  bestOf?: number;
  streams: EsportsStream[];
  sourceUrl: string;
}

export interface EsportsFeed {
  game: EsportsGameId;
  matches: EsportsMatch[];
  status: "ready" | "unavailable" | "stale";
  fetchedAt: number;
  source: { name: string; url: string };
  reason?: string;
  partial?: boolean;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const SOURCES: Record<EsportsGameId, EsportsFeed["source"]> = {
  lol: {
    name: "LoL Esports · official",
    url: "https://lolesports.com/en-US/schedule",
  },
  valorant: {
    name: "VALORANT Esports · official",
    url: "https://valorantesports.com/en-US/schedule",
  },
  dota2: { name: "OpenDota", url: "https://www.opendota.com/matches" },
  cs2: {
    name: "Bo3.gg · community coverage",
    url: "https://bo3.gg/matches/current",
  },
  rocketleague: {
    name: "BLAST.tv · official RLCS coverage",
    url: "https://blast.tv/rl",
  },
};
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const string = (value: unknown): string =>
  typeof value === "string"
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
const number = (value: unknown): number | undefined =>
  value !== null && value !== "" && value !== undefined && Number.isFinite(Number(value))
    ? Number(value)
    : undefined;

function imageUrl(value: unknown): string | undefined {
  try {
    const url = new URL(string(value));
    if (url.protocol === "http:" && url.hostname === "static.lolesports.com")
      url.protocol = "https:";
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Time never promotes a schedule entry to LIVE. Only an explicit provider state can do that. */
export function currentEsportsMatches(matches: EsportsMatch[], now = Date.now()): EsportsMatch[] {
  const unique = new Map<string, EsportsMatch>();
  const stateRank = { upcoming: 0, live: 1, recent: 2 };
  for (const match of matches) {
    if (!match.id || !Number.isFinite(match.startMs) || match.teams.some((team) => !team.name))
      continue;
    if (match.state === "upcoming" && (match.startMs < now || match.startMs > now + 30 * DAY))
      continue;
    if (match.state === "recent" && (match.startMs < now - 2 * DAY || match.startMs > now))
      continue;
    if (
      match.state === "live" &&
      (match.startMs < now - 12 * 60 * MINUTE || match.startMs > now + 5 * MINUTE)
    )
      continue;
    if (
      match.state === "live" &&
      match.updatedMs !== undefined &&
      (now - match.updatedMs > 5 * MINUTE || match.updatedMs > now + MINUTE)
    )
      continue;
    const key = `${match.game}:${match.id}`;
    const existing = unique.get(key);
    if (!existing || stateRank[match.state] >= stateRank[existing.state]) unique.set(key, match);
  }
  const order = { live: 0, upcoming: 1, recent: 2 };
  return [...unique.values()]
    .sort(
      (a, b) =>
        order[a.state] - order[b.state] ||
        (a.state === "recent" ? b.startMs - a.startMs : a.startMs - b.startMs),
    )
    .slice(0, 240);
}

/** Read only JSON object literals in the official page's SSR data, never execute remote scripts. */
export function extractRiotEvents(html: string): RecordValue[] {
  if (html.length > 8_000_000) throw new Error("Schedule response is too large");
  const marker = '{"__typename":"EventMatch"';
  const events: RecordValue[] = [];
  let offset = 0;
  while (events.length < 500) {
    const start = html.indexOf(marker, offset);
    if (start < 0) break;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let end = start;
    for (; end < Math.min(html.length, start + 250_000); end++) {
      const c = html[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) break;
    }
    offset = end + 1;
    try {
      events.push(object(JSON.parse(html.slice(start, offset))));
    } catch {
      /* Ignore malformed inert data; never evaluate it. */
    }
  }
  // A changed page must report unavailable rather than silently claiming an empty live board.
  if (!events.length) throw new Error("Official schedule format is unavailable");
  return events;
}

function riotStreams(raw: unknown): EsportsStream[] {
  return list(raw).flatMap<EsportsStream>((value) => {
    const row = object(value);
    const provider = string(row.provider).toLowerCase();
    const parameter = string(row.parameter);
    const title = string(row.name) || string(row.locale) || provider;
    if (provider === "twitch" && /^[a-z0-9_]{1,50}$/i.test(parameter))
      return [
        {
          title,
          url: `https://www.twitch.tv/${parameter}`,
          platform: "twitch" as const,
        },
      ];
    if (provider === "youtube" && /^[a-zA-Z0-9_-]{11}$/.test(parameter))
      return [
        {
          title,
          url: `https://www.youtube.com/watch?v=${parameter}`,
          platform: "youtube" as const,
        },
      ];
    return [];
  });
}

export function parseRiotEsports(
  html: string,
  game: "lol" | "valorant",
  now = Date.now(),
): EsportsMatch[] {
  return currentEsportsMatches(
    extractRiotEvents(html).flatMap((row) => {
      const id = string(row.id);
      const startMs = Date.parse(string(row.startTime));
      const state = (
        {
          unstarted: "upcoming",
          inProgress: "live",
          completed: "recent",
        } as const
      )[string(row.state) as "unstarted" | "inProgress" | "completed"];
      const teams = list(row.matchTeams)
        .slice(0, 2)
        .map((value) => {
          const team = object(value);
          const result = object(team.result);
          return {
            id: string(team.id).split(":").at(-1) || "",
            name: string(team.name),
            code: string(team.code),
            logo: imageUrl(team.image),
            score: state === "upcoming" ? undefined : number(result.gameWins),
            winner: result.outcome === "win",
          };
        });
      if (!/^\d+$/.test(id) || !state || teams.length !== 2) return [];
      const league = object(row.league);
      const tournament = object(row.tournament);
      const strategy = object(object(row.match).strategy);
      const origin = game === "lol" ? "https://lolesports.com" : "https://valorantesports.com";
      const sourceUrl = /^\d+$/.test(string(tournament.id))
        ? `${origin}/en-US/tournament/${string(tournament.id)}`
        : `${origin}/en-US/schedule`;
      return [
        {
          id,
          game,
          state,
          startMs,
          event: {
            id: string(tournament.id) || string(league.id),
            name: [string(league.name), string(tournament.name)].filter(Boolean).join(" · "),
            logo: imageUrl(league.image),
            stage: string(row.blockName),
          },
          teams: teams as [EsportsTeam, EsportsTeam],
          bestOf: strategy.type === "bestOf" ? number(strategy.count) : undefined,
          streams: riotStreams(row.streams),
          sourceUrl,
        },
      ];
    }),
    now,
  );
}

export function parseOpenDotaEsports(
  raw: unknown,
  live: boolean,
  now = Date.now(),
): EsportsMatch[] {
  if (!Array.isArray(raw)) throw new Error("Invalid OpenDota feed");
  return currentEsportsMatches(
    raw.flatMap((value) => {
      const row = object(value);
      const id = string(row.match_id);
      const leagueId = string(live ? row.league_id : row.leagueid);
      if (!/^\d+$/.test(id) || !Number(leagueId)) return [];
      const teams = [true, false].map((radiant) => {
        const side = radiant ? "radiant" : "dire";
        return {
          id: string(row[live ? `team_id_${side}` : `${side}_team_id`]),
          name: string(row[live ? `team_name_${side}` : `${side}_name`]),
          score: number(row[`${side}_score`]),
          winner:
            !live && typeof row.radiant_win === "boolean" ? row.radiant_win === radiant : undefined,
        };
      });
      const updatedMs = live ? (number(row.last_update_time) ?? 0) * 1000 : undefined;
      if (live && !updatedMs) return [];
      return [
        {
          id,
          game: "dota2" as const,
          state: live ? ("live" as const) : ("recent" as const),
          startMs: (number(live ? row.activate_time : row.start_time) ?? 0) * 1000,
          updatedMs,
          event: {
            id: leagueId,
            name: string(row.league_name) || "Dota 2 · professional match",
          },
          teams: teams as [EsportsTeam, EsportsTeam],
          streams: [],
          sourceUrl: `https://www.opendota.com/matches/${id}`,
        },
      ];
    }),
    now,
  );
}

/** Public Bo3.gg website feed. Deliberately omit odds, affiliate links and model predictions. */
export function parseBo3Esports(raw: unknown, now = Date.now()): EsportsMatch[] {
  const payload = object(raw);
  if (!payload.data || !payload.included) throw new Error("CS2 coverage is unavailable");
  const included = object(payload.included);
  const teamsById = object(included.teams);
  const tournaments = object(included.tournaments);
  const tiers = object(object(payload.data).tiers);
  const rows = Array.isArray(payload.data)
    ? payload.data
    : Object.values(tiers).flatMap((tier) => list(object(tier).matches));
  return currentEsportsMatches(
    rows.flatMap((value) => {
      const row = object(value);
      const state = ({ current: "live", upcoming: "upcoming", finished: "recent" } as const)[
        string(row.status) as "current" | "upcoming" | "finished"
      ];
      const id = string(row.id);
      const slug = string(row.slug);
      if (
        !state ||
        number(row.discipline_id) !== 1 ||
        !/^\d+$/.test(id) ||
        !/^[a-z0-9-]+$/.test(slug)
      )
        return [];
      const teams = [1, 2].map((side) => {
        const teamId = string(row[`team${side}_id`]);
        const team = object(teamsById[teamId]);
        return {
          id: teamId,
          name: string(team.name),
          logo: imageUrl(object(team.image_versions)["50x50"] || team.image_url),
          score: state === "upcoming" ? undefined : number(row[`team${side}_score`]),
          winner: row.winner_team_id ? string(row.winner_team_id) === teamId : undefined,
        };
      });
      const tournament = object(tournaments[string(row.tournament)]);
      return [
        {
          id,
          game: "cs2" as const,
          state,
          startMs: Date.parse(string(row.start_date)),
          event: {
            id: string(tournament.id),
            name: string(tournament.name),
            logo: imageUrl(tournament.image_url),
          },
          teams: teams as [EsportsTeam, EsportsTeam],
          bestOf: number(row.bo_type),
          streams: [],
          sourceUrl: `https://bo3.gg/matches/${slug}`,
        },
      ];
    }),
    now,
  );
}

/** BLAST's public RL page embeds an indexed JSON transport, not an executable API client. */
export function parseBlastRocketLeague(html: string, now = Date.now()): EsportsMatch[] {
  if (html.length > 8_000_000) throw new Error("Schedule response is too large");
  const tournaments: RecordValue[] = [];
  const chunks = html.matchAll(/streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/g);
  for (const chunk of chunks) {
    let table: unknown[];
    try {
      table = JSON.parse(JSON.parse(chunk[1]));
    } catch {
      continue;
    }
    if (!Array.isArray(table) || table.length > 30_000) continue;
    const keyName = (key: string) =>
      /^_\d+$/.test(key) ? string(table[Number(key.slice(1))]) : "";
    let reads = 0;
    const resolve = (reference: unknown, depth = 0): unknown => {
      if (
        depth > 12 ||
        ++reads > 30_000 ||
        typeof reference !== "number" ||
        !Number.isInteger(reference) ||
        reference < 0 ||
        reference >= table.length
      )
        return undefined;
      const value = table[reference];
      if (Array.isArray(value)) return value.map((item) => resolve(item, depth + 1));
      if (value && typeof value === "object") {
        const decoded: RecordValue = Object.create(null);
        for (const [key, child] of Object.entries(value)) {
          const name = keyName(key);
          if (name && !["__proto__", "constructor", "prototype"].includes(name))
            decoded[name] = resolve(child, depth + 1);
        }
        return decoded;
      }
      return value;
    };
    table.forEach((entry, index) => {
      if (
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        Object.keys(entry).some((key) => keyName(key) === "matches")
      )
        tournaments.push(object(resolve(index)));
    });
  }
  if (!tournaments.length) throw new Error("Official RLCS schedule format is unavailable");
  const matches = tournaments.flatMap((tournament) => {
    const tournamentId = string(tournament.id);
    const name = string(tournament.name);
    if (!/^[a-z0-9-]+$/.test(tournamentId) || !name) return [];
    return list(tournament.matches).flatMap<EsportsMatch>((value) => {
      const row = object(value);
      const id = string(row.id);
      if (!/^[a-f0-9-]{36}$/.test(id)) return [];
      const teams = [object(row.teamA), object(row.teamB)].map((team, index) => ({
        id: string(team.id),
        name: string(team.name),
        code: string(team.shortName),
        logo: /^[a-f0-9-]{36}$/.test(string(team.id))
          ? `https://assets.blast.tv/images/teams/${string(team.id)}?width=128&format=auto`
          : undefined,
        score:
          row.hasFinished === true || row.startedAt
            ? number(row[index === 0 ? "teamAScore" : "teamBScore"])
            : undefined,
      }));
      if (teams.some((team) => !team.name)) return [];
      const state: EsportsMatchState =
        row.hasFinished === true ? "recent" : row.startedAt ? "live" : "upcoming";
      const sourceUrl = `https://blast.tv/rl/tournaments/${tournamentId}/series/${id.slice(0, 8)}/${teams.map((team) => team.code).join("-")}`;
      let streams: EsportsStream[] = [];
      const externalStream = imageUrl(object(row.metadata).externalStreamUrl);
      if (externalStream) {
        const host = new URL(externalStream).hostname.replace(/^www\./, "");
        if (["youtube.com", "youtu.be", "twitch.tv"].includes(host))
          streams = [
            {
              title: "Official broadcast",
              url: externalStream,
              platform: (host === "twitch.tv" ? "twitch" : "youtube") as EsportsStream["platform"],
            },
          ].filter((stream) => esportsEmbedUrl(stream as EsportsStream, "localhost"));
      }
      return [
        {
          id,
          game: "rocketleague",
          state,
          startMs: Date.parse(string(row.startedAt || row.scheduledAt)),
          event: {
            id: tournamentId,
            name,
            stage: [string(row.stageName), string(row.name)].filter(Boolean).join(" · "),
            logo: `https://assets.blast.tv/images/tournament/${tournamentId}?width=128&format=auto`,
          },
          teams: teams as [EsportsTeam, EsportsTeam],
          bestOf: /^BO[1-9]$/.test(string(row.type))
            ? Number(string(row.type).slice(2))
            : undefined,
          streams,
          sourceUrl,
        },
      ];
    });
  });
  return currentEsportsMatches(matches, now);
}

const feedCache = new Map<EsportsGameId, EsportsFeed>();
const inFlight = new Map<EsportsGameId, Promise<EsportsFeed>>();
const responseCache = new Map<string, { at: number; url: string; status: number; data: string }>();

/** Extra request headers, for a source that needs a key or a particular encoding. */
export interface EsportsRequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Headers change the answer, so they belong to the cache identity. Only a signature of the
 * values is kept: a key belongs in the request, never in a second long lived structure.
 */
function cacheKey(url: string, headers?: Record<string, string>): string {
  const names = Object.keys(headers ?? {}).sort();
  if (!names.length) return url;
  let hash = 0x811c9dc5;
  for (const name of names)
    for (const character of `${name.toLowerCase()}=${headers?.[name] ?? ""};`) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  return `${url} #${names.length}.${hash.toString(36)}`;
}

/** Reports the status instead of throwing on it, so a caller can tell 403 from an outage. */
async function requestEsportsResponse(
  url: string,
  ttl: number,
  options: EsportsRequestOptions = {},
): Promise<{ ok: boolean; status: number; data: string }> {
  const key = cacheKey(url, options.headers);
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.at < ttl)
    return { ok: true, status: cached.status, data: cached.data };
  const controller = new AbortController();
  const relay = () => controller.abort();
  options.signal?.addEventListener("abort", relay);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    options.signal?.throwIfAborted();
    const work = (async () => {
      const { safeFetch } = await import("../safe-fetch");
      const response = await safeFetch(url, {
        signal: controller.signal,
        ...(options.headers ? { headers: options.headers } : {}),
      });
      if (Number(response.headers.get("content-length")) > 8_000_000)
        throw new Error("Schedule response is too large");
      const data = response.ok ? await response.text() : "";
      if (data.length > 8_000_000) throw new Error("Schedule response is too large");
      return { ok: response.ok, status: response.status, data };
    })();
    const result = await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Esports source timed out"));
        }, 10_000);
      }),
    ]);
    if (!result.ok) return result;
    responseCache.set(key, { at: Date.now(), url, status: result.status, data: result.data });
    // Enforce a byte budget too: the official Riot SSR pages are much larger than JSON feeds.
    let retainedSize = [...responseCache.values()].reduce(
      (sum, value) => sum + value.data.length * 2,
      0,
    );
    for (const [entry, value] of responseCache) {
      if (responseCache.size <= 20 && retainedSize <= 16_000_000) break;
      retainedSize -= value.data.length * 2;
      responseCache.delete(entry);
    }
    return result;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", relay);
  }
}

export async function requestEsportsText(
  url: string,
  ttl: number,
  options: EsportsRequestOptions = {},
): Promise<string> {
  const response = await requestEsportsResponse(url, ttl, options);
  if (!response.ok) throw new Error("Esports source is unavailable");
  return response.data;
}

export async function requestEsportsJson(
  url: string,
  ttl: number,
  options: EsportsRequestOptions = {},
): Promise<unknown> {
  return JSON.parse(await requestEsportsText(url, ttl, options)) as unknown;
}

/** A reader that keeps the shared response cache while still surfacing the status. */
const cachedReader =
  (ttl: number) =>
  async (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => {
    const response = await requestEsportsResponse(url, ttl, init);
    return { ok: response.ok, status: response.status, text: async () => response.data };
  };

const request = requestEsportsText;

type FeedBatch = { matches: EsportsMatch[]; partial: boolean };

async function settledMatches(jobs: Promise<EsportsMatch[]>[]): Promise<FeedBatch> {
  const results = await Promise.allSettled(jobs);
  const succeeded = results.filter(
    (result): result is PromiseFulfilledResult<EsportsMatch[]> => result.status === "fulfilled",
  );
  if (!succeeded.length) throw new Error("Esports source is unavailable");
  return {
    matches: currentEsportsMatches(succeeded.flatMap((result) => result.value)),
    partial: succeeded.length !== results.length,
  };
}

/** One allowlist for every adapter: a link Harbor cannot open never reaches a card. */
export function allowedEsportsStreams(matches: EsportsMatch[]): EsportsMatch[] {
  return matches.map((match) => {
    const streams = match.streams
      .filter((stream) => esportsEmbedUrl(stream, "localhost"))
      .slice(0, 12);
    return streams.length === match.streams.length ? match : { ...match, streams };
  });
}

/** Bo3's v1 list carries broadcast links, so one request replaces a request per match. */
async function bo3Matches(
  game: "cs2" | "dota2",
  statuses: readonly ("current" | "upcoming" | "finished")[],
  ttl: number,
): Promise<EsportsMatch[]> {
  const api = await import("./esports-bo3-api");
  const query = { game, statuses, limit: 100 };
  return api.bo3FeedMatches(
    api.parseBo3Matches(await requestEsportsJson(api.bo3MatchesUrl(query), ttl), query),
  );
}

/**
 * Riot's JSON gateway first, the proven SSR page behind it. The gateway key is a constant their
 * own web client ships and Riot can rotate it without notice, so the scrape is what makes
 * depending on it safe: a 403 falls back instead of rendering an empty board.
 */
async function riotFeed(game: "lol" | "valorant"): Promise<FeedBatch> {
  const api = await import("./esports-riot-api");
  const scrape = async () => parseRiotEsports(await request(SOURCES[game].url, 90_000), game);
  const schedule = await api
    .fetchRiotSchedule(game, { fetchImpl: cachedReader(5 * MINUTE) })
    .catch(() => null);
  if (!schedule) return { matches: await scrape(), partial: false };
  // An empty board is the one answer the gateway cannot tell apart from a changed contract, so
  // the scrape gets the last word on it and the empty board stands if it sees none either.
  if (!schedule.length) return { matches: await scrape().catch(() => schedule), partial: false };
  // Only the gw live board is measured working; the val path answers 400. VALORANT is not asked
  // for a board it refuses, and its schedule events carry the same per event stream list.
  const live =
    game === "lol"
      ? await api
          .fetchRiotLive(game, { fetchImpl: cachedReader(MINUTE) })
          .then((board) => board.matches)
          .catch(() => [])
      : [];
  // Live rows come last so an in progress row, which is the one carrying broadcasts, wins a tie.
  return { matches: currentEsportsMatches([...schedule, ...live]), partial: false };
}

/** The v2 tier lists stay as the CS2 fallback: they are the coverage that ships working today. */
async function cs2Feed(): Promise<FeedBatch> {
  try {
    const [scheduled, finished] = await Promise.all([
      bo3Matches("cs2", ["current", "upcoming"], MINUTE),
      bo3Matches("cs2", ["finished"], 5 * MINUTE).then(
        (rows) => rows,
        () => null,
      ),
    ]);
    return {
      matches: currentEsportsMatches([...(finished ?? []), ...scheduled]),
      partial: finished === null,
    };
  } catch {
    const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
    const base = "https://api.bo3.gg/api/v2/matches/";
    const query = "?filter%5Bdiscipline_id%5D%5Beq%5D=1";
    return settledMatches([
      requestEsportsJson(`${base}live${query}`, MINUTE).then((raw) => parseBo3Esports(raw)),
      ...[0, 1].map((day) =>
        requestEsportsJson(
          `${base}upcoming${query}&date=${iso(day)}&utc_offset=0`,
          5 * MINUTE,
        ).then((raw) => parseBo3Esports(raw)),
      ),
      ...[0, -1].map((day) =>
        requestEsportsJson(
          `${base}finished${query}&date=${iso(day)}&utc_offset=0`,
          5 * MINUTE,
        ).then((raw) => parseBo3Esports(raw)),
      ),
    ]);
  }
}

/** OpenDota stays primary for live and recent: it is the only source that reports freshness. */
async function dota2Feed(): Promise<FeedBatch> {
  // OpenDota publishes no schedule at all, so bo3 contributes the upcoming board only. Keeping
  // the states disjoint is what stops one match arriving twice under two provider ids, and it is
  // an addition to a working board, so it neither reports a partial feed nor stands in for one.
  const [opendota, upcoming] = await Promise.all([
    settledMatches([
      requestEsportsJson("https://api.opendota.com/api/live", MINUTE).then((raw) =>
        parseOpenDotaEsports(raw, true),
      ),
      requestEsportsJson("https://api.opendota.com/api/proMatches", 5 * MINUTE).then((raw) =>
        parseOpenDotaEsports(raw, false),
      ),
    ]),
    bo3Matches("dota2", ["upcoming"], 5 * MINUTE).catch(() => []),
  ]);
  const matches = currentEsportsMatches([...opendota.matches, ...upcoming]);
  const broadcasts = await import("./esports-dota-broadcasts");
  return {
    partial: opendota.partial,
    matches: await broadcasts.attachDotaLeagueBroadcasts(matches).catch(() => matches),
  };
}

async function loadFeed(game: EsportsGameId): Promise<EsportsFeed> {
  const source = SOURCES[game];
  try {
    const batch: FeedBatch =
      game === "lol" || game === "valorant"
        ? await riotFeed(game)
        : game === "cs2"
          ? await cs2Feed()
          : game === "dota2"
            ? await dota2Feed()
            : {
                matches: parseBlastRocketLeague(await request(source.url, 90_000)),
                partial: false,
              };
    const result: EsportsFeed = {
      game,
      matches: allowedEsportsStreams(batch.matches),
      status: "ready",
      partial: batch.partial,
      fetchedAt: Date.now(),
      source,
      reason: batch.partial
        ? "Some match feeds did not respond. Available matches are shown."
        : undefined,
    };
    feedCache.set(game, result);
    return result;
  } catch {
    const previous = feedCache.get(game);
    return {
      game,
      matches: previous
        ? currentEsportsMatches(previous.matches.filter((match) => match.state !== "live"))
        : [],
      status: previous ? "stale" : "unavailable",
      fetchedAt: previous?.fetchedAt ?? Date.now(),
      source,
      reason: previous
        ? "Showing the last available schedule. Live status could not be refreshed."
        : "This match feed is unavailable. Try again or open the source schedule.",
    };
  }
}

/** Concurrent consumers share requests, while cancelling one view never cancels a peer. */
export async function fetchEsportsFeed(
  game: EsportsGameId,
  options: { signal?: AbortSignal; force?: boolean } = {},
): Promise<EsportsFeed> {
  options.signal?.throwIfAborted();
  const previous = feedCache.get(game);
  if (!options.force && previous && Date.now() - previous.fetchedAt < MINUTE)
    return { ...previous, matches: currentEsportsMatches(previous.matches) };
  let pending = inFlight.get(game);
  if (!pending) {
    if (options.force) {
      const hosts =
        game === "cs2"
          ? ["api.bo3.gg"]
          : game === "dota2"
            ? ["api.opendota.com", "api.bo3.gg", "www.dota2.com"]
            : game === "rocketleague"
              ? [new URL(SOURCES[game].url).hostname]
              : ["esports-api.lolesports.com", new URL(SOURCES[game].url).hostname];
      for (const [key, value] of responseCache)
        if (hosts.includes(new URL(value.url).hostname)) responseCache.delete(key);
    }
    pending = loadFeed(game).finally(() => {
      inFlight.delete(game);
    });
    inFlight.set(game, pending);
  }
  if (!options.signal) return pending;
  const signal = options.signal;
  return new Promise<EsportsFeed>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    pending!.then(
      (result) => {
        signal.removeEventListener("abort", abort);
        if (!signal.aborted) resolve(result);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
