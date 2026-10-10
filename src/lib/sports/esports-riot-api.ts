import {
  currentEsportsMatches,
  type EsportsMatch,
  type EsportsStream,
  type EsportsTeam,
} from "./esports-feeds";

export type RiotTitle = "lol" | "valorant";

/**
 * The static key Riot's own esports web client ships. It is not a user credential and
 * nothing is entered in Settings. A 403 means the key rotated, never an empty schedule:
 * an absent key and a wrong key return byte identical Forbidden bodies.
 */
export const RIOT_ESPORTS_API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";

const API_BASE = "https://esports-api.lolesports.com/persisted";
const LIVESTATS_BASE = "https://feed.lolesports.com/livestats/v1";
const ORIGINS: Record<RiotTitle, string> = {
  lol: "https://lolesports.com",
  valorant: "https://valorantesports.com",
};
const NUMERIC_ID = /^\d{1,25}$/;
const GAME_ID = /^\d{6,25}$/;

export type RiotFeedFailure =
  | "key-rotated"
  | "title-mismatch"
  | "title-unknown"
  | "unavailable"
  | "malformed";

/** Every failure here means "fall back to the SSR parser"; the kind is for logging only. */
export class RiotFeedError extends Error {
  readonly failure: RiotFeedFailure;
  readonly status?: number;
  constructor(failure: RiotFeedFailure, message: string, status?: number) {
    super(message);
    this.name = "RiotFeedError";
    this.failure = failure;
    this.status = status;
  }
}

export function riotFeedFailure(error: unknown): RiotFeedFailure | null {
  return error instanceof RiotFeedError ? error.failure : null;
}

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
    if (
      url.protocol === "http:" &&
      ["static.lolesports.com", "static.valorantesports.com"].includes(url.hostname)
    )
      url.protocol = "https:";
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** VALORANT needs the val path segment and sport=val. Either one alone answers with LoL. */
function apiUrl(title: RiotTitle, op: string, hl: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({
    hl,
    ...(title === "valorant" ? { sport: "val" } : {}),
    ...extra,
  });
  return `${API_BASE}/${title === "valorant" ? "val" : "gw"}/${op}?${params}`;
}

export const riotScheduleUrl = (title: RiotTitle, hl = "en-US"): string =>
  apiUrl(title, "getSchedule", hl);

export const riotLiveUrl = (title: RiotTitle, hl = "en-US"): string =>
  apiUrl(title, "getLive", hl);

export function riotEventDetailsUrl(title: RiotTitle, matchId: string, hl = "en-US"): string {
  if (!NUMERIC_ID.test(matchId))
    throw new RiotFeedError("malformed", "Event details needs a numeric match id");
  return apiUrl(title, "getEventDetails", hl, { id: matchId });
}

/**
 * Keyless live stats window. It takes a GAME id from match.games[], not a match id;
 * a match id answers 404.
 */
export function riotLiveStatsWindowUrl(gameId: string, startingTime?: string): string {
  if (!GAME_ID.test(gameId))
    throw new RiotFeedError("malformed", "Live stats needs a numeric game id");
  const suffix = startingTime ? `?startingTime=${encodeURIComponent(startingTime)}` : "";
  return `${LIVESTATS_BASE}/window/${gameId}${suffix}`;
}

export function riotRequestHeaders(key = RIOT_ESPORTS_API_KEY): Record<string, string> {
  return { "x-api-key": key };
}

// Slug families, not byte sizes: the gw endpoint answers 200 with LoL data for sport=val.
const words = (value: string): string[] => value.split(" ");
const VALORANT_SLUGS = new Set(
  words("champions masters last_chance_qualifier mena_resilience valorant_oceania_tour"),
);
const VALORANT_PREFIXES = words("vct_ vct- game_changers challengers_ vrl_ valorant");
// LoL is matched first so emea_masters never reads as the VALORANT masters event.
const LOL_SLUGS = new Set(
  words(
    "lck lec lpl lcs lcl ljl lla lco lcp vcs pcs tcl cblol worlds msi emea_masters nacl nlc " +
      "prime_league superliga ultraliga elite_series liga_portuguesa hitpoint_masters " +
      "esports_balkan_league arabian_league greek_legends_league rift_legends honor_division " +
      "honor_league circuito_desafiante golden_league asian_games",
  ),
);
const LOL_PREFIXES = words("lck_ lec_ lpl_ lcs_ ljl_ cblol_ lla_ emea_ worlds_");

