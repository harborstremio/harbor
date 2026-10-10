import type { EsportsGameId } from "./esports-feeds";

/**
 * Curated series allowlist. It is the only ranking signal that works across all five titles,
 * because Rocket League has no tier field and VALORANT publishes none at tournament level.
 */
export type LiquipediaWiki =
  | "counterstrike"
  | "dota2"
  | "leagueoflegends"
  | "valorant"
  | "rocketleague";

export interface SeriesDef {
  id: string;
  /** Display name, used as the card kicker. Brand names are never translated. */
  name: string;
  /** Titles the series runs events for; BLAST, PGL and ESL One each span more than one. */
  games: readonly EsportsGameId[];
  /** Matched against the normalised name only, never the raw one. No flags: the text is folded. */
  match: readonly RegExp[];
  /** Anti-patterns. A qualifier, academy or challenger edition is not the series itself. */
  deny?: readonly RegExp[];
  weight: number;
  /** Primary wiki for the series. For a multi-title series use LIQUIPEDIA_WIKI[game]. */
  liquipediaWiki: LiquipediaWiki;
  /** Page template with an edition token. Present only where the exact form was verified. */
  liquipediaPage?: string;
  /** Hand curated per edition. There is no keyless way to discover a playlist id. */
  youtubePlaylistId?: string;
}

/** Candidate shape; any normalised event record carrying these fields can be ranked. */
export interface SeriesCandidate {
  id: string;
  game: EsportsGameId;
  name: string;
  startMs?: number;
  endMs?: number;
  status?: "upcoming" | "live" | "completed";
  tier?: { liquipedia?: string; publisher?: string };
  prize?: { totalUsd?: number };
}

export interface RankedEsportsEvent<T extends SeriesCandidate = SeriesCandidate> {
  event: T;
  series?: SeriesDef;
  /** Series weight, or the unlisted S-Tier escape hatch, or 0 when neither applies. */
  weight: number;
  score: number;
  /** Chipped only when it says something; everything else carries no chip. */
  tierChip?: "S-Tier" | "Major";
}

export const LIQUIPEDIA_WIKI: Record<EsportsGameId, LiquipediaWiki> = {
  cs2: "counterstrike",
  dota2: "dota2",
  lol: "leagueoflegends",
  valorant: "valorant",
  rocketleague: "rocketleague",
};

const MARQUEE = 100;
const MAJOR = 80;
const CIRCUIT = 60;
const LEAGUE = 40;

/** An S-Tier event the table has never heard of still enters the row, so the list cannot rot. */
export const UNLISTED_S_TIER_WEIGHT = 70;

const MAJOR_MATCH = [/\bmajor\b/];
const MAJOR_DENY = [/\brmr\b/, /\bqualifier\b/, /\branking\b/, /\bmajor league\b/];

type SeriesExtra = Pick<SeriesDef, "deny" | "liquipediaPage" | "youtubePlaylistId">;
const series =
  (games: readonly EsportsGameId[], liquipediaWiki: LiquipediaWiki) =>
  (
    id: string,
    name: string,
    weight: number,
    match: RegExp[],
    extra?: Partial<SeriesExtra>,
  ): SeriesDef => ({ id, name, games, match, weight, liquipediaWiki, ...extra });

const cs = series(["cs2"], "counterstrike");
const dota = series(["dota2"], "dota2");
const lol = series(["lol"], "leagueoflegends");
const val = series(["valorant"], "valorant");
const rl = series(["rocketleague"], "rocketleague");

/**
 * Weights: 100 marquee, 80 major, 60 tier-1 circuit, 40 regional league. The league band exists
 * so a title between its internationals still fills a row rather than a publisher placeholder.
 */
