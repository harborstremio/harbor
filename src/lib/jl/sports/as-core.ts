/**
 * AllSports API basics shared by every AllSports feature: the gateway, per-sport paths, the game
 * shape and the standings parser. Plain functions, no I/O (the client is ./allsports.ts).
 * Each viewer brings their own key (settings.allsportsKey); it travels only in a request header.
 */

export const ALLSPORTS_BASE = "https://prod.api.market/api/v1/recodex/allsportsapi";
export const ALLSPORTS_KEY_HEADER = "x-api-market-key";

/** Every AllSports sport (path key → base path). "football" is soccer, served without a prefix. */
export const SPORT_BASE: Record<string, string> = {
  football: "/api",
  "american-football": "/api/american-football",
  basketball: "/api/basketball",
  "ice-hockey": "/api/ice-hockey",
  baseball: "/api/baseball",
  tennis: "/api/tennis",
  cricket: "/api/cricket",
  rugby: "/api/rugby",
  volleyball: "/api/volleyball",
  handball: "/api/handball",
  "table-tennis": "/api/table-tennis",
  esport: "/api/esport",
  mma: "/api/mma",
  motorsport: "/api/motorsport",
};

const EVENT_SPORTS = new Set(["tennis", "table-tennis", "esport", "mma"]);
// Handball and volleyball name their leagues "unique-tournament" in paths.
const UNIQUE_SPORTS = new Set(["handball", "volleyball"]);

export const isAsSport = (slug: string): boolean => Object.hasOwn(SPORT_BASE, slug);
const base = (slug: string) => SPORT_BASE[slug] ?? `/api/${slug}`;

/** One game's path: /api/match/1 (soccer), /api/tennis/event/1, /api/basketball/match/1. */
export function matchPath(slug: string, id: number | string): string {
  return `${base(slug)}/${EVENT_SPORTS.has(slug) ? "event" : "match"}/${id}`;
}

/** A league's path: /api/tournament/17, /api/handball/unique-tournament/30. */
export function tournamentPath(slug: string, id: number | string): string {
  return `${base(slug)}/${UNIQUE_SPORTS.has(slug) ? "unique-tournament" : "tournament"}/${id}`;
}

/** Tennis and table tennis list "events", the rest "matches". */
export function gamesSegment(slug: string): "events" | "matches" {
  return slug === "tennis" || slug === "table-tennis" ? "events" : "matches";
}

/** Every game of one sport on a calendar day (UTC date parts). */
export function dayPath(slug: string, date: Date): string {
  return `${base(slug)}/${gamesSegment(slug)}/${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
}

export type AsImageKind = "team" | "player" | "manager" | "tournament";

/** An image's path. Images need the key too, so the page loads them through the client. */
export function imagePath(slug: string, kind: AsImageKind, id: number | string): string {
  return kind === "tournament"
    ? `${tournamentPath(slug, id)}/image`
    : `${base(slug)}/${kind}/${id}/image`;
}

/** The feed has stray tabs and double spaces in some names. */
export const cleanName = (s: unknown): string =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();

/** "#aa0000" → "aa0000"; anything else → null. */
export const hexColor = (c: unknown): string | null =>
  typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c.slice(1) : null;

export const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// ---- Games -------------------------------------------------------------------------------------

export type AsTeam = {
  id: number;
  name: string;
  short: string;
  code: string;
  score: string | null;
  color: string | null;
};

export type AsGame = {
  id: number;
  slug: string;
  league: string;
  tournamentId: number | null;
  seasonId: number | null;
  customId: string | null;
  round: number | null;
  state: "pre" | "in" | "post";
  detail: string | null;
  startMs: number;
  away: AsTeam;
  home: AsTeam;
};

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});

const ORD = /^(\d+)(?:st|nd|rd|th)\s+(quarter|period|half|inning)/i;
const US_SPORTS = new Set(["american-football", "basketball", "ice-hockey", "baseball"]);

/** "2nd quarter" + clock → "Q2 9:45"; "1st period" → "P1"; "8th Inning" → "8th inning"; "Halftime" → "Half". */
export function asDetail(e: unknown, slug: string): string | null {
  const ev = rec(e);
  const status = rec(ev.status);
  const desc = String(status.description ?? "");
  if (status.type !== "inprogress") return null;
  const m = ORD.exec(desc);
  if (!m) return /half ?time/i.test(desc) ? "Half" : desc || null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "inning") return `${m[1]}${desc.slice(m[1].length, m[1].length + 2)} inning`;
  const label = unit === "quarter" ? `Q${n}` : unit === "period" ? `P${n}` : `H${n}`;
  if (slug === "football") return label === "H1" ? "1st half" : label === "H2" ? "2nd half" : desc;
  const time = rec(ev.time);
  const played = Number(time.played);
  const len = Number(time.periodLength);
  if (
    slug !== "baseball" &&
    Number.isFinite(played) &&
    len > 0 &&
    n <= Number(time.totalPeriodCount ?? 4)
  ) {
    const left = n * len - played;
    if (left >= 0 && left <= len)
      return `${label} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  }
  return label;
}

