import {
  currentEsportsMatches,
  type EsportsGameId,
  type EsportsMatch,
  type EsportsStream,
  type EsportsTeam,
} from "./esports-feeds";

/**
 * Bo3.gg v1 match list. Keyless, and the only surveyed source that returns broadcast links on the
 * list endpoint, so one request covers a whole title instead of one request per match.
 *
 * Deliberately never read: bet_updates (bookmaker affiliate redirects and prices), ai_predictions,
 * points, rating and stars. Harbor does not display betting markets or model predictions.
 */
export type Bo3GameId = "cs2" | "valorant" | "lol" | "dota2" | "deadlock" | "r6" | "mlbb";
export type Bo3Status = "current" | "upcoming" | "finished";

/** Verified 2026-09-30: discipline_id selects the title. There is no Rocket League discipline. */
export const BO3_DISCIPLINES: Record<Bo3GameId, number> = {
  cs2: 1,
  valorant: 2,
  lol: 3,
  dota2: 4,
  deadlock: 5,
  r6: 7,
  mlbb: 8,
};

export interface Bo3Stream extends EsportsStream {
  /** Provider language tag, lower case. Many series carry one channel per language. */
  language?: string;
  official: boolean;
  viewers?: number;
  channelLogo?: string;
}

/**
 * Tournament fields the match list actually expands. city, country, venue and event_type live only
 * on the per tournament detail endpoint, which is a separate request of about 220 KB.
 */
export interface Bo3Tournament {
  id: string;
  name: string;
  shortName?: string;
  slug?: string;
  logo?: string;
  banner?: string;
  /** Provider letter grade, s through d. */
  tier?: string;
  tierRank?: number;
  /** event_scope, for example regional or international. */
  scope?: string;
  /** event_level, for example regular or major. */
  level?: string;
  /** Provider prize total. The API states no currency, so present it as the provider's figure. */
  prize?: number;
  startMs?: number;
  endMs?: number;
  sourceUrl?: string;
}

export interface Bo3Match extends Omit<EsportsMatch, "game" | "streams"> {
  game: Bo3GameId;
  streams: Bo3Stream[];
  tier?: string;
}

export interface Bo3MatchPage {
  game: Bo3GameId;
  statuses: readonly Bo3Status[];
  /** Provider row count for the whole filter, not for this page. */
  total: number;
  matches: Bo3Match[];
  tournaments: Bo3Tournament[];
}

export interface Bo3Query {
  game: Bo3GameId;
  statuses?: readonly Bo3Status[];
  /** The provider caps page[limit] at 100. */
  limit?: number;
  offset?: number;
}

const DEFAULT_STATUSES: readonly Bo3Status[] = ["current", "upcoming"];
const PLATFORMS: Record<number, EsportsStream["platform"]> = {
  1: "twitch",
  2: "youtube",
  3: "kick",
};
const PLATFORM_LABELS: Record<string, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  kick: "Kick",
};
const STATES: Record<Bo3Status, EsportsMatch["state"]> = {
  current: "live",
  upcoming: "upcoming",
  finished: "recent",
};
/**
 * A current or upcoming board is hundreds of rows. The finished archive is legitimately tens of
 * thousands, so the count ceiling only guards the live facing states.
 */
