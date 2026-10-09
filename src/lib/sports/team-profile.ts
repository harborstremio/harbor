import type { LeagueDef } from "./espn-types";

export type TeamIdentity = {
  id: string;
  name: string;
  logo?: string;
  league: string;
  source?: string;
};
export type TeamProfilePlayer = {
  id: string;
  name: string;
  image?: string;
  position?: string;
  jersey?: string;
  profileUrl?: string;
  source: "espn" | "thesportsdb";
};
export type TeamProfileData = {
  identity: TeamIdentity;
  name: string;
  logo?: string;
  description?: string;
  facts: { label: string; value: string }[];
  roster: TeamProfilePlayer[];
  rosterLimited?: boolean;
  honors: { title: string; season?: string; detail?: string; sourceUrl?: string }[];
  statistics: { label: string; value: string }[];
  events: {
    id: string;
    name: string;
    date?: string;
    status?: string;
    score?: string;
    sourceUrl?: string;
  }[];
  links: { label: string; url: string }[];
  sourceUrls: string[];
  fetchedAt: number;
  partial: boolean;
};
type Row = Record<string, unknown>;
type League = Pick<LeagueDef, "key" | "tag" | "path" | "group" | "labelEn">;
const obj = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.slice(0, 500).map(obj) : []);
const text = (v: unknown, max = 500): string =>
  typeof v === "string"
    ? v.trim().slice(0, max)
    : typeof v === "number" && Number.isFinite(v)
      ? String(v)
      : "";
const publicUrl = (v: unknown): string | undefined => {
  let value = text(v, 2000);
  if (/^[\w-]+(?:\.[\w-]+)+(?:\/|$)/i.test(value)) value = `https://${value}`;
  try {
    const u = new URL(value);
    if (
      ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      !u.port &&
      u.hostname.includes(".") &&
      !/(^[\d.]+$|:|\.local$|\.localhost$)/i.test(u.hostname)
    )
      return u.href;
  } catch {
    /* Missing provider URL. */
  }
};
const normalize = (v: unknown) =>
  text(v)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const sports: Record<string, string[]> = {
  soccer: ["soccer", "football"],
  football: ["americanfootball"],
  basketball: ["basketball"],
  baseball: ["baseball"],
  hockey: ["icehockey"],
  rugby: ["rugby", "rugbyleague", "rugbyunion"],
  cricket: ["cricket"],
  aussie: ["australianfootball", "australianrulesfootball", "aussierules"],
  afl: ["australianfootball", "australianrulesfootball", "aussierules"],
  aussierules: ["australianfootball", "australianrulesfootball", "aussierules"],
  fieldhockey: ["fieldhockey"],
  softball: ["softball"],
  volleyball: ["volleyball"],
  handball: ["handball"],
  lacrosse: ["lacrosse"],
  motorsport: ["motorsport"],
  esports: ["esports"],
};
const SOCCER_COUNTRIES: Record<string, string[]> = {
  eng: ["England"],
  esp: ["Spain"],
  ger: ["Germany"],
  ita: ["Italy"],
  fra: ["France"],
  ksa: ["Saudi Arabia"],
  ned: ["Netherlands"],
  por: ["Portugal"],
  sco: ["Scotland"],
  bel: ["Belgium"],
  tur: ["Turkey"],
  usa: ["United States", "Canada"],
  mex: ["Mexico"],
  bra: ["Brazil"],
  arg: ["Argentina"],
  jpn: ["Japan"],
  kor: ["South Korea"],
  aus: ["Australia", "New Zealand"],
  uae: ["United Arab Emirates"],
  qat: ["Qatar"],
  egy: ["Egypt"],
  ind: ["India"],
  chn: ["China"],
  rus: ["Russia"],
  gre: ["Greece"],
  sui: ["Switzerland"],
  aut: ["Austria"],
  den: ["Denmark"],
  swe: ["Sweden"],
  nor: ["Norway"],
  pol: ["Poland"],
  irl: ["Ireland"],
};
const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const DB = "https://www.thesportsdb.com/api/v1/json/123";
export function teamProfileSeed(identity: TeamIdentity): TeamProfileData {
  return {
    identity,
    name: identity.name,
    logo: publicUrl(identity.logo),
    facts: [],
    roster: [],
    honors: [],
    statistics: [],
    events: [],
    links: [],
    sourceUrls: [],
    fetchedAt: 0,
    partial: false,
  };
}