export const ESPORTS_SERIES: readonly SeriesDef[] = [
  series(["cs2", "dota2", "rocketleague"], "counterstrike")(
    "major",
    "Major Championship",
    MAJOR,
    MAJOR_MATCH,
    { deny: MAJOR_DENY },
  ),
  series(["cs2", "dota2", "lol", "valorant", "rocketleague"], "counterstrike")(
    "ewc",
    "Esports World Cup",
    MAJOR,
    [/\besports world cup\b/, /\bewc\b/],
  ),
  series(["cs2", "dota2"], "counterstrike")("pgl", "PGL", CIRCUIT, [/\bpgl\b/]),
  series(["cs2", "dota2"], "counterstrike")("esl-one", "ESL One", CIRCUIT, [/\besl one\b/]),
  cs("iem", "Intel Extreme Masters", CIRCUIT, [/\biem\b/, /\bintel extreme masters\b/]),
  cs("esl-pro-league", "ESL Pro League", CIRCUIT, [/\besl pro league\b/, /\bepl season\b/]),
  cs("blast-premier", "BLAST Premier", CIRCUIT, [/\bblast premier\b/]),
  cs("blast-open", "BLAST Open", CIRCUIT, [/\bblast open\b/]),
  cs("blast-bounty", "BLAST Bounty", CIRCUIT, [/\bblast bounty\b/]),
  dota(
    "ti",
    "The International",
    MARQUEE,
    [/\bthe international\b/, /\bti\s?\d{1,2}\b/, /\bti\b/],
    { liquipediaPage: "The International/{edition}" },
  ),
  dota("blast-slam", "BLAST Slam", CIRCUIT, [/\bblast slam\b/]),
  dota("dreamleague", "DreamLeague", CIRCUIT, [/\bdreamleague\b/, /\bdream league\b/]),
  dota("riyadh-masters", "Riyadh Masters", CIRCUIT, [/\briyadh masters\b/]),
  lol("worlds", "World Championship", MARQUEE, [/\bworlds\b/, /\bworld championship\b/]),
  lol("msi", "Mid-Season Invitational", MAJOR, [/\bmsi\b/, /\bmid season invitational\b/]),
  lol("lck", "LCK", LEAGUE, [/\blck\b/], { deny: [/\bchallengers\b/, /\backademy\b/] }),
  lol("lec", "LEC", LEAGUE, [/\blec\b/]),
  lol("lpl", "LPL", LEAGUE, [/\blpl\b/]),
  lol("lta", "LTA", LEAGUE, [/\blta\b/]),
  lol("lcp", "LCP", LEAGUE, [/\blcp\b/]),
  val(
    "vct-champions",
    "VALORANT Champions",
    MARQUEE,
    [/\bvct champions\b/, /\bvalorant champions\b/, /\bchampions\b(?! tour)/],
    { deny: [/\bgame changers\b/, /\bascension\b/, /\bchallengers\b/] },
  ),
  val("vct-masters", "VCT Masters", MAJOR, [/\bmasters\b/]),
  val("vct-league", "VCT International League", LEAGUE, [
    /\bvct (?:americas|emea|pacific|china)\b/,
    /\bchampions tour\b.*\b(?:americas|emea|pacific|china)\b/,
  ]),
  rl("rlcs-worlds", "RLCS World Championship", MARQUEE, [
    /\brlcs\b.*\bworld championship\b/,
    /\bworld championship\b.*\brlcs\b/,
  ]),
  rl("rlcs", "RLCS", CIRCUIT, [/\brlcs\b/, /\brocket league championship series\b/]),
];

/**
 * toLowerCase, never toLocaleLowerCase: Turkish folds "IEM" to a dotless "iem" and every pattern
 * holding an i would stop matching for one of Harbor's sixteen locales.
 */
export function normalizeSeriesName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const matchedLength = (text: string, patterns: readonly RegExp[]): number =>
  patterns.reduce((best, pattern) => Math.max(best, pattern.exec(text)?.[0].length ?? 0), 0);

/**
 * Longest matched brand evidence wins, then the heavier series, then table order. Length first is
 * what keeps "RLCS World Championship" off the plain RLCS entry and "Riyadh Masters" off VCT
 * Masters. Passing the title is strongly preferred; without it every series is a candidate.
 */
export function matchEsportsSeries(name: string, game?: EsportsGameId): SeriesDef | undefined {
  const text = normalizeSeriesName(name);
  let best: SeriesDef | undefined;
  let bestLength = 0;
  for (const def of ESPORTS_SERIES) {
    if (game && !def.games.includes(game)) continue;
    if (def.deny?.some((pattern) => pattern.test(text))) continue;
    const length = matchedLength(text, def.match);
    if (!length) continue;
    if (length > bestLength || (length === bestLength && best && def.weight > best.weight)) {
      best = def;
      bestLength = length;
    }
  }
  return best;
}

/** A Major is the headline fact of its circuit, in CS2, Dota 2 and Rocket League alike. */
export function isMajorEventName(name: string): boolean {
  const text = normalizeSeriesName(name);
  return (
    MAJOR_MATCH.some((pattern) => pattern.test(text)) &&
    !MAJOR_DENY.some((pattern) => pattern.test(text))
  );
}

const TIER_RANKS = new Map<string, "s" | "a">([
  ["s", "s"],
  ["stier", "s"],
  ["tier1", "s"],
  ["1", "s"],
  ["premium", "s"],
  ["premier", "s"],
  ["a", "a"],
  ["atier", "a"],
  ["tier2", "a"],
  ["2", "a"],
  ["professional", "a"],
]);

const tierKey = (raw?: string) => (raw ? normalizeSeriesName(raw).replace(/ /g, "") : "");

/** Folds bo3.gg, OpenDota and Liquipedia tier spellings onto the two bands that score. */
export function esportsTierRank(tier?: SeriesCandidate["tier"]): "s" | "a" | undefined {
  return TIER_RANKS.get(tierKey(tier?.liquipedia)) ?? TIER_RANKS.get(tierKey(tier?.publisher));
}