export function riotSlugTitle(slug: string): RiotTitle | null {
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  if (LOL_SLUGS.has(key) || LOL_PREFIXES.some((prefix) => key.startsWith(prefix))) return "lol";
  if (VALORANT_SLUGS.has(key) || VALORANT_PREFIXES.some((prefix) => key.startsWith(prefix)))
    return "valorant";
  return null;
}

function eventRows(payload: unknown): RecordValue[] {
  const data = object(object(payload).data);
  const events = list(object(data.schedule).events).map(object);
  if (events.length) return events;
  const single = object(data.event);
  return single.league || single.match || single.type ? [single] : [];
}

/** A changed envelope must report malformed, never an empty board. */
export function riotScheduleEvents(payload: unknown): RecordValue[] {
  const data = object(object(payload).data);
  if (!data.schedule && !data.event)
    throw new RiotFeedError("malformed", "Riot esports schedule format changed");
  return eventRows(payload);
}

export function detectRiotTitle(payload: unknown): RiotTitle | null {
  let lol = 0;
  let valorant = 0;
  for (const event of eventRows(payload)) {
    const title = riotSlugTitle(string(object(event.league).slug));
    if (title === "lol") lol += 1;
    else if (title === "valorant") valorant += 1;
  }
  if (lol && !valorant) return "lol";
  if (valorant && !lol) return "valorant";
  return null;
}

/** The silent wrong data guard. Only a league slug proves which title answered. */
export function assertRiotTitle(payload: unknown, expected: RiotTitle): void {
  const detected = detectRiotTitle(payload);
  if (detected === expected) return;
  throw new RiotFeedError(
    detected ? "title-mismatch" : "title-unknown",
    detected
      ? `Riot ${expected} endpoint answered with ${detected} data`
      : `Riot ${expected} endpoint answered without a recognizable league`,
  );
}

export interface RiotStream extends EsportsStream {
  locale: string;
  countries: string[];
}

/** Per language broadcast channels. Providers without a measured URL shape are dropped. */
export function parseRiotStreams(raw: unknown): RiotStream[] {
  const seen = new Set<string>();
  return list(raw).flatMap<RiotStream>((value) => {
    const row = object(value);
    const provider = string(row.provider).toLowerCase();
    const parameter = string(row.parameter);
    const media = object(row.mediaLocale);
    const locale = string(row.locale) || string(media.locale);
    const title =
      string(media.translatedName) || string(media.englishName) || locale || provider || "Stream";
    const url =
      provider === "twitch" && /^[a-zA-Z0-9_]{1,25}$/.test(parameter)
        ? `https://www.twitch.tv/${parameter}`
        : provider === "youtube" && /^[a-zA-Z0-9_-]{11}$/.test(parameter)
          ? `https://www.youtube.com/watch?v=${parameter}`
          : "";
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [
      {
        title,
        url,
        platform: provider === "twitch" ? ("twitch" as const) : ("youtube" as const),
        locale,
        countries: list(row.countries).map(string).filter(Boolean),
      },
    ];
  });
}

const STATES = {
  unstarted: "upcoming",
  inProgress: "live",
  completed: "recent",
} as const;

function eventMeta(event: RecordValue, title: RiotTitle) {
  const league = object(event.league);
  const tournament = object(event.tournament);
  const slug = string(league.slug);
  return {
    event: {
      id: string(tournament.id) || string(league.id) || slug,
      name: string(league.name) || slug.replace(/_/g, " ").toUpperCase(),
      logo: imageUrl(league.image),
      stage: string(event.blockName),
    },
    sourceUrl: NUMERIC_ID.test(string(tournament.id))
      ? `${ORIGINS[title]}/en-US/tournament/${string(tournament.id)}`
      : `${ORIGINS[title]}/en-US/schedule`,
  };
}

