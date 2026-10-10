import { requestEsportsJson, requestEsportsText, type EsportsMatch } from "./esports-feeds";
import { esportsEmbedUrl, type EsportsStream } from "./esports-streams";

type Row = Record<string, unknown>;
const row = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
const text = (v: unknown) => (typeof v === "string" ? v : "");
const normalize = (v: unknown) =>
  text(v)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const slug = (v: unknown) => /^[a-z0-9][a-z0-9-]{0,180}$/.test(text(v));

const PLATFORMS: Record<string, EsportsStream["platform"]> = {
  "twitch.tv": "twitch",
  "player.twitch.tv": "twitch",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "youtube-nocookie.com": "youtube",
  "kick.com": "kick",
};
const LABELS: Record<string, string> = { twitch: "Twitch", youtube: "YouTube", kick: "Kick" };

/**
 * One host allowlist for every Dota source. A scheme is prepended first because Valve returns at
 * least one broadcast without one, and an unparseable row would otherwise discard the whole list.
 */
export function dotaBroadcastStream(raw: unknown, name?: unknown): EsportsStream | null {
  const candidate = text(raw).trim();
  if (!candidate) return null;
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`,
    );
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.replace(/^www\./, "");
    const platform = PLATFORMS[host];
    if (!platform) return null;
    const title = text(name).trim();
    if (platform === "twitch") {
      const channel =
        host === "player.twitch.tv"
          ? (url.searchParams.get("channel") ?? "")
          : (url.pathname.split("/")[1] ?? "");
      if (!/^[a-z0-9_]{1,25}$/i.test(channel)) return null;
      const stream: EsportsStream = {
        title: title || channel,
        url: `https://www.twitch.tv/${channel}`,
        platform: "twitch",
      };
      return esportsEmbedUrl(stream, "localhost") ? stream : null;
    }
    const stream: EsportsStream = { title: title || LABELS[platform], url: url.href, platform };
    return esportsEmbedUrl(stream, "localhost") ? stream : null;
  } catch {
    return null;
  }
}

/** Read public page data only. Never execute scripts or import advertising markup. */
export function dotaPageProps(html: string): Row {
  const raw = html.match(/\bdata-page="([^"]+)"/)?.[1];
  if (!raw) throw new Error("Dota match listing unavailable");
  const decoded = raw.replace(/&(?:quot|apos|amp|lt|gt|#39|#\d+|#x[0-9a-f]+);/gi, (entity) => {
    const named: Record<string, string> = {
      "&quot;": '"',
      "&apos;": "'",
      "&#39;": "'",
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
    };
    if (named[entity]) return named[entity];
    const code = entity.toLowerCase().startsWith("&#x")
      ? parseInt(entity.slice(3, -1), 16)
      : Number(entity.slice(2, -1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
  return row(row(JSON.parse(decoded)).props);
}

function sameMatch(series: Row, match: EsportsMatch): boolean {
  const names = [normalize(row(series.team1).name), normalize(row(series.team2).name)].sort();
  const expected = match.teams.map((team) => normalize(team.name)).sort();
  const start = Date.parse(text(series.startAt));
  return (
    names.every(Boolean) &&
    names[0] === expected[0] &&
    names[1] === expected[1] &&
    Number.isFinite(start) &&
    Math.abs(start - match.startMs) <= 12 * 60 * 60_000
  );
}

export function dotaBroadcastMatchUrl(html: string, match: EsportsMatch): string | null {
  const props = dotaPageProps(html);
  const candidates = ["seriesList", "upcomingSeriesList", "latestSeriesResults"]
    .flatMap((key) => (Array.isArray(props[key]) ? (props[key] as unknown[]) : []))
    .map(row)
    .filter((series) => sameMatch(series, match));
  const urls = [
    ...new Set(
      candidates.flatMap((series) =>
        slug(series.slug) && slug(row(series.championship).slug)
          ? [`https://hawk.live/dota-2/matches/${row(series.championship).slug}/${series.slug}`]
          : [],
      ),
    ),
  ];
  return urls.length === 1 ? urls[0] : null;
}

export function parseDotaBroadcasts(html: string, match: EsportsMatch): EsportsStream[] {
  const series = row(dotaPageProps(html).seriesPageData);
  if (!sameMatch(series, match)) return [];
  const streams = Array.isArray(series.streams) ? series.streams.slice(0, 24) : [];
  const result = new Map<string, EsportsStream>();
  for (const value of streams) {
    const item = row(value);
    const stream = dotaBroadcastStream(item.url, item.name);
    if (stream) result.set(stream.url, stream);
  }
  return [...result.values()];
}

/** Valve's keyless league endpoint. OpenDota supplies the league id on every professional row. */
export function dotaLeagueDataUrl(leagueId: string): string | null {
  return /^\d{1,10}$/.test(leagueId)
    ? `https://www.dota2.com/webapi/IDOTA2DPC/GetLeagueData/v001/?league_id=${leagueId}`
    : null;
}

/**
 * The broadcast list's key names are not documented, so rows are found by shape: any string under
 * a url shaped key that resolves to an allowlisted channel host. A renamed field costs nothing
 * beyond the links it held, and an unrelated host is still refused by the allowlist.
 */
export function parseDotaLeagueBroadcasts(payload: unknown): EsportsStream[] {
  const found = new Map<string, EsportsStream>();
  const walk = (value: unknown, depth: number) => {
    if (found.size >= 12 || depth > 6) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 64)) walk(item, depth + 1);
      return;
    }
    const node = row(value);
    const label = ["name", "title", "stream_name", "broadcast_provider", "language"]
      .map((key) => text(node[key]).trim())
      .find(Boolean);
    for (const [key, child] of Object.entries(node)) {
      if (typeof child !== "string") {
        walk(child, depth + 1);
        continue;
      }
      if (!/url|link|stream/i.test(key)) continue;
      const stream = dotaBroadcastStream(child, label);
      if (stream) found.set(stream.url, stream);
    }
  };
  walk(payload, 0);
  return [...found.values()];
}