const SCHEDULE_CEILING = 5_000;

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
const dateMs = (value: unknown): number | undefined => {
  const parsed = Date.parse(string(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};
const httpsUrl = (value: unknown): string | undefined => {
  try {
    const url = new URL(string(value));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
};
const letter = (value: unknown): string | undefined => {
  const text = string(value).toLowerCase();
  return /^[a-z]$/.test(text) ? text : undefined;
};
const word = (value: unknown): string | undefined => {
  const text = string(value).toLowerCase();
  return /^[a-z][a-z_ -]{0,23}$/.test(text) ? text : undefined;
};
const statusList = (query: Bo3Query): readonly Bo3Status[] =>
  query.statuses?.length ? query.statuses : DEFAULT_STATUSES;

/** One request per title and state set. The `matches.` filter prefix is mandatory; see parse. */
export function bo3MatchesUrl(query: Bo3Query): string {
  const statuses = statusList(query);
  const scheduled = statuses.includes("current") || statuses.includes("upcoming");
  const params = new URLSearchParams();
  params.set("filter[matches.discipline_id][eq]", String(BO3_DISCIPLINES[query.game]));
  params.set("filter[matches.status][in]", [...statuses].join(","));
  params.set("sort", scheduled ? "start_date" : "-start_date");
  params.set("page[limit]", String(Math.min(Math.max(Math.trunc(query.limit ?? 50), 1), 100)));
  if (query.offset) params.set("page[offset]", String(Math.max(Math.trunc(query.offset), 0)));
  params.set("with", "teams,tournament,streams,stage,round");
  return `https://api.bo3.gg/api/v1/matches?${params}`;
}

/** Only openable channel links, and only on the host the platform code claims. */
function channelUrl(raw: string, platform: EsportsStream["platform"]): string | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username || url.password) return undefined;
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/$/, "");
  if (platform === "twitch")
    return host === "twitch.tv" && /^\/[a-zA-Z0-9_]{1,25}$/.test(path) ? url.href : undefined;
  if (platform === "kick")
    return host === "kick.com" && /^\/[a-zA-Z0-9_-]{1,64}$/.test(path) ? url.href : undefined;
  if (platform !== "youtube" || !["youtube.com", "youtu.be"].includes(host)) return undefined;
  const watchable =
    host === "youtu.be" ||
    /^[a-zA-Z0-9_-]{11}$/.test(url.searchParams.get("v") ?? "") ||
    /^\/(?:live|embed)\/[a-zA-Z0-9_-]{11}$/.test(path) ||
    /^\/(?:@[\w.-]{1,64}|(?:c|channel|user)\/[\w.-]{1,64})$/.test(path);
  return watchable ? url.href : undefined;
}