/** Shows carry no match object, so teams are never read before type is confirmed. */
function matchFrom(event: RecordValue, title: RiotTitle): EsportsMatch | null {
  if (string(event.type) !== "match") return null;
  const match = object(event.match);
  const id = string(match.id) || string(event.id);
  const state = STATES[string(event.state) as keyof typeof STATES];
  if (!NUMERIC_ID.test(id) || !state) return null;
  const teams = list(match.teams)
    .slice(0, 2)
    .map((value) => {
      const team = object(value);
      const result = object(team.result);
      const name = string(team.name);
      return {
        id: string(team.id).split(":").at(-1) || string(team.code).toLowerCase() || name,
        name,
        code: string(team.code),
        logo: imageUrl(team.image),
        score: state === "upcoming" ? undefined : number(result.gameWins),
        winner: result.outcome === "win",
      };
    });
  if (teams.length !== 2) return null;
  const strategy = object(match.strategy);
  return {
    id,
    game: title,
    state,
    startMs: Date.parse(string(event.startTime)),
    ...eventMeta(event, title),
    teams: teams as [EsportsTeam, EsportsTeam],
    bestOf: strategy.type === "bestOf" ? number(strategy.count) : undefined,
    streams: parseRiotStreams(event.streams),
  };
}

export function parseRiotSchedule(
  payload: unknown,
  title: RiotTitle,
  now = Date.now(),
): EsportsMatch[] {
  const events = riotScheduleEvents(payload);
  assertRiotTitle(payload, title);
  return currentEsportsMatches(
    events.flatMap((event) => {
      const match = matchFrom(event, title);
      return match ? [match] : [];
    }),
    now,
  );
}

/** A live show has the full streams list and no teams, so it cannot be an EsportsMatch. */
export interface RiotBroadcast {
  id: string;
  game: RiotTitle;
  state: "live" | "upcoming" | "recent";
  startMs: number;
  event: { id: string; name: string; logo?: string; stage?: string };
  streams: RiotStream[];
  sourceUrl: string;
}

export interface RiotLiveBoard {
  matches: EsportsMatch[];
  broadcasts: RiotBroadcast[];
}

export function parseRiotLive(payload: unknown, title: RiotTitle, now = Date.now()): RiotLiveBoard {
  const events = riotScheduleEvents(payload);
  if (events.length) assertRiotTitle(payload, title);
  const matches: EsportsMatch[] = [];
  const broadcasts: RiotBroadcast[] = [];
  for (const event of events) {
    const match = matchFrom(event, title);
    if (match) {
      matches.push(match);
      continue;
    }
    const id = string(event.id);
    const state = STATES[string(event.state) as keyof typeof STATES];
    const streams = parseRiotStreams(event.streams);
    const startMs = Date.parse(string(event.startTime));
    if (string(event.type) === "match" || !id || !state || !streams.length) continue;
    if (!Number.isFinite(startMs)) continue;
    broadcasts.push({
      id,
      game: title,
      state,
      startMs,
      ...eventMeta(event, title),
      streams,
    });
  }
  return { matches: currentEsportsMatches(matches, now), broadcasts };
}

export interface RiotVod {
  gameId: string;
  gameNumber: number;
  locale: string;
  title: string;
  platform: "twitch" | "youtube";
  url: string;
  startMs: number;
}

function twitchSeek(seconds: number): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `?t=${hours ? `${hours}h` : ""}${minutes || hours ? `${minutes}m` : ""}${seconds % 60}s`;
}