/** Name AND sport must agree. IDs from different providers are never interchangeable. */
export function matchSportsDbTeam(
  data: unknown,
  identity: TeamIdentity,
  league: League,
): Row | undefined {
  const candidates = rows(obj(data).teams).filter((team) => {
    if (!(sports[league.group] ?? [normalize(league.group)]).includes(normalize(team.strSport)))
      return false;
    const names = [
      team.strTeam,
      ...text(team.strTeamAlternate).split(/[,;|]/),
      ...text(team.strAlternate).split(/[,;|]/),
    ];
    if (!names.some((name) => normalize(name) === normalize(identity.name))) return false;
    const databaseIdentity =
      /thesportsdb/i.test(identity.source ?? "") || (!identity.source && /^\d+$/.test(league.path));
    if (databaseIdentity) {
      if (text(team.idTeam) !== identity.id) return false;
      if (
        /^\d+$/.test(league.path) &&
        !Array.from({ length: 7 }, (_, i) => text(team[`idLeague${i ? i + 1 : ""}`])).includes(
          league.path,
        )
      )
        return false;
    }
    {
      const memberships = Array.from({ length: 7 }, (_, i) => ({
        id: text(team[`idLeague${i ? i + 1 : ""}`]),
        name: normalize(team[`strLeague${i ? i + 1 : ""}`]),
      }));
      const providerIdMatches =
        !databaseIdentity && identity.source !== "esports" && text(team.idESPN) === identity.id;
      const leagueNames = [normalize(league.labelEn), normalize(league.tag)].filter(Boolean);
      const membership = memberships.some((item) =>
        /^\d+$/.test(league.path)
          ? item.id === league.path
          : leagueNames.some(
              (name) => item.name === name || (name.length > 5 && item.name.endsWith(name)),
            ),
      );
      const countryKey = league.path.startsWith("soccer/")
        ? league.path.split("/")[1].split(".")[0]
        : "";
      const countries = SOCCER_COUNTRIES[countryKey];
      if (countries && !countries.map(normalize).includes(normalize(team.strCountry))) return false;
      if (!databaseIdentity && !providerIdMatches && !membership) return false;
    }
    return /^\d+$/.test(text(team.idTeam));
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}
/** Before a season opens every ESPN record reads 0-0 and standingSummary is an arbitrary tiebreak
 *  between teams that have all played nothing, so publishing them is rows of noise that read as
 *  broken data rather than as "no games yet". */
const blankRecord = (summary: string): boolean => /^0(?:\s*-\s*0)+$/.test(summary.trim());

const addFact = (profile: TeamProfileData, label: string, value: unknown) => {
  const result = text(value);
  if (result && !profile.facts.some((f) => f.label === label))
    profile.facts.push({ label, value: result });
};
const addLink = (profile: TeamProfileData, label: string, value: unknown) => {
  const url = publicUrl(value);
  if (url && !profile.links.some((link) => link.url === url)) profile.links.push({ label, url });
};

export function parseEspnTeamProfile(
  data: unknown,
  identity: TeamIdentity,
): TeamProfileData | null {
  const team = obj(obj(data).team);
  if (text(team.id) !== identity.id || !text(team.displayName)) return null;
  const p = teamProfileSeed(identity);
  p.name = text(team.displayName);
  p.logo = publicUrl(rows(team.logos)[0]?.href) ?? p.logo;
  addFact(p, "Location", team.location);
  const records = rows(obj(team.record).items);
  const played = records.some((record) => {
    const summary = text(record.summary);
    return summary.length > 0 && !blankRecord(summary);
  });
  if (played) addFact(p, "Standing", team.standingSummary);
  const venue = obj(obj(team.franchise).venue ?? team.venue);
  addFact(p, "Venue", venue.fullName);
  addFact(p, "Capacity", venue.capacity);
  for (const record of records) {
    const summary = text(record.summary);
    if (summary && !blankRecord(summary))
      addFact(p, text(record.description) || text(record.name) || "Record", summary);
    if (text(record.type) === "total" || text(record.name).toLowerCase().includes("overall")) {
      p.statistics = rows(record.stats)
        .map((stat) => ({
          label: text(stat.displayName) || text(stat.name),
          value: text(stat.displayValue) || text(stat.value),
        }))
        .filter((stat) => stat.label && stat.value);
    }
  }
  for (const link of rows(team.links)) addLink(p, text(link.text) || "ESPN", link.href);
  p.sourceUrls = p.links
    .filter((link) => new URL(link.url).hostname.endsWith("espn.com"))
    .slice(0, 1)
    .map((link) => link.url);
  return p;
}
export function parseEspnTeamRoster(data: unknown): TeamProfilePlayer[] {
  const output = new Map<string, TeamProfilePlayer>();
  for (const group of rows(obj(data).athletes)) {
    for (const item of Array.isArray(group.items) ? rows(group.items) : [group]) {
      const athlete = item.athlete ? obj(item.athlete) : item;
      const id = text(athlete.id),
        name = text(athlete.displayName) || text(athlete.fullName);
      if (!/^\d+$/.test(id) || !name || output.size >= 160) continue;
      output.set(id, {
        id,
        name,
        image: publicUrl(obj(athlete.headshot).href),
        position:
          text(obj(athlete.position).abbreviation) || text(obj(athlete.position).displayName),
        jersey: text(athlete.jersey),
        profileUrl: rows(athlete.links)
          .map((link) => publicUrl(link.href))
          .find(Boolean),
        source: "espn",
      });
    }
  }
  return [...output.values()];
}
export function parseEspnTeamStats(data: unknown): TeamProfileData["statistics"] {
  const root = obj(data),
    stats = obj(obj(root.results).stats ?? root.statistics ?? root.stats);
  return rows(stats.categories)
    .flatMap((category) =>
      rows(category.stats)
        .map((stat) => ({
          label: `${text(category.displayName) || text(category.name)} · ${text(stat.displayName) || text(stat.name)}`,
          value: text(stat.displayValue) || text(stat.value),
        }))
        .filter((stat) => stat.value),
    )
    .slice(0, 240);
}
export function parseEspnTeamEvents(data: unknown, teamId: string): TeamProfileData["events"] {
  return rows(obj(data).events)
    .filter((event) =>
      rows(event.competitions).some((c) =>
        rows(c.competitors).some((side) => text(obj(side.team).id) === teamId),
      ),
    )
    .slice(-100)
    .map((event) => {
      const competition = rows(event.competitions)[0] ?? {},
        sides = rows(competition.competitors);
      const values = sides.map((side) => text(obj(side.score).displayValue) || text(side.score));
      return {
        id: text(event.id),
        name: text(event.name),
        date: text(event.date),
        status: text(obj(obj(competition.status ?? event.status).type).description),
        score: values.length === 2 && values.every(Boolean) ? values.join(" – ") : undefined,
        sourceUrl: rows(event.links)
          .map((link) => publicUrl(link.href))
          .find(Boolean),
      };
    })
    .filter((event) => event.id && event.name);
}
export function enrichSportsDbTeam(profile: TeamProfileData, team: Row): void {
  const id = text(team.idTeam),
    sourceUrl = `https://www.thesportsdb.com/team/${id}`;
  profile.logo ??= publicUrl(team.strBadge ?? team.strTeamBadge);
  profile.description = text(team.strDescriptionEN, 18000) || undefined;
  for (const [label, key] of [
    ["Country", "strCountry"],
    ["Location", "strLocation"],
    ["Venue", "strStadium"],
    ["Capacity", "intStadiumCapacity"],
    ["League", "strLeague"],
    ["Division", "strDivision"],
  ])
    addFact(profile, label, team[key]);
  const claimedYear = text(team.intFormedYear);
  const establishmentYears = [
    ...(profile.description ?? "").matchAll(
      /\b(?:In (1[6-9]\d{2}|20\d{2}),[^.!?\n]{0,75}\b(?:founded|formed)|(?:founded|formed|established) (?:in |on [^.!?\n]{0,20} )?(1[6-9]\d{2}|20\d{2}))\b/gi,
    ),
  ].map((match) => match[1] || match[2]);
  if (!establishmentYears.some((year) => year !== claimedYear))
    addFact(profile, "Founded", claimedYear);
  for (const [label, key] of [
    ["Official website", "strWebsite"],
    ["Facebook", "strFacebook"],
    ["Instagram", "strInstagram"],
    ["X", "strTwitter"],
    ["YouTube", "strYoutube"],
  ])
    addLink(profile, label, team[key]);
  profile.sourceUrls.push(sourceUrl);
  // The public honours endpoint is player-only. Preserve attributed team biography excerpts instead of inventing trophy records.
  const paragraphs = (profile.description ?? "")
    .split(/\r?\n\s*\r?\n/)
    .filter(
      (paragraph) =>
        /\b(championships?|titles?|troph(?:y|ies)|honou?rs?|awards?)\b/i.test(paragraph) &&
        /\b(won|win(?:ners?|ning|s)?|champions|titles|awarded)\b/i.test(paragraph),
    );
  profile.honors = paragraphs
    .slice(0, 5)
    .map((detail) => ({ title: "Team history", detail: detail.slice(0, 4000), sourceUrl }));
}
export function parseSportsDbRoster(data: unknown, teamId: string): TeamProfilePlayer[] {
  return rows(obj(data).player ?? obj(data).players)
    .filter(
      (player) =>
        text(player.idTeam) === teamId &&
        /^\d+$/.test(text(player.idPlayer)) &&
        text(player.strPlayer),
    )
    .slice(0, 160)
    .map((player) => ({
      id: text(player.idPlayer),
      name: text(player.strPlayer),
      image: publicUrl(player.strCutout) ?? publicUrl(player.strThumb),
      position: text(player.strPosition),
      jersey: text(player.strNumber),
      profileUrl: `https://www.thesportsdb.com/player/${text(player.idPlayer)}`,
      source: "thesportsdb",
    }));
}
export function parseSportsDbTeamEvents(data: unknown, teamId: string): TeamProfileData["events"] {
  return rows(obj(data).events ?? obj(data).results)
    .filter((event) => [text(event.idHomeTeam), text(event.idAwayTeam)].includes(teamId))
    .map((event) => ({
      id: text(event.idEvent),
      name: text(event.strEvent),
      date: text(event.strTimestamp) || text(event.dateEvent),
      status: text(event.strStatus),
      score:
        event.intHomeScore != null && event.intAwayScore != null
          ? `${text(event.intHomeScore)} – ${text(event.intAwayScore)}`
          : undefined,
      sourceUrl: `https://www.thesportsdb.com/event/${text(event.idEvent)}`,
    }))
    .filter((event) => event.id && event.name)
    .slice(0, 30);
}

/** Lazy bounded requests, shared in-flight work, and last-subscriber cancellation. No per-card prefetch. */
export function createTeamProfileLoader(options: {
  request: (url: string, signal: AbortSignal) => Promise<unknown>;
  resolveLeague: (identity: TeamIdentity) => League | undefined;
  now?: () => number;
  timeoutMs?: number;
}) {
  const cache = new Map<string, TeamProfileData>();
  const pending = new Map<
    string,
    { promise: Promise<TeamProfileData>; controller: AbortController; users: number }
  >();
  const now = options.now ?? Date.now;
  async function load(identity: TeamIdentity, signal: AbortSignal): Promise<TeamProfileData> {
    const league = options.resolveLeague(identity),
      seed = teamProfileSeed(identity);
    if (!league) return { ...seed, fetchedAt: now(), partial: true };
    let failed = false;
    const get = async (url: string) => {
      signal.throwIfAborted();
      try {
        return await options.request(url, signal);
      } catch {
        signal.throwIfAborted();
        failed = true;
        return undefined;
      }
    };
    const isDb =
      /thesportsdb/i.test(identity.source ?? "") || (!identity.source && /^\d+$/.test(league.path));
    const isEspn =
      !isDb &&
      (!identity.source || identity.source === "espn") &&
      /^[a-z-]+\/[a-z0-9._-]+$/.test(league.path) &&
      /^\d+$/.test(identity.id);
    const [espn, db] = await Promise.all([
      isEspn ? get(`${SITE}/${league.path}/teams/${identity.id}`) : undefined,
      get(
        isDb && /^\d+$/.test(identity.id)
          ? `${DB}/lookupteam.php?id=${identity.id}`
          : `${DB}/searchteams.php?t=${encodeURIComponent(identity.name)}`,
      ),
    ]);
    const p = parseEspnTeamProfile(espn, identity) ?? seed;
    if (isEspn && p === seed) failed = true;
    const team = matchSportsDbTeam(db, identity, league);
    if (team) enrichSportsDbTeam(p, team);
    if (p !== seed) {
      const base = `${SITE}/${league.path}/teams/${identity.id}`;
      const [roster, stats, events] = await Promise.all([
        get(`${base}/roster`),
        get(`${base}/statistics`),
        get(`${base}/schedule`),
      ]);
      p.roster = parseEspnTeamRoster(roster);
      const statistics = parseEspnTeamStats(stats);
      if (statistics.length) p.statistics = statistics;
      p.events = parseEspnTeamEvents(events, identity.id);
    }
    if (team) {
      const id = text(team.idTeam);
      if (!p.roster.length) {
        p.roster = parseSportsDbRoster(await get(`${DB}/lookup_all_players.php?id=${id}`), id);
        p.rosterLimited = p.roster.length > 0;
      }
      if (!p.events.length) {
        const [next, last] = await Promise.all([
          get(`${DB}/eventsnext.php?id=${id}`),
          get(`${DB}/eventslast.php?id=${id}`),
        ]);
        p.events = [
          ...new Map(
            [...parseSportsDbTeamEvents(last, id), ...parseSportsDbTeamEvents(next, id)].map(
              (event) => [event.id, event],
            ),
          ).values(),
        ].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
      }
    }
    p.fetchedAt = now();
    p.partial = failed || !p.sourceUrls.length;
    signal.throwIfAborted();
    return p;
  }
  return (
    identity: TeamIdentity,
    signal?: AbortSignal,
    force = false,
  ): Promise<TeamProfileData> => {
    if (signal?.aborted) return Promise.reject(signal.reason);
    const key = `${identity.source ?? ""}:${identity.league}:${identity.id}:${normalize(identity.name)}`;
    const hit = cache.get(key);
    if (!force && hit && now() - hit.fetchedAt < (hit.partial ? 30_000 : 300_000))
      return Promise.resolve(hit);
    let job = pending.get(key);
    if (!job) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new DOMException("Team profile timed out", "TimeoutError")),
        options.timeoutMs ?? 35_000,
      );
      job = { controller, users: 0, promise: Promise.resolve(teamProfileSeed(identity)) };
      const current = job;
      job.promise = load(identity, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            cache.delete(key);
            cache.set(key, result);
            while (cache.size > 48) cache.delete(cache.keys().next().value!);
          }
          return result;
        })
        .finally(() => {
          clearTimeout(timer);
          if (pending.get(key) === current) pending.delete(key);
        });
      pending.set(key, job);
    }
    const current = job;
    current.users++;
    return new Promise<TeamProfileData>((resolve, reject) => {
      let done = false;
      const finish = () => {
        if (done) return false;
        done = true;
        signal?.removeEventListener("abort", abort);
        if (--current.users === 0) {
          current.controller.abort();
          if (pending.get(key) === current) pending.delete(key);
        }
        return true;
      };
      const abort = () => {
        if (finish()) reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      current.promise.then(
        (value) => {
          if (finish()) resolve(value);
        },
        (error) => {
          if (finish()) reject(error);
        },
      );
    });
  };
}
let loader: ReturnType<typeof createTeamProfileLoader> | undefined;
export async function fetchTeamProfile(
  identity: TeamIdentity,
  signal?: AbortSignal,
  force = false,
): Promise<TeamProfileData> {
  if (!loader) {
    const [{ HUB_LEAGUES }, { safeFetch }, { loadTeamProviderJson }] = await Promise.all([
      import("./hub-runtime"),
      import("../safe-fetch"),
      import("./team-provider"),
    ]);
    loader ??= createTeamProfileLoader({
      resolveLeague: (value) =>
        HUB_LEAGUES.find((league) => league.key === value.league || league.tag === value.league),
      request: async (url, requestSignal) => {
        if (url.startsWith(DB)) return loadTeamProviderJson(url, requestSignal);
        const response = await safeFetch(url, { signal: requestSignal });
        if (!response.ok) throw new Error(`Team profile HTTP ${response.status}`);
        return response.json();
      },
    });
  }
  return loader(identity, signal, force);
}
