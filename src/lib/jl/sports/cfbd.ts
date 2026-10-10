import { CFBD_BASE } from "./sports-keys.ts";

/**
 * CollegeFootballData (the viewer's own key): the AP Top 25, Coaches Poll and Playoff rankings,
 * and its team list (every division, with colours and logos). CFBD's team ids are ESPN's, so a
 * ranked team opens the same team page as everywhere else.
 *
 * The free plan allows about 1,000 calls a month, so answers are kept across restarts: rankings
 * for 6 hours, the team list for a week. Plain module; the fetch is passed in.
 */

export const RANKINGS_TTL_MS = 6 * 3600_000;
export const TEAMS_TTL_MS = 7 * 24 * 3600_000;

export type CfbdRank = {
  rank: number;
  /** ESPN's team id. */
  teamId: string;
  school: string;
  conference: string | null;
  points: number | null;
  firstPlaceVotes: number | null;
};

export type CfbdPoll = { name: string; ranks: CfbdRank[] };

export type CfbdRankings = {
  season: number;
  seasonType: string;
  week: number;
  polls: CfbdPoll[];
};

export type CfbdTeam = {
  id: string;
  school: string;
  mascot: string | null;
  abbreviation: string | null;
  conference: string | null;
  /** "fbs", "fcs", "ii", "iii". */
  classification: string | null;
  /** Hex without '#'. */
  color: string | null;
  altColor: string | null;
  logos: string[];
};

/** Polls shown first, in this order; any others follow. */
const POLL_ORDER = ["Playoff Committee Rankings", "AP Top 25", "Coaches Poll"];

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const id = (v: unknown): string | null =>
  typeof v === "number" && Number.isInteger(v) && v > 0
    ? String(v)
    : typeof v === "string" && /^\d{1,9}$/.test(v)
      ? v
      : null;
const hex = (v: unknown): string | null => {
  const m = typeof v === "string" ? /^#?([0-9a-f]{6})$/i.exec(v.trim()) : null;
  return m ? m[1].toLowerCase() : null;
};

/** The season a date falls in: games run August to January, so January belongs to last year. */
export function cfbdSeason(now: Date): number {
  return now.getMonth() < 1 ? now.getFullYear() - 1 : now.getFullYear();
}

const SEASON_TYPE_ORDER: Record<string, number> = { regular: 0, postseason: 1 };

/** The latest week's polls from /rankings (CFBD's v1 and v2 field names both accepted). */
export function parseRankings(body: unknown): CfbdRankings | null {
  let best: { entry: Record<string, unknown>; order: number } | null = null;
  for (const raw of asArray<Record<string, unknown>>(body)) {
    const week = num(raw?.week);
    if (week === null) continue;
    const type = text(raw.seasonType ?? raw.season_type) ?? "regular";
    const order = (SEASON_TYPE_ORDER[type] ?? 0) * 1000 + week;
    if (!best || order > best.order) best = { entry: raw, order };
  }
  if (!best) return null;
  const e = best.entry;
  const polls: CfbdPoll[] = asArray<Record<string, unknown>>(e.polls).flatMap((p) => {
    const name = text(p?.poll);
    if (!name) return [];
    const ranks = asArray<Record<string, unknown>>(p.ranks)
      .flatMap((r): CfbdRank[] => {
        const rank = num(r?.rank);
        const teamId = id(r.teamId ?? r.team_id ?? r.id);
        const school = text(r.school);
        if (rank === null || !teamId || !school) return [];
        return [
          {
            rank,
            teamId,
            school,
            conference: text(r.conference),
            points: num(r.points),
            firstPlaceVotes: num(r.firstPlaceVotes ?? r.first_place_votes),
          },
        ];
      })
      .sort((a, b) => a.rank - b.rank);
    return ranks.length ? [{ name, ranks }] : [];
  });
  const at = (name: string) => {
    const i = POLL_ORDER.indexOf(name);
    return i < 0 ? POLL_ORDER.length : i;
  };
  polls.sort((a, b) => at(a.name) - at(b.name) || a.name.localeCompare(b.name));
  return {
    season: num(e.season) ?? 0,
    seasonType: text(e.seasonType ?? e.season_type) ?? "regular",
    week: num(e.week) ?? 0,
    polls,
  };
}