/** Per locale replays. startMillis is a seek offset into the recording, not a timestamp. */
export function parseRiotEventVods(payload: unknown): RiotVod[] {
  return riotScheduleEvents(payload).flatMap((event) =>
    list(object(event.match).games).flatMap((value) => {
      const game = object(value);
      const gameId = string(game.id);
      if (!GAME_ID.test(gameId)) return [];
      return list(game.vods).flatMap<RiotVod>((entry) => {
        const vod = object(entry);
        const provider = string(vod.provider).toLowerCase();
        const parameter = string(vod.parameter);
        const startMs = Math.max(0, number(vod.startMillis) ?? 0);
        const offset = Math.floor(startMs / 1000);
        const media = object(vod.mediaLocale);
        const locale = string(vod.locale) || string(media.locale);
        const youtube = provider === "youtube" && /^[a-zA-Z0-9_-]{11}$/.test(parameter);
        const twitch = provider === "twitch" && /^\d{6,20}$/.test(parameter);
        if (!youtube && !twitch) return [];
        return [
          {
            gameId,
            gameNumber: number(game.number) ?? 0,
            locale,
            title: string(media.translatedName) || string(media.englishName) || locale || provider,
            platform: youtube ? ("youtube" as const) : ("twitch" as const),
            url: youtube
              ? `https://www.youtube.com/watch?v=${parameter}${offset ? `&t=${offset}` : ""}`
              : `https://www.twitch.tv/videos/${parameter}${twitchSeek(offset)}`,
            startMs,
          },
        ];
      });
    }),
  );
}

/** Game ids for the keyless live stats window, which never accepts a match id. */
export function riotGameIds(payload: unknown): string[] {
  return riotScheduleEvents(payload).flatMap((event) =>
    list(object(event.match).games)
      .map((value) => string(object(value).id))
      .filter((id) => GAME_ID.test(id)),
  );
}

type RiotResponse = { ok: boolean; status: number; text: () => Promise<string> };
type RiotFetch = (
  url: string,
  init: { headers: Record<string, string>; signal?: AbortSignal },
) => Promise<RiotResponse>;

export interface RiotRequestOptions {
  fetchImpl?: RiotFetch;
  signal?: AbortSignal;
  key?: string;
  hl?: string;
}

/** 403 is reported as a rotated key so a caller never renders it as an empty board. */
export async function requestRiotJson(
  url: string,
  options: RiotRequestOptions = {},
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? (await import("../safe-fetch")).safeFetch;
  let response: RiotResponse;
  try {
    response = await fetchImpl(url, {
      headers: riotRequestHeaders(options.key),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as { name?: string } | undefined)?.name === "AbortError") throw error;
    throw new RiotFeedError("unavailable", "Riot esports API did not respond");
  }
  if (response.status === 403)
    throw new RiotFeedError("key-rotated", "Riot esports API key was rejected", 403);
  if (!response.ok)
    throw new RiotFeedError("unavailable", "Riot esports API is unavailable", response.status);
  const text = await response.text();
  if (text.length > 8_000_000)
    throw new RiotFeedError("malformed", "Riot schedule response is too large");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RiotFeedError("malformed", "Riot esports API sent no readable JSON");
  }
}

export async function fetchRiotSchedule(
  title: RiotTitle,
  options: RiotRequestOptions = {},
): Promise<EsportsMatch[]> {
  return parseRiotSchedule(
    await requestRiotJson(riotScheduleUrl(title, options.hl), options),
    title,
  );
}

export async function fetchRiotLive(
  title: RiotTitle,
  options: RiotRequestOptions = {},
): Promise<RiotLiveBoard> {
  return parseRiotLive(await requestRiotJson(riotLiveUrl(title, options.hl), options), title);
}

export async function fetchRiotEventDetails(
  title: RiotTitle,
  matchId: string,
  options: RiotRequestOptions = {},
): Promise<{ vods: RiotVod[]; gameIds: string[]; streams: RiotStream[] }> {
  const payload = await requestRiotJson(riotEventDetailsUrl(title, matchId, options.hl), options);
  return {
    vods: parseRiotEventVods(payload),
    gameIds: riotGameIds(payload),
    streams: parseRiotStreams(object(object(object(payload).data).event).streams),
  };
}
