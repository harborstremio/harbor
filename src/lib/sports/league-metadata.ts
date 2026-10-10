import type { LeagueDef } from "./espn-types";
import type { SportsTeam } from "./favourites";
import { parseCatalogTeams } from "./team-catalog";
import { parseStandingsTable, type StandingsTable } from "./standings";
import { publicCompetitionUrl } from "./competition-metadata";
import { espnPublishedAthleteId, type AthleteIdentityRequest } from "./athlete-identity";
import { publishedPortraitUrl } from "./athlete-portraits";

export type LeagueMetadataTeam = SportsTeam & {
  location?: string;
  country?: string;
  description?: string;
  venue?: {
    name: string;
    location?: string;
    image?: string;
    capacity?: number;
  };
  website?: string;
  sourceUrl?: string;
  banner?: string;
  founded?: number;
};

export type LeagueMetadata = {
  key: string;
  tag: string;
  name: string;
  sport: string;
  provider: "espn" | "thesportsdb" | "catalog";
  logo?: string;
  banner?: string;
  description?: string;
  country?: string;
  season?: string;
  website?: string;
  sourceUrl?: string;
  founded?: number;
  teams: LeagueMetadataTeam[];
  /** Published standings/scoreboard participants, not a claim of a complete league roster. */
  athletes?: AthleteIdentityRequest[];
  standings: StandingsTable | null;
  fetchedAt: number;
  partial: boolean;
  /** The public provider may cap roster/table entries; this is separate from a failed refresh. */
  limited?: boolean;
};

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
const list = (value: unknown): Raw[] =>
  Array.isArray(value) ? value.slice(0, 2000).map(obj) : [];
const text = (value: unknown, max = 500): string =>
  typeof value === "string"
    ? value.trim().slice(0, max)
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
const number = (value: unknown): number | undefined => {
  if (value == null || text(value) === "") return;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
};
const url = (value: unknown): string | undefined => {
  const source = text(value, 2000);
  return publicCompetitionUrl(
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/|$)/i.test(source) ? `https://${source}` : source,
  );
};
const ESPN_SITE = "https://site.web.api.espn.com/apis/site/v2/sports";
const ESPN_STANDINGS = "https://site.web.api.espn.com/apis/v2/sports";
const DB = "https://www.thesportsdb.com/api/v1/json/123";
const providerFor = (def: LeagueDef): LeagueMetadata["provider"] =>
  /^\d+$/.test(def.path)
    ? "thesportsdb"
    : /^[a-z-]+\/[a-z0-9._-]+$/.test(def.path)
      ? "espn"
      : "catalog";
const cacheKey = (def: LeagueDef) => `${def.key}:${def.path}`;

export function leagueMetadataSeed(def: LeagueDef): LeagueMetadata {
  return {
    key: def.key,
    tag: def.tag,
    name: def.labelEn || def.label,
    sport: def.group,
    provider: providerFor(def),
    logo: url(def.logo),
    website: url(obj(def).officialWebsite),
    teams: [],
    standings: null,
    fetchedAt: 0,
    partial: false,
  };
}

function link(value: unknown, relation: string): string | undefined {
  return list(value)
    .filter((item) => Array.isArray(item.rel) && item.rel.includes(relation))
    .map((item) => url(item.href))
    .find(Boolean);
}
function image(value: unknown): string | undefined {
  const logos = list(value);
  return (
    url(logos.find((item) => Array.isArray(item.rel) && item.rel.includes("default"))?.href) ||
    url(logos[0]?.href)
  );
}
const seasonName = (value: unknown) => text(obj(value).displayName) || text(obj(value).year);

function espnLeague(data: unknown, def: LeagueDef): Raw | undefined {
  const root = obj(data);
  const leagues = [
    ...list(root.leagues),
    ...list(root.sports).flatMap((sport) => list(sport.leagues)),
  ];
  return leagues.find(
    (league) => text(league.slug).toLowerCase() === def.path.split("/")[1].toLowerCase(),
  );
}

