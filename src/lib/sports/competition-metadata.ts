import type { LeagueDef, SportsGame } from "./espn-types";
import { isFinishedStatus } from "./event-status";
import { espnPublishedAthleteId, type AthleteIdentityRequest } from "./athlete-identity";
import { publishedPortraitUrl } from "./athlete-portraits";

type RecordData = Record<string, unknown>;
type JsonLoader = (url: string, signal: AbortSignal) => Promise<RecordData>;
export type CompetitionSession = {
  id: string;
  name: string;
  startMs: number;
  status: string;
};
export type CompetitionEntrant = {
  /** Classification row identity; never an athlete-provider identifier. */
  id: string;
  name: string;
  position?: number;
  result: string;
  team?: string;
  athletes?: AthleteIdentityRequest[];
};

export const isIndividualCompetition = (group: string) =>
  [
    "motorsport",
    "golf",
    "tennis",
    "boxing",
    "combat",
    "cycling",
    "athletics",
    "swimming",
    "winter",
    "snooker",
    "darts",
    "badminton",
    "tabletennis",
  ].includes(group);

const personName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Published reports can be longer; only named provider athlete records make their rows interactive. */
export function mergeCompetitionEntrants(
  published: CompetitionEntrant[],
  structured: CompetitionEntrant[],
): CompetitionEntrant[] {
  if (published.length <= structured.length) return structured;
  const people = structured.flatMap((entry) => entry.athletes ?? []);
  return published.map((entry) => {
    const athletes = entry.name.split(" / ").flatMap((name) => {
      const matches = people.filter((person) => personName(person.name) === personName(name));
      const identities = new Set(matches.map((person) => `${person.source}:${person.id}`));
      return identities.size === 1 ? matches.slice(0, 1) : [];
    });
    return athletes.length ? { ...entry, athletes } : entry;
  });
}
export type CompetitionMetadata = {
  source: "thesportsdb" | "espn" | "schedule";
  sessions: CompetitionSession[];
  entrants: CompetitionEntrant[];
  results: boolean;
  description?: string;
  resultText?: string;
  venue?: { name: string; location?: string; image?: string; website?: string };
  website?: string;
  sourceUrl?: string;
  partial?: boolean;
};

const DB = "https://www.thesportsdb.com/api/v1/json/123";
const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const record = (value: unknown): RecordData =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RecordData) : {};
const rows = (value: unknown): RecordData[] =>
  Array.isArray(value) ? value.slice(0, 200).map(record) : [];
const str = (value: unknown, max = 500): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const numericId = (value: unknown) => {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : str(value);
  return /^\d{1,16}$/.test(text) ? text : "";
};

export function publicCompetitionUrl(value: unknown): string | undefined {
  const text = str(value, 2000);
  if (!text) return;
  try {
    const url = new URL(/^www\./i.test(text) ? `https://${text}` : text);
    if (
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname.includes(".") ||
      /(^[\d.]+$|:|\.local$|\.localhost$)/i.test(url.hostname)
    )
      return;
    url.protocol = "https:";
    return url.href;
  } catch {
    /* Ignore malformed source links. */
  }
}

function artwork(value: unknown): string | undefined {
  const url = publicCompetitionUrl(value);
  if (
    url &&
    ["www.thesportsdb.com", "r2.thesportsdb.com", "thesportsdb.com"].includes(new URL(url).hostname)
  )
    return url;
}

export function competitionSeed(game: SportsGame, def?: LeagueDef): CompetitionMetadata {
  return {
    source: /^\d+$/.test(def?.path ?? "") ? "thesportsdb" : "schedule",
    sessions: [
      {
        id: game.id,
        name: game.context?.name || game.home.name,
        startMs: game.startMs,
        status: game.detail,
      },
    ],
    entrants: [],
    results: false,
    venue: game.context?.venue ? { name: game.context.venue } : undefined,
  };
}

/** A shared finishing position represents a driver pairing, not duplicate results. */
export function parseCompetitionResults(value: unknown, eventId: string): CompetitionEntrant[] {
  const groups = new Map<string, CompetitionEntrant>();
  for (const item of rows(value)) {
    if (str(item.idEvent) !== eventId || !str(item.strPlayer)) continue;
    const position = Number(item.intPosition);
    const placed = Number.isInteger(position) && position > 0;
    const key = placed
      ? `position:${position}`
      : `result:${str(item.idResult) || str(item.idPlayer)}`;
    const name = str(item.strPlayer);
    // Some co-driver records repeat their name in strDetail rather than a race time.
    const detail = str(item.strDetail) === name ? "" : str(item.strDetail);
    const result = detail || str(item.strResult);
    const athlete: AthleteIdentityRequest = {
      id: numericId(item.idPlayer),
      name,
      source: "thesportsdb",
      image:
        publishedPortraitUrl(item.strCutout) || publishedPortraitUrl(item.strThumb) || undefined,
    };
    const prior = groups.get(key);
    if (prior) {
      if (!prior.name.split(" / ").includes(name)) prior.name += ` / ${name}`;
      if (!prior.result) prior.result = result;
      if (!prior.athletes?.some((person) => person.id === athlete.id && person.name === name))
        prior.athletes?.push(athlete);
    } else
      groups.set(key, {
        id: key,
        name,
        position: placed ? position : undefined,
        result,
        athletes: [athlete],
      });
  }
  return [...groups.values()].sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
}