function bo3Streams(raw: unknown): Bo3Stream[] {
  return list(raw)
    .flatMap<Bo3Stream>((value) => {
      const row = object(value);
      const platform = PLATFORMS[number(row.platform) ?? 0];
      const url = platform ? channelUrl(string(row.raw_url), platform) : undefined;
      // The provider's own embed_url carries no parent and Twitch refuses it. raw_url is what
      // esportsEmbedUrl turns into a player URL at render time.
      if (!platform || !url || row.blocked === true) return [];
      const language = string(row.language).toLowerCase();
      return [
        {
          title: string(row.name) || PLATFORM_LABELS[platform],
          url,
          platform,
          language: /^[a-z]{2}(-[a-z]{2})?$/.test(language) ? language : undefined,
          official: row.official === true,
          viewers: number(row.viewers_number),
          channelLogo: httpsUrl(row.channel_image_url),
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.official) - Number(a.official) ||
        (b.viewers ?? 0) - (a.viewers ?? 0) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, 12);
}

function bo3Tournament(raw: unknown): Bo3Tournament | undefined {
  const row = object(raw);
  const id = string(row.id);
  const name = string(row.name);
  const slug = string(row.slug);
  if (!/^\d+$/.test(id) || !name) return undefined;
  return {
    id,
    name,
    shortName: string(row.short_name) || undefined,
    slug: slug || undefined,
    logo: httpsUrl(row.image_url),
    banner: httpsUrl(row.banner_image_url),
    tier: letter(row.tier),
    tierRank: number(row.tier_rank),
    scope: word(row.event_scope),
    level: word(row.event_level),
    prize: number(row.prize) || undefined,
    startMs: dateMs(row.start_date),
    endMs: dateMs(row.end_date),
    sourceUrl: /^[a-z0-9-]+$/.test(slug) ? `https://bo3.gg/tournaments/${slug}` : undefined,
  };
}

/** Stage titles repeat the tournament name, which the event line already carries. */
function stageName(row: RecordValue): string {
  const title = string(object(row.stage).title);
  const tournament = string(object(row.tournament).name);
  const trimmed =
    tournament && title.toLowerCase().startsWith(tournament.toLowerCase())
      ? title.slice(tournament.length).trim()
      : title;
  return [trimmed, string(object(row.round).name)].filter(Boolean).join(" · ");
}

function bo3Teams(row: RecordValue, state: EsportsMatch["state"]): EsportsTeam[] {
  return [1, 2].map((side) => {
    const team = object(row[`team${side}`]);
    const id = string(team.id) || string(row[`team${side}_id`]);
    // There is no acronym field here. The UI renders code in place of the name, so a guessed code
    // would ship as a visible error; leave it unset until a source with real codes supplies one.
    return {
      id,
      name: string(team.name),
      logo: httpsUrl(team.image_url),
      score: state === "upcoming" ? undefined : number(row[`team${side}_score`]),
      winner: row.winner_team_id ? string(row.winner_team_id) === id : undefined,
    };
  });
}

/**
 * The silent filter trap, reproduced live: a filter written without the `matches.` prefix is
 * dropped, the server substitutes discipline 1, answers 200 with a plausible row count and echoes
 * the substitution in links.self. A request for Dota 2 that way returns Counter-Strike. So every
 * row is checked against both requested filters, and a mismatch is an outage rather than a board
 * of the wrong game.
 */
export function parseBo3Matches(raw: unknown, query: Bo3Query, now = Date.now()): Bo3MatchPage {
  const payload = object(raw);
  const rows = payload.results;
  const total = number(object(payload.total).count);
  if (!Array.isArray(rows) || total === undefined) throw new Error("Bo3 coverage is unavailable");
  const statuses = statusList(query);
  const discipline = BO3_DISCIPLINES[query.game];
  const self = new URLSearchParams(string(object(payload.links).self).split("?")[1] ?? "");
  const echoed = number(self.get("filter[matches.discipline_id][eq]"));
  if (echoed !== undefined && echoed !== discipline)
    throw new Error("Bo3 replaced the requested title filter");
  if (!statuses.includes("finished") && total > SCHEDULE_CEILING)
    throw new Error("Bo3 ignored the requested schedule filter");
  const tournaments = new Map<string, Bo3Tournament>();
  const parsed = rows.flatMap<Bo3Match>((value) => {
    const row = object(value);
    const status = string(row.status) as Bo3Status;
    // A known state outside the request means a filter was dropped. An unknown one is a provider
    // addition, which skips the row rather than emptying the board.
    if (number(row.discipline_id) !== discipline || (STATES[status] && !statuses.includes(status)))
      throw new Error("Bo3 returned rows outside the requested filter");
    const id = string(row.id);
    const slug = string(row.slug);
    const startMs = dateMs(row.start_date);
    if (!STATES[status] || !/^\d+$/.test(id) || !/^[a-z0-9-]+$/.test(slug) || startMs === undefined)
      return [];
    const tournament = bo3Tournament(row.tournament);
    if (tournament) tournaments.set(tournament.id, tournament);
    const state = STATES[status];
    return [
      {
        id,
        game: query.game,
        state,
        startMs,
        event: {
          id: tournament?.id ?? "",
          name: tournament?.name ?? "",
          logo: tournament?.logo,
          stage: stageName(row),
        },
        teams: bo3Teams(row, state) as [EsportsTeam, EsportsTeam],
        bestOf: number(row.bo_type),
        streams: bo3Streams(row.streams),
        tier: letter(row.tier) ?? tournament?.tier,
        sourceUrl: `https://bo3.gg/matches/${slug}`,
      },
    ];
  });
  // The window, dedupe and ordering rules are title independent; only the id union is wider here.
  const matches = currentEsportsMatches(parsed as unknown as EsportsMatch[], now);
  return {
    game: query.game,
    statuses,
    total,
    matches: matches as unknown as Bo3Match[],
    tournaments: [...tournaments.values()],
  };
}

type FeedGameId = Extract<Bo3GameId, EsportsGameId>;
const FEED_GAMES: readonly FeedGameId[] = ["cs2", "dota2", "lol", "valorant"];

/** The titles esports-feeds already models. Widen FEED_GAMES when EsportsGameId learns another. */
export function bo3FeedMatches(page: Bo3MatchPage): EsportsMatch[] {
  return page.matches.filter((match): match is Bo3Match & { game: FeedGameId } =>
    FEED_GAMES.includes(match.game as FeedGameId),
  );
}