const DAY = 86_400_000;
const prizeBonus = (usd?: number) =>
  usd && usd > 0 ? Math.min(30, Math.round(Math.log10(usd) * 4)) : 0;

/**
 * A window that covers now is read from the event's own published dates. It is not a claim that
 * any match is live; only a provider state may do that, and that rule lives with the matches.
 */
function proximityBonus(event: SeriesCandidate, now: number): number {
  if (event.status === "live") return 50;
  const start = event.startMs;
  const end = event.endMs ?? start;
  if (start !== undefined && start <= now && end !== undefined && end >= now)
    return event.status === "completed" ? 0 : 50;
  if (start === undefined) return 0;
  const days = (start - now) / DAY;
  return days < 0 ? 0 : days <= 7 ? 30 : days <= 30 ? 15 : 0;
}

/** Ended more than two days ago. Such an event leaves the row entirely. */
const isStale = (event: SeriesCandidate, now: number) => {
  const end = event.endMs ?? event.startMs;
  return end !== undefined && end < now - 2 * DAY;
};

/** Dota 2 lists premium leagues with no dates at all; an undated league is not upcoming. */
const isUndated = (event: SeriesCandidate) =>
  event.startMs === undefined && event.endMs === undefined && event.status !== "live";

export function scoreEsportsEvent<T extends SeriesCandidate>(
  event: T,
  now = Date.now(),
): RankedEsportsEvent<T> {
  const def = matchEsportsSeries(event.name, event.game);
  const rank = esportsTierRank(event.tier);
  const publisher = normalizeSeriesName(event.tier?.publisher ?? "");
  const major = isMajorEventName(event.name) || /\bmajor\b/.test(publisher);
  const weight = def?.weight ?? (rank === "s" ? UNLISTED_S_TIER_WEIGHT : 0);
  const tierBonus = (rank === "s" ? 40 : rank === "a" ? 20 : 0) + (major ? 30 : 0);
  return {
    event,
    series: def,
    weight,
    score: weight + tierBonus + prizeBonus(event.prize?.totalUsd) + proximityBonus(event, now),
    tierChip: rank === "s" ? "S-Tier" : major ? "Major" : undefined,
  };
}

export interface RankOptions {
  now?: number;
  /** Floor on series weight: 60 keeps circuits and up, 80 majors and up. 0 keeps everything. */
  minWeight?: number;
}

const startKey = (event: SeriesCandidate) => event.startMs ?? Number.MAX_SAFE_INTEGER;

/**
 * Scores and sorts candidates. Pure: the only clock reading is the default for options.now.
 * Weight 0 means neither the allowlist nor the S-Tier hatch claimed the event, so it is dropped.
 */
export function rankEsportsEvents<T extends SeriesCandidate>(
  events: readonly T[],
  options: RankOptions = {},
): RankedEsportsEvent<T>[] {
  const now = options.now ?? Date.now();
  const minWeight = options.minWeight ?? 1;
  return events
    .filter((event) => !isStale(event, now) && !isUndated(event))
    .map((event) => scoreEsportsEvent(event, now))
    .filter((entry) => entry.weight >= minWeight)
    .sort(
      (a, b) =>
        b.score - a.score ||
        startKey(a.event) - startKey(b.event) ||
        (a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0),
    );
}

export type EsportsUpcomingSource = "bo3" | "riot" | "opendota" | null;

/** Verified upcoming-event listers. Rocket League has none keyless, and none is invented here. */
export const ESPORTS_UPCOMING_SOURCE: Record<EsportsGameId, EsportsUpcomingSource> = {
  cs2: "bo3",
  lol: "riot",
  valorant: "riot",
  dota2: "opendota",
  rocketleague: null,
};

export const ESPORTS_ROW_GAMES: readonly EsportsGameId[] = [
  "cs2",
  "lol",
  "valorant",
  "dota2",
  "rocketleague",
];

export interface EsportsRowFallback {
  game: EsportsGameId;
  /** no-source: no verified lister exists. no-events: the lister answered with nothing rankable. */
  reason: "no-source" | "no-events";
}

/**
 * The degradation rule. A title that contributed no ranked event is still named, so the row can
 * render a publisher card from ESPORTS_GAMES instead of silently dropping the title.
 */
export function esportsRowFallbacks<T extends SeriesCandidate>(
  ranked: readonly RankedEsportsEvent<T>[],
  games: readonly EsportsGameId[] = ESPORTS_ROW_GAMES,
): EsportsRowFallback[] {
  const covered = new Set(ranked.map((entry) => entry.event.game));
  return games
    .filter((game) => !covered.has(game))
    .map(
      (game): EsportsRowFallback => ({
        game,
        reason: ESPORTS_UPCOMING_SOURCE[game] ? "no-events" : "no-source",
      }),
    );
}