/** Some free event lookups publish the full classification as tab-separated text. */
export function parseCompetitionResultText(value: unknown): CompetitionEntrant[] {
  const parsed = str(value, 12000)
    .split(/\r?\n/)
    .slice(0, 200)
    .flatMap((line) => {
      const columns = line.split(/\t+/).map((column) => column.trim().replace(/^\//, ""));
      if (columns.length < 3 || !/^\d+$/.test(columns[0]) || !columns[1]) return [];
      const position = Number(columns[0]);
      if (position < 1 || position > 200) return [];
      return [
        {
          id: `position:${position}`,
          position,
          name: columns[1]
            .split("/")
            .map((name) => name.trim())
            .filter(Boolean)
            .join(" / "),
          team: columns.length > 3 ? columns[2] : undefined,
          result: columns.at(-1)!,
        },
      ];
    });
  return [...new Map(parsed.map((row) => [row.id, row])).values()].sort(
    (a, b) => a.position - b.position,
  );
}

export function parseDbCompetition(
  game: SportsGame,
  def: LeagueDef,
  event: RecordData,
  venue: RecordData = {},
  league: RecordData = {},
  resultRows: unknown = [],
): CompetitionMetadata {
  const detail = competitionSeed(game, def);
  if (str(event.idEvent) !== game.id || str(event.idLeague) !== def.path) return detail;
  const venueMatches = !!numericId(event.idVenue) && str(venue.idVenue) === str(event.idVenue);
  const venueName =
    str(event.strVenue) || (venueMatches ? str(venue.strVenue) : "") || game.context?.venue;
  const structuredResults = parseCompetitionResults(resultRows, game.id);
  const publishedResults = parseCompetitionResultText(event.strResult);
  // The public structured endpoint can return only five athletes. Do not truncate
  // the full race classification already included in the event's published report.
  const entrants = mergeCompetitionEntrants(publishedResults, structuredResults);
  return {
    ...detail,
    source: "thesportsdb",
    sessions: [
      {
        ...detail.sessions[0],
        name: str(event.strEvent) || detail.sessions[0].name,
        status: str(event.strStatus) || game.detail,
      },
    ],
    entrants,
    results: entrants.length > 0 || !!str(event.strResult),
    resultText: !entrants.length ? str(event.strResult, 12000) || undefined : undefined,
    description: str(event.strDescriptionEN, 5000) || undefined,
    venue: venueName
      ? {
          name: venueName,
          location:
            (venueMatches && str(venue.strLocation)) ||
            [str(event.strCity), str(event.strCountry)].filter(Boolean).join(", ") ||
            undefined,
          image: venueMatches ? artwork(venue.strThumb) : undefined,
          website: venueMatches ? publicCompetitionUrl(venue.strWebsite) : undefined,
        }
      : undefined,
    website:
      str(league.idLeague) === def.path ? publicCompetitionUrl(league.strWebsite) : undefined,
    sourceUrl: `https://www.thesportsdb.com/event/${game.id}`,
  };
}

export function parseEspnCompetition(game: SportsGame, data: RecordData): CompetitionMetadata {
  const eventId = game.context?.id || game.id.split("|")[0];
  const event = rows(data.events).find((item) => str(item.id) === eventId);
  const competitions = rows(event?.competitions);
  if (!competitions.length) return competitionSeed(game);
  const selected =
    competitions.find((item) => str(item.id) === game.id.split("|")[1]) ??
    competitions.find((item) => record(item.type).abbreviation === "Race") ??
    [...competitions].reverse().find((item) => rows(item.competitors).length);
  const competitors = rows(selected?.competitors);
  return {
    source: "espn",
    sessions: competitions.map((item) => ({
      id: str(item.id),
      name:
        str(record(item.type).text) ||
        str(record(item.type).abbreviation) ||
        game.context?.name ||
        "",
      startMs: Date.parse(str(item.date)) || game.startMs,
      status: str(record(record(item.status).type).shortDetail),
    })),
    entrants: competitors
      .flatMap((item) => {
        const athlete = record(item.athlete);
        const name = str(athlete.displayName) || str(record(item.team).displayName);
        if (!name) return [];
        return [
          {
            id: str(item.id),
            name,
            result: str(item.score),
            position: Number(item.order) || undefined,
            ...(str(athlete.displayName) && item.type !== "team"
              ? {
                  athletes: [
                    {
                      id: espnPublishedAthleteId(item),
                      name: str(athlete.displayName),
                      source: "espn" as const,
                      image:
                        publishedPortraitUrl(record(athlete.headshot).href || athlete.headshot) ||
                        undefined,
                    },
                  ],
                }
              : {}),
          },
        ];
      })
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999)),
    results: record(record(selected?.status).type).completed === true,
    venue: game.context?.venue ? { name: game.context.venue } : undefined,
  };
}