function asTeam(t: unknown, s: unknown): AsTeam {
  const team = rec(t);
  const score = rec(s);
  return {
    id: Number(team.id),
    name: cleanName(team.name ?? "?"),
    short: cleanName(team.shortName ?? team.name ?? "?"),
    code: String(team.nameCode ?? ""),
    score: score.current != null ? String(score.current) : null,
    color: hexColor(rec(team.teamColors).primary),
  };
}

/** Any sport's game (from match, schedule, live and h2h lists). Null when a side is missing. */
export function toGame(e: unknown, slug: string): AsGame | null {
  const ev = rec(e);
  if (!ev.id || !ev.homeTeam || !ev.awayTeam) return null;
  const type = rec(ev.status).type;
  const state = type === "inprogress" ? "in" : type === "finished" ? "post" : "pre";
  const tournament = rec(ev.tournament);
  const unique = rec(tournament.uniqueTournament);
  const desc = rec(ev.status).description;
  return {
    id: Number(ev.id),
    slug,
    league: cleanName(unique.name ?? tournament.name ?? ""),
    tournamentId: unique.id ? Number(unique.id) : null,
    seasonId: rec(ev.season).id ? Number(rec(ev.season).id) : null,
    customId: typeof ev.customId === "string" ? ev.customId : null,
    round: num(rec(ev.roundInfo).round),
    state,
    detail:
      state === "in"
        ? ((US_SPORTS.has(slug) || slug === "football" ? asDetail(ev, slug) : null) ??
          (desc ? String(desc) : null))
        : state === "post"
          ? String(desc ?? "Final")
          : null,
    startMs: Number(ev.startTimestamp) * 1000,
    away: asTeam(ev.awayTeam, ev.awayScore),
    home: asTeam(ev.homeTeam, ev.homeScore),
  };
}

/** Games from a list answer ({ events: [...] }), skipping incomplete rows. */
export function toGames(d: unknown, slug: string): AsGame[] {
  const events = rec(d).events;
  return (Array.isArray(events) ? events : [])
    .map((e) => toGame(e, slug))
    .filter((g): g is AsGame => !!g);
}

// ---- Standings ---------------------------------------------------------------------------------

export type TableRow = {
  teamId: number;
  name: string;
  position: number;
  played: number | null;
  wins: number;
  losses: number;
  draws: number;
  pf: number;
  pa: number;
  diff: string;
  points: number | null;
  pct: number | null;
};
export type Table = { name: string; rows: TableRow[] };

/** /standings/total → one table per group (conference, division or the whole league). */
export function tables(d: unknown): Table[] {
  const standings = rec(d).standings;
  return (Array.isArray(standings) ? standings : [])
    .map((s) => {
      const rows = rec(s).rows;
      return {
        name: cleanName(rec(s).name) || "Standings",
        rows: (Array.isArray(rows) ? rows : []).map((r): TableRow => {
          const row = rec(r);
          const team = rec(row.team);
          return {
            teamId: Number(team.id),
            name: cleanName(team.shortName ?? team.name),
            position: Number(row.position ?? 0),
            played: num(row.matches),
            wins: Number(row.wins ?? 0),
            losses: Number(row.losses ?? 0),
            draws: Number(row.draws ?? 0),
            pf: Number(row.scoresFor ?? 0),
            pa: Number(row.scoresAgainst ?? 0),
            diff: String(row.scoreDiffFormatted ?? ""),
            points: num(row.points),
            pct: num(row.percentage),
          };
        }),
      };
    })
    .filter((t) => t.rows.length);
}

// ---- Rate limit --------------------------------------------------------------------------------

/**
 * The plan allows 10 requests a second; start at most `rate` in any second. Returns a function
 * that resolves when the next request may start.
 */
export function createRateGate(
  rate = 8,
  now: () => number = () => Date.now(),
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): () => Promise<void> {
  const started: number[] = [];
  return async () => {
    for (;;) {
      const t = now();
      while (started.length && t - started[0] >= 1000) started.shift();
      if (started.length < rate) {
        started.push(t);
        return;
      }
      await sleep(1000 - (t - started[0]) + 5);
    }
  };
}

/** A getter bound to a key: path → parsed JSON, or null when there is nothing (or it failed). */
export type AsGet = <T = unknown>(path: string, ttlMs?: number) => Promise<T | null>;