export function parseTeams(body: unknown): CfbdTeam[] {
  return asArray<Record<string, unknown>>(body).flatMap((t): CfbdTeam[] => {
    const teamId = id(t?.id);
    const school = text(t?.school);
    if (!teamId || !school) return [];
    return [
      {
        id: teamId,
        school,
        mascot: text(t.mascot),
        abbreviation: text(t.abbreviation),
        conference: text(t.conference),
        classification: text(t.classification)?.toLowerCase() ?? null,
        color: hex(t.color),
        altColor: hex(t.alternateColor ?? t.alt_color),
        logos: asArray<unknown>(t.logos).filter(
          (u): u is string => typeof u === "string" && /^https:\/\//.test(u),
        ),
      },
    ];
  });
}

/** A team's rank in a poll (AP Top 25 by default), or null when unranked. */
export function rankOf(
  rankings: CfbdRankings | null,
  teamId: string,
  poll = "AP Top 25",
): number | null {
  return (
    rankings?.polls.find((p) => p.name === poll)?.ranks.find((r) => r.teamId === teamId)?.rank ??
    null
  );
}

export type CfbdFetch = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ status: number; text(): Promise<string> }>;

export type CfbdStorage = {
  get(key: string): string | null;
  set(key: string, value: string): void;
};

type Cached<T> = { at: number; value: T };

/**
 * Cached CFBD reads for one key. A failed call keeps the last good answer (if any) and is not
 * retried for 15 minutes, so a bad key or a down service never burns the monthly allowance.
 */
export function createCfbdClient(deps: {
  fetch: CfbdFetch;
  storage: CfbdStorage;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  const memory = new Map<string, Cached<unknown>>();
  const failedAt = new Map<string, number>();
  const inflight = new Map<string, Promise<unknown>>();

  const read = <T>(key: string): Cached<T> | null => {
    const hit = memory.get(key) as Cached<T> | undefined;
    if (hit) return hit;
    try {
      const raw = deps.storage.get(key);
      const parsed = raw ? (JSON.parse(raw) as Cached<T>) : null;
      if (parsed && typeof parsed.at === "number") {
        memory.set(key, parsed);
        return parsed;
      }
    } catch {
      /* unreadable cache: fetch again */
    }
    return null;
  };

  async function get<T>(
    apiKey: string,
    path: string,
    ttl: number,
    parse: (body: unknown) => T,
  ): Promise<T | null> {
    // One cache per key, so switching keys never shows another account's answers.
    const cacheKey = `jl-cfbd:${hashKey(apiKey)}:${path}`;
    const cached = read<T>(cacheKey);
    if (cached && now() - cached.at < ttl) return cached.value;
    if (now() - (failedAt.get(cacheKey) ?? 0) < 15 * 60_000) return cached?.value ?? null;
    const running = inflight.get(cacheKey) as Promise<T | null> | undefined;
    if (running) return running;
    const job = (async () => {
      try {
        const res = await deps.fetch(`${CFBD_BASE}${path}`, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        });
        if (res.status !== 200) throw new Error(String(res.status));
        const value = parse(JSON.parse(await res.text()));
        const entry: Cached<T> = { at: now(), value };
        memory.set(cacheKey, entry);
        try {
          deps.storage.set(cacheKey, JSON.stringify(entry));
        } catch {
          /* storage full or blocked: memory still holds it */
        }
        return value;
      } catch {
        failedAt.set(cacheKey, now());
        return cached?.value ?? null;
      } finally {
        inflight.delete(cacheKey);
      }
    })();
    inflight.set(cacheKey, job);
    return job;
  }

  return {
    rankings: (apiKey: string, season: number) =>
      get(apiKey, `/rankings?year=${season}`, RANKINGS_TTL_MS, parseRankings),
    teams: (apiKey: string) => get(apiKey, "/teams", TEAMS_TTL_MS, parseTeams),
  };
}

/** A short, stable tag for a key, so the key itself is never written into storage keys. */
function hashKey(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}
