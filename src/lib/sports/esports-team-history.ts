import type { EsportsGameId, EsportsMatch } from "./esports-feeds";

type Raw = Record<string, unknown>;
const object = (value: unknown): Raw =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 300) : "");
const uuid = (value: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const slug = (value: string) => /^[a-z0-9][a-z0-9-]{0,180}$/i.test(value);

export type EsportsTeamHistory = {
  status: "ready" | "unsupported";
  matches: EsportsMatch[];
  sourceName?: string;
  sourceUrl?: string;
};

/** Decode the official page's reference table, including deferred promise chunks.
 * Only JSON is read; remote JavaScript never executes. References remain bounded. */
function blastRows(html: string): Raw[] {
  if (html.length > 8_000_000) throw new Error("Team history response is too large");
  const table: unknown[] = [];
  for (const chunk of html.matchAll(/streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/g)) {
    let entries: unknown;
    try {
      const encoded = JSON.parse(chunk[1]) as string;
      entries = JSON.parse(encoded.replace(/^P\d+:/, ""));
    } catch {
      continue;
    }
    if (!Array.isArray(entries)) continue;
    if (table.length + entries.length > 40_000)
      throw new Error("Team history reference limit exceeded");
    table.push(...entries);
  }
  if (!table.length) throw new Error("Team history format is unavailable");
  let reads = 0;
  const resolve = (reference: unknown, depth = 0): unknown => {
    if (++reads > 180_000) throw new Error("Team history decoding limit exceeded");
    if (
      depth > 12 ||
      !Number.isInteger(reference) ||
      typeof reference !== "number" ||
      reference < 0 ||
      reference >= table.length
    )
      return;
    const value = table[reference];
    if (Array.isArray(value)) {
      // React Router serializes Dates with an inline timestamp, not a reference.
      if (value[0] === "D" && typeof value[1] === "number") return value[1];
      return value.slice(0, 300).map((item) => resolve(item, depth + 1));
    }
    if (value && typeof value === "object") {
      const result: Raw = Object.create(null);
      for (const [key, child] of Object.entries(value).slice(0, 80)) {
        const name = /^_\d+$/.test(key) ? table[Number(key.slice(1))] : undefined;
        if (typeof name === "string" && !["__proto__", "constructor", "prototype"].includes(name))
          result[name] = resolve(child, depth + 1);
      }
      return result;
    }
    return value;
  };
  const selected: Raw[] = [];
  for (let i = 0; i < table.length; i++) {
    const value = object(table[i]);
    const keys = Object.keys(value).map((key) =>
      /^_\d+$/.test(key) ? table[Number(key.slice(1))] : undefined,
    );
    if (
      (keys.includes("teamA") && keys.includes("teamB") && keys.includes("result")) ||
      (keys.includes("gameId") && keys.includes("id"))
    )
      selected.push(object(resolve(i)));
  }
  return selected;
}

export function parseBlastTeamHistory(
  html: string,
  teamId: string,
  now = Date.now(),
): EsportsMatch[] {
  if (!uuid(teamId)) throw new Error("Invalid team identity");
  const rows = blastRows(html);
  if (!rows.some((row) => row.id === teamId && row.gameId === "rl"))
    throw new Error("Team history identity does not match");
  const matches = new Map<string, EsportsMatch>();
  for (const row of rows) {
    if (!["W", "L"].includes(text(row.result))) continue;
    const a = object(row.teamA),
      b = object(row.teamB),
      tournament = object(row.tournament);
    if (a.id !== teamId && b.id !== teamId) continue;
    const id = text(row.id),
      eventId = text(tournament.id);
    const startMs =
      typeof row.scheduledAt === "number" ? row.scheduledAt : Date.parse(text(row.scheduledAt));
    const scoreA = row.teamAScore,
      scoreB = row.teamBScore;
    if (
      !uuid(id) ||
      !slug(eventId) ||
      !text(tournament.name) ||
      !Number.isFinite(startMs) ||
      startMs <= 0 ||
      startMs > now ||
      !Number.isInteger(scoreA) ||
      !Number.isInteger(scoreB) ||
      Number(scoreA) < 0 ||
      Number(scoreB) < 0 ||
      scoreA === scoreB
    )
      continue;
    const teams = [a, b].map((team, index) => ({
      id: text(team.id),
      name: text(team.name),
      code: text(team.shortName),
      logo: `https://assets.blast.tv/images/teams/${text(team.id)}?width=128&format=auto`,
      score: Number(index === 0 ? scoreA : scoreB),
      winner: index === 0 ? Number(scoreA) > Number(scoreB) : Number(scoreB) > Number(scoreA),
    })) as EsportsMatch["teams"];
    if (teams.some((team) => !uuid(team.id) || !team.name) || teams[0].id === teams[1].id) continue;
    const names = teams.every((team) => slug(team.code || ""))
      ? `/${teams.map((team) => team.code).join("-")}`
      : "";
    matches.set(id, {
      id,
      game: "rocketleague",
      state: "recent",
      startMs,
      event: {
        id: eventId,
        name: text(tournament.name),
        stage: text(object(row.stage).name) || undefined,
        logo: `https://assets.blast.tv/images/tournament/${eventId}?width=128&format=auto`,
      },
      teams,
      streams: [],
      bestOf: /^BO[1-9]$/.test(text(row.type)) ? Number(text(row.type).slice(2)) : undefined,
      sourceUrl: `https://blast.tv/rl/tournaments/${eventId}/series/${id.slice(0, 8)}${names}`,
    });
  }
  return [...matches.values()].sort((a, b) => b.startMs - a.startMs).slice(0, 24);
}

/** History never replaces current/live records or leaks another game's squad. */
export function mergeEsportsTeamHistory(
  game: string,
  teamId: string,
  current: EsportsMatch[],
  history: EsportsMatch[],
): EsportsMatch[] {
  const merged = new Map<string, EsportsMatch>();
  for (const match of [...history, ...current])
    if (match.game === game && match.teams.some((team) => team.id === teamId))
      merged.set(match.id, match);
  const order = { live: 0, upcoming: 1, recent: 2 };
  return [...merged.values()].sort(
    (a, b) =>
      order[a.state] - order[b.state] ||
      (a.state === "recent" ? b.startMs - a.startMs : a.startMs - b.startMs),
  );
}

const cache = new Map<string, { at: number; value: EsportsTeamHistory }>();
export async function fetchEsportsTeamHistory(
  game: EsportsGameId | string,
  teamId: string,
  signal: AbortSignal,
  force = false,
): Promise<EsportsTeamHistory> {
  if (game !== "rocketleague" || !uuid(teamId)) return { status: "unsupported", matches: [] };
  signal.throwIfAborted();
  const key = `${game}:${teamId}`,
    saved = cache.get(key);
  if (!force && saved && Date.now() - saved.at < 5 * 60_000) return saved.value;
  const sourceUrl = `https://blast.tv/rl/team/${teamId.slice(0, 8)}`;
  const controller = new AbortController(),
    abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 10_000);
  try {
    const { safeFetch } = await import("../safe-fetch");
    const response = await safeFetch(sourceUrl, { signal: controller.signal });
    if (!response.ok || Number(response.headers.get("content-length")) > 8_000_000)
      throw new Error("Team history is unavailable");
    const html = await response.text();
    controller.signal.throwIfAborted();
    const value: EsportsTeamHistory = {
      status: "ready",
      matches: parseBlastTeamHistory(html, teamId),
      sourceName: "BLAST.tv",
      sourceUrl,
    };
    cache.set(key, { at: Date.now(), value });
    while (cache.size > 40) cache.delete(cache.keys().next().value!);
    return value;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
