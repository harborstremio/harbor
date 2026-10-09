import { requestEsportsText, type EsportsStream } from "./esports-feeds.ts";

export interface CsPlayer {
  id: string;
  name: string;
  fullName?: string;
  image?: string;
  country?: string;
  stats: { label: string; value: string }[];
  url?: string;
}
export interface CsMatchDetail {
  teams: { id: string; name: string; logo?: string; players: CsPlayer[] }[];
  maps: {
    id: string;
    name: string;
    number: number;
    state: string;
    teamScores: [number | undefined, number | undefined];
  }[];
  streams: EsportsStream[];
  rosterBasis: "match" | "current-team" | "unavailable";
  sourceUrl: string;
  fetchedAt: number;
}

type Row = Record<string, unknown>;
const object = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string =>
  typeof value === "string"
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
const numeric = (value: unknown): number | undefined =>
  value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value))
    ? Number(value)
    : undefined;
const validSlug = (value: string): boolean => /^[a-z0-9][a-z0-9-]{0,180}$/.test(value);
const image = (value: unknown): string | undefined => {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" &&
      ["files.bo3.gg", "image-proxy.bo3.gg"].includes(url.hostname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

function player(raw: unknown, stats: Row = {}): CsPlayer | null {
  const row = object(raw);
  const id = text(row.id);
  const name = text(row.nickname);
  if (!/^\d+$/.test(id) || !name || row.is_coach === true) return null;
  const values: CsPlayer["stats"] = [];
  for (const [label, key, precision] of [
    ["Kills", "kills", 0],
    ["Deaths", "death", 0],
    ["Assists", "assists", 0],
    ["ADR", "adr", 1],
    ["First kills", "first_kills", 0],
    ["Headshots", "headshots", 0],
    ["Damage", "damage", 0],
    ["Trade kills", "trade_kills", 0],
  ] as const) {
    const value = numeric(stats[key]);
    if (value !== undefined && value >= 0) values.push({ label, value: value.toFixed(precision) });
  }
  const kast = numeric(stats.kast);
  if (kast !== undefined && kast >= 0 && kast <= 1)
    values.push({ label: "KAST", value: `${(kast * 100).toFixed(1)}%` });
  const slug = text(row.slug);
  return {
    id,
    name,
    fullName: [text(row.first_name), text(row.last_name)].filter(Boolean).join(" ") || undefined,
    image: image(row.image_url),
    country: text(object(row.country).name) || undefined,
    stats: values,
    url: validSlug(slug) ? `https://bo3.gg/players/${slug}` : undefined,
  };
}

const STREAM_LIMIT = 5;

/**
 * bo3 leaves official false even on a tournament's own channel, so requiring it hid every
 * broadcast. Rank instead: flagged official first, then live audience, and keep the shape checks.
 */
function matchStreams(raw: unknown): EsportsStream[] {
  return array(raw)
    .flatMap<EsportsStream & { rank: number }>((value) => {
      const row = object(value);
      if (row.blocked === true) return [];
      try {
        const url = new URL(text(row.raw_url));
        if (url.protocol !== "https:" || url.username || url.password) return [];
        const channel = text(row.name);
        const language = text(row.language);
        const title =
          channel && language
            ? `${channel} · ${language.toUpperCase()}`
            : channel || language.toUpperCase() || "Official broadcast";
        const rank = (row.official === true ? 1e9 : 0) + (numeric(row.viewers_number) ?? 0);
        if (
          ["twitch.tv", "www.twitch.tv"].includes(url.hostname) &&
          /^\/[a-z0-9_]{1,50}\/?$/i.test(url.pathname)
        )
          return [{ title, url: url.href, platform: "twitch", rank }];
        if (["youtube.com", "www.youtube.com", "youtu.be"].includes(url.hostname))
          return [{ title, url: url.href, platform: "youtube", rank }];
        if (
          ["kick.com", "www.kick.com"].includes(url.hostname) &&
          /^\/[a-z0-9_-]{1,64}\/?$/i.test(url.pathname)
        )
          return [{ title, url: url.href, platform: "kick", rank }];
      } catch {
        /* Ignore invalid or unlisted stream destinations. */
      }
      return [];
    })
    .sort((left, right) => right.rank - left.rank)
    .slice(0, STREAM_LIMIT)
    .map(({ rank: _rank, ...stream }) => stream);
}

/** Stats use the actual match team, preserving transfers since the match was played. */
export function parseCsMatchDetail(
  rawMatch: unknown,
  rawStats: unknown,
  rawRoster?: unknown,
  now = Date.now(),
): CsMatchDetail {
  const match = object(rawMatch);
  const slug = text(match.slug);
  if (numeric(match.discipline_id) !== 1 || !validSlug(slug) || !Array.isArray(rawStats))
    throw new Error("CS2 match detail is unavailable");
  const teams = [1, 2].map((side) => {
    const row = object(match[`team${side}`]);
    return {
      id: text(row.id || match[`team${side}_id`]),
      name: text(row.name),
      logo: image(row.image_url),
      players: [] as CsPlayer[],
    };
  });
  if (teams.some((team) => !team.name || !/^\d+$/.test(team.id)))
    throw new Error("CS2 teams are unavailable");
  const seen = new Set<string>();
  for (const value of rawStats.slice(0, 30)) {
    const row = object(value);
    const teamId = text(object(row.team_clan).team_id);
    const profile = player(object(row.steam_profile).player, row);
    const team = teams.find((item) => item.id === teamId);
    if (profile && team && !seen.has(profile.id)) {
      team.players.push(profile);
      seen.add(profile.id);
    }
  }
  let rosterBasis: CsMatchDetail["rosterBasis"] = seen.size ? "match" : "unavailable";
  // Only fall back when match-specific rosters are entirely absent. Do not mix historical and current players.
  if (!seen.size && rawRoster) {
    for (const value of array(object(rawRoster).results).slice(0, 30)) {
      const row = object(value);
      if (numeric(row.status) !== 1) continue;
      const profile = player(row);
      const team = teams.find((item) => item.id === text(row.team_id));
      if (profile && team && !seen.has(profile.id)) {
        team.players.push(profile);
        seen.add(profile.id);
      }
    }
    if (seen.size) rosterBasis = "current-team";
  }
  const maps = array(match.games)
    .slice(0, 9)
    .map((value) => {
      const row = object(value);
      const winnerId = text(object(row.winner_team_clan).team_id);
      const loserId = text(object(row.loser_team_clan).team_id);
      const scores = teams.map((team) =>
        team.id === winnerId
          ? numeric(row.winner_clan_score)
          : team.id === loserId
            ? numeric(row.loser_clan_score)
            : undefined,
      );
      return {
        id: text(row.id),
        name: text(row.map_name).replace(/^de_/, ""),
        number: numeric(row.number) ?? 0,
        state: text(row.status),
        teamScores: scores as [number | undefined, number | undefined],
      };
    })
    .filter((map) => map.id && map.name)
    .sort((a, b) => a.number - b.number);
  return {
    teams,
    maps,
    streams: matchStreams(match.streams),
    rosterBasis,
    sourceUrl: `https://bo3.gg/matches/${slug}`,
    fetchedAt: now,
  };
}

const cache = new Map<string, CsMatchDetail>();
const pending = new Map<string, Promise<CsMatchDetail>>();

export async function fetchCsMatchDetail(
  slug: string,
  signal?: AbortSignal,
): Promise<CsMatchDetail> {
  signal?.throwIfAborted();
  if (!validSlug(slug)) throw new Error("Invalid match identifier");
  const previous = cache.get(slug);
  if (previous && Date.now() - previous.fetchedAt < 60_000) return previous;
  let work = pending.get(slug);
  if (!work) {
    work = (async () => {
      const base = `https://api.bo3.gg/api/v1/matches/${slug}`;
      const [matchResult, statsResult] = await Promise.allSettled([
        requestEsportsText(`${base}?with=teams,games,streams`, 60_000).then(
          (raw) => JSON.parse(raw) as unknown,
        ),
        requestEsportsText(`${base}/players_stats`, 60_000).then(
          (raw) => JSON.parse(raw) as unknown,
        ),
      ]);
      if (matchResult.status !== "fulfilled") throw new Error("CS2 match detail is unavailable");
      const match = matchResult.value;
      const stats =
        statsResult.status === "fulfilled" && Array.isArray(statsResult.value)
          ? statsResult.value
          : [];
      let detail = parseCsMatchDetail(match, stats);
      if (detail.rosterBasis === "unavailable") {
        const ids = detail.teams.map((team) => team.id).join(",");
        try {
          // One bounded request covers both current squads; no per-player fan-out.
          const roster = JSON.parse(
            await requestEsportsText(
              `https://api.bo3.gg/api/v1/players?filter%5Bteam_id%5D%5Bin%5D=${ids}&filter%5Bis_coach%5D%5Beq%5D=false&page%5Blimit%5D=20&with=country`,
              5 * 60_000,
            ),
          );
          detail = parseCsMatchDetail(match, stats, roster);
        } catch {
          /* The real maps, teams and official broadcasts are still useful. */
        }
      }
      cache.set(slug, detail);
      if (cache.size > 20) cache.delete(cache.keys().next().value!);
      return detail;
    })().finally(() => {
      pending.delete(slug);
    });
    pending.set(slug, work);
  }
  if (!signal) return work;
  return new Promise<CsMatchDetail>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    work!.then(
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