function keyFor(game: SportsGame, def: LeagueDef) {
  return `${def.path}:${game.id}:${game.startMs}`;
}
const cache = new Map<string, { value: CompetitionMetadata; expires: number }>();
const resourceCache = new Map<string, { value: RecordData; expires: number }>();
type Flight = {
  controller: AbortController;
  users: number;
  promise: Promise<CompetitionMetadata>;
};
const inflight = new Map<string, Flight>();

function untilAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export function readCompetitionMetadata(
  game: SportsGame,
  def: LeagueDef,
): CompetitionMetadata | undefined {
  return cache.get(keyFor(game, def))?.value;
}

async function cachedResource(
  url: string,
  signal: AbortSignal,
  json: JsonLoader,
): Promise<RecordData> {
  const hit = resourceCache.get(url);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await json(url, signal);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  resourceCache.set(url, { value, expires: Date.now() + 86400_000 });
  if (resourceCache.size > 48) resourceCache.delete(resourceCache.keys().next().value!);
  return value;
}

async function requestMetadata(
  game: SportsGame,
  def: LeagueDef,
  signal: AbortSignal,
  json: JsonLoader,
): Promise<CompetitionMetadata> {
  if (/^\d+$/.test(def.path)) {
    if (!numericId(game.id)) return competitionSeed(game, def);
    const data = await json(`${DB}/lookupevent.php?id=${game.id}`, signal);
    const event = rows(data.events).find(
      (item) => str(item.idEvent) === game.id && str(item.idLeague) === def.path,
    );
    if (!event) return competitionSeed(game, def);
    const venueId = numericId(event.idVenue);
    const finished =
      isFinishedStatus(str(event.strStatus)) || !!str(event.strResult);
    // These supplements are independent; losing a venue request must not erase the race result.
    const supplements = await Promise.allSettled<RecordData>([
      venueId
        ? cachedResource(`${DB}/lookupvenue.php?id=${venueId}`, signal, json)
        : Promise.resolve({}),
      cachedResource(`${DB}/lookupleague.php?id=${def.path}`, signal, json),
      finished ? json(`${DB}/eventresults.php?id=${game.id}`, signal) : Promise.resolve({}),
    ]);
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const [venue, league, results] = supplements.map<RecordData>((item) =>
      item.status === "fulfilled" ? item.value : {},
    );
    return {
      ...parseDbCompetition(
        game,
        def,
        event,
        rows(venue.venues)[0],
        rows(league.leagues)[0],
        results.results,
      ),
      partial: supplements.some((item) => item.status === "rejected"),
    };
  }
  if (!/^(racing|golf)\/[a-z0-9-]+$/.test(def.path)) return competitionSeed(game, def);
  // The day scoreboard contains the whole race weekend / tournament; avoid refetching the entire season.
  const day = new Date(game.startMs).toISOString().slice(0, 10).replaceAll("-", "");
  return parseEspnCompetition(
    game,
    await json(`${ESPN}/${def.path}/scoreboard?dates=${day}&limit=100`, signal),
  );
}

/** Bounded, shared requests. Closing the final consumer aborts its network work. */
export function loadCompetitionMetadata(
  game: SportsGame,
  def: LeagueDef,
  signal: AbortSignal,
  json: JsonLoader,
  force = false,
): Promise<CompetitionMetadata> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  const key = keyFor(game, def);
  const hit = cache.get(key);
  if (!force && hit && hit.expires > Date.now()) return Promise.resolve(hit.value);
  let flight = inflight.get(key);
  if (!flight || flight.controller.signal.aborted) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    flight = {
      controller,
      users: 0,
      promise: Promise.resolve(competitionSeed(game, def)),
    };
    const entry = flight;
    entry.promise = untilAbort(
      requestMetadata(game, def, controller.signal, json),
      controller.signal,
    )
      .then((value) => {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        cache.set(key, {
          value,
          expires: Date.now() + (value.partial ? 30000 : game.state === "in" ? 25000 : 600_000),
        });
        if (cache.size > 32) cache.delete(cache.keys().next().value!);
        return value;
      })
      .finally(() => {
        clearTimeout(timer);
        if (inflight.get(key) === entry) inflight.delete(key);
      });
    inflight.set(key, entry);
  }
  const entry = flight;
  entry.users++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const release = () => {
      if (settled) return false;
      settled = true;
      signal.removeEventListener("abort", abort);
      if (--entry.users === 0) entry.controller.abort();
      return true;
    };
    const abort = () => {
      if (release()) reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    entry.promise.then(
      (value) => {
        if (release()) resolve(value);
      },
      (error) => {
        if (release()) reject(error);
      },
    );
  });
}