function espnTeamDetails(root: Raw): Map<string, Raw> {
  const found = new Map<string, Raw>();
  const visit = (data: Raw, depth = 0) => {
    if (depth > 8) return;
    for (const row of [...list(data.teams), ...list(obj(data.standings).entries)]) {
      const team = row.team ? obj(row.team) : row;
      if (text(team.id) && !found.has(text(team.id)) && found.size < 2000)
        found.set(text(team.id), team);
    }
    for (const child of list(data.children)) visit(child, depth + 1);
  };
  visit(root);
  return found;
}

/** Only matching league envelopes are accepted; team/league identifiers remain provider scoped. */
export function parseEspnLeagueMetadata(
  def: LeagueDef,
  infoData: unknown,
  teamData: unknown,
  tableData: unknown,
): LeagueMetadata {
  const result = leagueMetadataSeed(def);
  const info = espnLeague(infoData, def);
  const catalogCandidate = espnLeague(teamData, def);
  const catalogMismatch =
    !!text(info?.id) &&
    !!text(catalogCandidate?.id) &&
    text(info?.id) !== text(catalogCandidate?.id);
  const catalog = catalogMismatch ? undefined : catalogCandidate;
  const leagueId = text(info?.id) || text(catalog?.id);
  let rawTable = obj(tableData);
  const tableLeagueId = /(?:^|~)l:(\d+)(?:~|$)/.exec(text(rawTable.uid))?.[1];
  if (leagueId && tableLeagueId && leagueId !== tableLeagueId) rawTable = {};
  result.standings = parseStandingsTable(rawTable, def);
  // In September the team directory may still describe last season while the standings and scoreboard have rolled over.
  result.season =
    result.standings?.season ||
    seasonName(info?.season) ||
    seasonName(catalog?.season) ||
    undefined;
  result.name =
    text(info?.name) || text(catalog?.name) || result.standings?.leagueName || result.name;
  result.logo = image(info?.logos) || image(catalog?.logos) || result.logo;
  result.description = text(info?.description, 6000) || undefined;
  result.country = text(obj(info?.country).name) || undefined;
  result.sourceUrl =
    link(info?.links, "standings") ||
    link(info?.links, "index") ||
    link(rawTable.links, "standings");
  // ESPN clubhouse URLs are provider profiles, not official team/competition websites.
  result.website = url(info?.officialWebsite) || result.website;
  const catalogRoot = catalog ?? {};
  const details = new Map([...espnTeamDetails(rawTable), ...espnTeamDetails(catalogRoot)]);
  const teams = new Map<string, SportsTeam>();
  for (const team of [
    ...parseCatalogTeams(rawTable, def),
    ...parseCatalogTeams(catalogRoot, def),
  ])
    teams.set(team.id, team);
  result.teams = [...teams.values()]
    .map((team) => {
      const raw = details.get(team.id) ?? {};
      const venue = obj(raw.venue);
      const address = obj(venue.address);
      return {
        ...team,
        logo: url(team.logo) || "",
        location: text(raw.location) || undefined,
        country: text(obj(raw.country).name) || undefined,
        description: text(raw.description, 2000) || undefined,
        website: url(raw.officialWebsite),
        sourceUrl: link(raw.links, "clubhouse"),
        venue: text(venue.fullName)
          ? {
              name: text(venue.fullName),
              location:
                [address.city, address.state, address.country]
                  .map((value) => text(value))
                  .filter(Boolean)
                  .join(", ") || undefined,
              capacity: number(venue.capacity),
              image: url(venue.image),
            }
          : undefined,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const athletes = new Map<string, AthleteIdentityRequest>();
  for (const row of result.standings?.groups.flatMap((group) => group.rows) ?? []) {
    if (row.athlete) athletes.set(row.athlete.id || row.name, row.athlete);
  }
  // Reuse the already-fetched scoreboard; no roster-wide photo or profile fetch here.
  if (info)
    for (const event of list(obj(infoData).events)) {
      for (const competition of list(event.competitions)) {
        for (const entry of list(competition.competitors)) {
          if (entry.type !== "athlete") continue;
          const entryLeague = /(?:^|~)l:(\d+)(?:~|$)/.exec(text(entry.uid))?.[1];
          if (entryLeague && leagueId && entryLeague !== leagueId) continue;
          const person = obj(entry.athlete);
          const name = text(person.displayName) || text(person.fullName);
          if (!name) continue;
          const id = espnPublishedAthleteId(entry);
          if (!athletes.has(id || name))
            athletes.set(id || name, {
              id,
              name,
              source: "espn",
              image:
                publishedPortraitUrl(obj(person.headshot).href || person.headshot) || undefined,
            });
        }
      }
    }
  result.athletes = [...athletes.values()]
    .slice(0, 2000)
    .sort((a, b) => a.name.localeCompare(b.name));
  result.partial =
    (!!Object.keys(obj(infoData)).length && !info) ||
    (!!Object.keys(obj(teamData)).length && !catalog) ||
    (!!tableLeagueId && !!leagueId && tableLeagueId !== leagueId);
  return result;
}

const DB_STATS = [
  ["intPlayed", "gamesPlayed", "Played", "P"],
  ["intWin", "wins", "Wins", "W"],
  ["intDraw", "ties", "Draws", "D"],
  ["intLoss", "losses", "Losses", "L"],
  ["intGoalsFor", "pointsFor", "For", "F"],
  ["intGoalsAgainst", "pointsAgainst", "Against", "A"],
  ["intGoalDifference", "pointDifferential", "Difference", "DIFF"],
  ["intPoints", "points", "Points", "PTS"],
] as const;

export function parseSportsDbLeagueMetadata(
  def: LeagueDef,
  leagueData: unknown,
  teamData: unknown,
  tableData: unknown,
): LeagueMetadata {
  const result = leagueMetadataSeed(def);
  result.limited = true;
  const league = list(obj(leagueData).leagues).find((item) => text(item.idLeague) === def.path);
  if (league) {
    result.name = text(league.strLeague) || result.name;
    result.description = text(league.strDescriptionEN, 6000) || undefined;
    result.country = text(league.strCountry) || undefined;
    result.season = text(league.strCurrentSeason) || undefined;
    result.website = url(league.strWebsite) || result.website;
    result.sourceUrl = `https://www.thesportsdb.com/league/${def.path}`;
    result.logo = url(league.strBadge) || url(league.strLogo) || result.logo;
    result.banner = url(league.strFanart1) || url(league.strBanner);
    result.founded = number(league.intFormedYear);
  }
  const membershipKeys = [
    "idLeague",
    "idLeague2",
    "idLeague3",
    "idLeague4",
    "idLeague5",
    "idLeague6",
    "idLeague7",
  ];
  const rawTeams = list(obj(teamData).teams);
  const teams = new Map<string, LeagueMetadataTeam>();
  for (const item of rawTeams) {
    if (
      !membershipKeys.some((key) => text(item[key]) === def.path) ||
      !/^\d+$/.test(text(item.idTeam)) ||
      !text(item.strTeam)
    )
      continue;
    const team: LeagueMetadataTeam = {
      id: text(item.idTeam),
      name: text(item.strTeam),
      shortName: text(item.strTeamShort) || text(item.strTeam),
      abbr: text(item.strTeamShort),
      leagueKey: def.key,
      group: def.group,
      logo: url(item.strBadge) || url(item.strTeamBadge) || "",
      location: text(item.strLocation) || undefined,
      country: text(item.strCountry) || undefined,
      description: text(item.strDescriptionEN, 2000) || undefined,
      website: url(item.strWebsite),
      sourceUrl: `https://www.thesportsdb.com/team/${text(item.idTeam)}`,
      banner: url(item.strFanart1) || url(item.strBanner),
      founded: number(item.intFormedYear),
      venue: text(item.strStadium)
        ? {
            name: text(item.strStadium),
            location: text(item.strStadiumLocation) || undefined,
            image: url(item.strStadiumThumb),
            capacity: number(item.intStadiumCapacity),
          }
        : undefined,
    };
    teams.set(team.id, team);
  }
  const tableRows = list(obj(tableData).table).filter(
    (item) =>
      text(item.idLeague) === def.path &&
      !!result.season &&
      text(item.strSeason) === result.season &&
      /^\d+$/.test(text(item.idTeam)) &&
      text(item.strTeam),
  );
  const groups = new Map<string, Raw[]>();
  for (const row of tableRows) {
    const id = text(row.idTeam);
    const team = teams.get(id) ?? {
      id,
      name: text(row.strTeam),
      shortName: text(row.strTeam),
      abbr: "",
      leagueKey: def.key,
      group: def.group,
      logo: url(row.strBadge) || "",
      sourceUrl: `https://www.thesportsdb.com/team/${id}`,
    };
    teams.set(id, team);
    const stats: Raw[] = DB_STATS.flatMap(([field, name, displayName, abbreviation]) =>
      number(row[field]) === undefined
        ? []
        : [
            {
              name,
              displayName,
              abbreviation,
              value: number(row[field]),
              displayValue: text(row[field]),
            },
          ],
    );
    if (number(row.intRank) !== undefined)
      stats.unshift({
        name: "rank",
        value: number(row.intRank),
        displayValue: text(row.intRank),
      });
    const group = text(row.strGroup) || result.name;
    const entries = groups.get(group) ?? [];
    entries.push({
      team: {
        id,
        displayName: team.name,
        shortDisplayName: team.shortName,
        abbreviation: team.abbr,
        logos: team.logo ? [{ href: team.logo }] : [],
      },
      stats,
      note: { description: text(row.strDescription) },
    });
    groups.set(group, entries);
  }
  result.standings = parseStandingsTable(
    {
      name: result.name,
      season: { displayName: result.season },
      children: [...groups].map(([name, entries]) => ({
        id: name,
        name,
        standings: { entries },
      })),
    },
    def,
  );
  result.teams = [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
  result.partial =
    (list(obj(leagueData).leagues).length > 0 && !league) ||
    rawTeams.some((item) => !membershipKeys.some((key) => text(item[key]) === def.path)) ||
    (list(obj(tableData).table).length > 0 && !tableRows.length);
  return result;
}

type Flight = {
  controller: AbortController;
  promise: Promise<LeagueMetadata>;
  users: number;
};
type Entry = { value: LeagueMetadata; at: number };

/** Three requests per league, three transports in flight, 32 normalized cached overviews. No background fanout. */
export function createLeagueMetadataClient(options: {
  json: (url: string, signal: AbortSignal) => Promise<unknown>;
  now?: () => number;
  timeoutMs?: number;
}) {
  const now = options.now ?? Date.now;
  const cache = new Map<string, Entry>();
  const flights = new Map<string, Flight>();
  const queue: Array<() => void> = [];
  let active = 0;
  function json(target: string, signal: AbortSignal): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let started = false;
      const abort = () => {
        if (started) return;
        const index = queue.indexOf(start);
        if (index >= 0) queue.splice(index, 1);
        signal.removeEventListener("abort", abort);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const start = () => {
        if (signal.aborted) {
          abort();
          return;
        }
        started = true;
        signal.removeEventListener("abort", abort);
        active++;
        let cancel: () => void;
        Promise.race([
          Promise.resolve().then(() => options.json(target, signal)),
          new Promise<never>((_, fail) => {
            cancel = () => fail(new DOMException("Aborted", "AbortError"));
            signal.addEventListener("abort", cancel, { once: true });
          }),
        ])
          .then(resolve, reject)
          .finally(() => {
            signal.removeEventListener("abort", cancel);
            active--;
            queue.shift()?.();
          });
      };
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
      if (active < 3) start();
      else queue.push(start);
    });
  }
  function readLeagueMetadata(def: LeagueDef): LeagueMetadata | null {
    const entry = cache.get(cacheKey(def));
    if (!entry || now() - entry.at > 24 * 3600_000) return null;
    return entry.value;
  }
  async function fetchOverview(def: LeagueDef, signal: AbortSignal): Promise<LeagueMetadata> {
    const provider = providerFor(def);
    if (provider === "catalog") return leagueMetadataSeed(def);
    let failed = false;
    let succeeded = 0;
    const request = async (target: string) => {
      try {
        const data = await json(target, signal);
        succeeded++;
        return data;
      } catch {
        failed = true;
        return {};
      }
    };
    let result: LeagueMetadata;
    if (provider === "espn") {
      const [info, teams, table] = await Promise.all([
        request(`${ESPN_SITE}/${def.path}/scoreboard?limit=1`),
        request(`${ESPN_SITE}/${def.path}/teams?limit=1000`),
        request(`${ESPN_STANDINGS}/${def.path}/standings`),
      ]);
      result = parseEspnLeagueMetadata(def, info, teams, table);
    } else {
      const info = await request(`${DB}/lookupleague.php?id=${def.path}`);
      const seed = parseSportsDbLeagueMetadata(def, info, {}, {});
      const verified = list(obj(info).leagues).find((item) => text(item.idLeague) === def.path);
      // The provider's current season is authoritative. Never synthesize a year or request every past season.
      // lookup_all_teams currently returns an unrelated demo league even for valid numeric IDs.
      const [teams, table] = await Promise.all([
        verified && text(verified.strLeague)
          ? request(
              `${DB}/search_all_teams.php?l=${encodeURIComponent(text(verified.strLeague))}`,
            )
          : Promise.resolve({}),
        seed.season && /^\d{4}(?:[-/]\d{2,4})?$/.test(seed.season)
          ? request(`${DB}/lookuptable.php?l=${def.path}&s=${encodeURIComponent(seed.season)}`)
          : Promise.resolve({}),
      ]);
      result = parseSportsDbLeagueMetadata(def, info, teams, table);
    }
    const previous = readLeagueMetadata(def);
    if (!succeeded && previous) return { ...previous, partial: true };
    if (failed && previous) {
      result.teams = result.teams.length ? result.teams : previous.teams;
      if (!result.athletes?.length && (!result.season || result.season === previous.season))
        result.athletes = previous.athletes;
      if (!result.standings && (!result.season || result.season === previous.standings?.season))
        result.standings = previous.standings;
      for (const field of [
        "banner",
        "description",
        "country",
        "website",
        "sourceUrl",
        "founded",
      ] as const)
        if (result[field] === undefined) Object.assign(result, { [field]: previous[field] });
    }
    return {
      ...result,
      fetchedAt: succeeded ? now() : 0,
      partial: result.partial || failed,
    };
  }
  function loadLeagueMetadata(
    def: LeagueDef,
    signal = new AbortController().signal,
    force = false,
  ): Promise<LeagueMetadata> {
    if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    const key = cacheKey(def);
    const hit = cache.get(key);
    if (!force && hit && now() - hit.at < (hit.value.partial ? 30_000 : 300_000))
      return Promise.resolve(hit.value);
    let flight = flights.get(key);
    if (!flight || flight.controller.signal.aborted) {
      const controller = new AbortController();
      const entry: Flight = {
        controller,
        users: 0,
        promise: Promise.resolve(leagueMetadataSeed(def)),
      };
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
      entry.promise = fetchOverview(def, controller.signal)
        .catch((error) => {
          if (controller.signal.aborted && entry.users > 0)
            return {
              ...(readLeagueMetadata(def) ?? leagueMetadataSeed(def)),
              partial: true,
            };
          throw error;
        })
        .then((value) => {
          if (entry.users > 0) {
            cache.delete(key);
            cache.set(key, { value, at: now() });
            while (cache.size > 32) cache.delete(cache.keys().next().value!);
          }
          return value;
        })
        .finally(() => {
          clearTimeout(timer);
          if (flights.get(key) === entry) flights.delete(key);
        });
      flights.set(key, entry);
      flight = entry;
    }
    const entry = flight;
    entry.users++;
    return new Promise((resolve, reject) => {
      let done = false;
      const release = () => {
        if (done) return false;
        done = true;
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
  return { loadLeagueMetadata, readLeagueMetadata };
}

const client = createLeagueMetadataClient({
  json: async (target, signal) => {
    const { safeFetch } = await import("@/lib/safe-fetch");
    const response = await safeFetch(target, { signal });
    if (!response.ok) throw new Error(`League metadata ${response.status}`);
    return response.json();
  },
});
export const loadLeagueMetadata = client.loadLeagueMetadata;
export const readLeagueMetadata = client.readLeagueMetadata;