/** Only an OpenDota row carries a Valve league id in event.id; a bo3 row carries its own id. */
export function dotaLeagueId(match: EsportsMatch): string | null {
  const id = text(match.event.id);
  return match.game === "dota2" &&
    match.sourceUrl.startsWith("https://www.opendota.com/matches/") &&
    /^\d{1,10}$/.test(id)
    ? id
    : null;
}

const LEAGUE_TTL = 30 * 60_000;
const leagueCache = new Map<string, { at: number; streams: EsportsStream[] }>();
const leaguePending = new Map<string, Promise<EsportsStream[]>>();

export async function fetchDotaLeagueBroadcasts(
  leagueId: string,
  signal?: AbortSignal,
): Promise<EsportsStream[]> {
  const url = dotaLeagueDataUrl(leagueId);
  if (!url) return [];
  const cached = leagueCache.get(leagueId);
  if (cached && Date.now() - cached.at < LEAGUE_TTL) return cached.streams;
  let task = leaguePending.get(leagueId);
  if (!task) {
    task = (async () => {
      const streams = parseDotaLeagueBroadcasts(await requestEsportsJson(url, LEAGUE_TTL));
      leagueCache.set(leagueId, { at: Date.now(), streams });
      if (leagueCache.size > 32) leagueCache.delete(leagueCache.keys().next().value!);
      return streams;
    })().finally(() => leaguePending.delete(leagueId));
    leaguePending.set(leagueId, task);
  }
  const streams = await task;
  signal?.throwIfAborted();
  return streams;
}

/**
 * Official league broadcasts, so a live card has somewhere to watch. Best effort by design: one
 * request per distinct league, never per match, and a failure leaves the board exactly as it was.
 */
export async function attachDotaLeagueBroadcasts(
  matches: EsportsMatch[],
  limit = 4,
): Promise<EsportsMatch[]> {
  const pendingIds = [
    ...new Set(
      matches
        .filter((match) => match.state !== "recent" && !match.streams.length)
        .flatMap((match) => {
          const id = dotaLeagueId(match);
          return id ? [id] : [];
        }),
    ),
  ].slice(0, limit);
  if (!pendingIds.length) return matches;
  const loaded = new Map<string, EsportsStream[]>();
  await Promise.all(
    pendingIds.map(async (id) => {
      const streams = await fetchDotaLeagueBroadcasts(id).catch(() => []);
      if (streams.length) loaded.set(id, streams);
    }),
  );
  if (!loaded.size) return matches;
  return matches.map((match) => {
    const id = match.streams.length ? null : dotaLeagueId(match);
    const streams = id ? loaded.get(id) : undefined;
    return streams ? { ...match, streams } : match;
  });
}

const pending = new Map<string, Promise<EsportsStream[]>>();
export async function fetchDotaBroadcasts(
  match: EsportsMatch,
  signal?: AbortSignal,
): Promise<EsportsStream[]> {
  signal?.throwIfAborted();
  if (match.game !== "dota2") return [];
  const leagueId = dotaLeagueId(match);
  if (leagueId) {
    const official = await fetchDotaLeagueBroadcasts(leagueId, signal).catch(() => []);
    if (official.length) return official;
  }
  // The community listing stays behind it: Valve answers per league, this answers per series.
  const key = `${match.id}:${match.startMs}:${match.teams.map((team) => team.name).join("|")}`;
  let task = pending.get(key);
  if (!task) {
    task = (async () => {
      const listing = await requestEsportsText("https://hawk.live/", 60_000);
      const url = dotaBroadcastMatchUrl(listing, match);
      if (!url) return [];
      return parseDotaBroadcasts(await requestEsportsText(url, 60_000), match);
    })().finally(() => pending.delete(key));
    pending.set(key, task);
  }
  const streams = await task;
  signal?.throwIfAborted();
  return streams;
}
