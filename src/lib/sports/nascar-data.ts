import type { SportsGame } from "./espn-types";

export type NascarSeries = 1 | 2 | 3;
export type NascarDriver = {
  id: string;
  name: string;
  image?: string;
  firesuitImage?: string;
  carNumber?: string;
  team?: string;
  manufacturer?: string;
  url?: string;
  dateOfBirth?: string;
  hometown?: string;
  crewChief?: string;
};
export type NascarCareerSeason = {
  season: number;
  series: NascarSeries;
  starts?: number;
  wins?: number;
  poles?: number;
  top5?: number;
  top10?: number;
  lapsLed?: number;
  dnf?: number;
};
export type NascarStanding = Omit<NascarCareerSeason, "season" | "series"> & {
  driver: NascarDriver;
  position?: number;
  points?: number;
  playoffPoints?: number;
};
export type NascarRaceResult = {
  driver: NascarDriver;
  position?: number;
  grid?: number;
  laps?: number;
  lapsLed?: number;
  status?: string;
  points?: number;
  manufacturer?: string;
  speed?: number;
  time?: string;
  delta?: string;
};
export type NascarRaceData = {
  raceId: string;
  series: NascarSeries;
  season: number;
  name: string;
  trackName: string;
  trackId?: string;
  startMs: number;
  scheduledLaps?: number;
  completedLaps?: number;
  distanceMiles?: number;
  state: "pre" | "in" | "post";
  results: NascarRaceResult[];
  sessions: {
    id: string;
    name: string;
    startMs: number;
    type: "practice" | "qualifying" | "race";
  }[];
  sourceUrl: string;
  fetchedAt: number;
  partial?: boolean;
};
export type NascarStandings = {
  season: number;
  series: NascarSeries;
  standings: NascarStanding[];
  fetchedAt: number;
  partial?: boolean;
};
export type NascarDriverProfile = {
  driver: NascarDriver;
  standing?: NascarStanding;
  career?: NascarCareerSeason[];
  careerTotals?: Omit<NascarCareerSeason, "season" | "series">;
  fetchedAt: number;
  partial?: boolean;
};

export function nascarSeriesForLeague(league: string): NascarSeries | null {
  return league === "NASCAR" ? 1 : league === "NXS" ? 2 : league === "NCTS" ? 3 : null;
}

// Transport implementations follow the normalized public types above.
type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
const array = (value: unknown, limit = 1000): Json[] =>
  Array.isArray(value) ? value.slice(0, limit).map(object) : [];
const text = (value: unknown): string =>
  typeof value === "string" ? value.trim().slice(0, 500) : "";
const number = (value: unknown): number | undefined =>
  value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))
    ? Number(value)
    : undefined;
const id = (value: unknown): string => (/^\d+$/.test(String(value)) ? String(value) : "");
const CF = "https://cf.nascar.com";

function officialUrl(value: unknown): string | undefined {
  try {
    const u = new URL(text(value));
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (u.hostname === "nascar.com" || u.hostname.endsWith(".nascar.com"))
    )
      return u.href;
  } catch {
    /* A missing portrait is not a reason to guess an athlete identity. */
  }
}
const seriesSlug = (series: NascarSeries) =>
  ["", "nascar-cup-series", "nascar-xfinity-series", "nascar-craftsman-truck-series"][series];
const positive = (value: unknown) => {
  const n = number(value);
  return n != null && n > 0 ? n : undefined;
};

export function parseNascarDrivers(data: unknown, series?: NascarSeries): NascarDriver[] {
  return array(object(data).response).flatMap((row) => {
    const driverId = id(row.Nascar_Driver_ID),
      name = text(row.Full_Name);
    if (!driverId || !name) return [];
    const relevant =
      !series ||
      text(row.Driver_Series) === seriesSlug(series) ||
      (series === 2 && /xfinity|oreilly/i.test(text(row.Driver_Series))) ||
      (series === 3 && /truck/i.test(text(row.Driver_Series)));
    return [
      {
        id: driverId,
        name,
        image: officialUrl(row.Image_Small) || officialUrl(row.Image),
        firesuitImage: officialUrl(row.Firesuit_Image) || officialUrl(row.Firesuit_Image_Small),
        carNumber: relevant ? text(row.Badge) || undefined : undefined,
        team: relevant ? text(row.Team) || undefined : undefined,
        url: officialUrl(row.Driver_Page),
        dateOfBirth: /^\d{4}-\d{2}-\d{2}/.test(text(row.DOB))
          ? text(row.DOB).slice(0, 10)
          : undefined,
        hometown:
          [text(row.Hometown_City), text(row.Hometown_State), text(row.Hometown_Country)]
            .filter(Boolean)
            .join(", ") || undefined,
        crewChief: relevant ? text(row.Crew_Chief) || undefined : undefined,
      },
    ];
  });
}

function driverFor(row: Json, drivers: NascarDriver[]): NascarDriver {
  const driverId = id(row.driver_id);
  const info = drivers.find((driver) => driver.id === driverId);
  return {
    ...info,
    id: driverId,
    name: text(row.driver_fullname) || text(row.driver_name) || info?.name || "",
    carNumber: text(row.car_number) || text(row.car_no) || info?.carNumber,
    team: text(row.team_name) || info?.team,
    manufacturer: text(row.car_make) || text(row.manufacturer) || info?.manufacturer,
  };
}

export function parseNascarStandings(
  data: unknown,
  drivers: NascarDriver[] = [],
): NascarStanding[] {
  return array(data, 150)
    .flatMap((row) => {
      const driver = driverFor(row, drivers);
      if (!driver.id || !driver.name) return [];
      return [
        {
          driver,
          position: positive(row.position),
          points: number(row.points),
          starts: number(row.starts),
          wins: number(row.wins),
          poles: number(row.poles),
          top5: number(row.top_5),
          top10: number(row.top_10),
          lapsLed: number(row.laps_led),
          dnf: number(row.dnf),
          playoffPoints: number(row.playoff_points),
        },
      ];
    })
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
}

function utcDate(value: unknown): number {
  const date = text(value);
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(date) ? date : `${date}Z`);
}
export function nascarRaceStart(row: Json): number {
  const race = array(row.schedule, 100).find(
    (session) => number(session.run_type) === 3 && text(session.start_time_utc),
  );
  if (race) return utcDate(race.start_time_utc);
  const raw = text(row.date_scheduled) || text(row.race_date);
  if (/[zZ]|[+-]\d\d:\d\d$/.test(raw)) return Date.parse(raw);
  // NASCAR's unsuffixed scheduled date is Eastern; UTC schedule entries take precedence.
  const date = Date.parse(`${raw}Z`);
  if (!Number.isFinite(date)) return NaN;
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")
    ?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
  return offset
    ? date - (offset[1] === "+" ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3])) * 60_000
    : NaN;
}

const normalized = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function matchNascarRace(game: SportsGame, calendar: unknown): Json | undefined {
  const series = nascarSeriesForLeague(game.league);
  if (!series) return;
  const name = normalized(game.context?.name || game.home.name);
  const venue = normalized(game.context?.venue || "");
  const season = new Date(game.startMs).getUTCFullYear();
  const candidates = array(object(calendar)[`series_${series}`], 100)
    .flatMap((row) => {
      if (
        number(row.series_id) !== series ||
        number(row.race_season) !== season ||
        !id(row.race_id)
      )
        return [];
      const start = nascarRaceStart(row);
      if (!Number.isFinite(start) || Math.abs(start - game.startMs) > 36 * 3600_000) return [];
      const raceName = normalized(text(row.race_name)),
        track = normalized(text(row.track_name));
      const score =
        name && name === raceName
          ? 3
          : name.length > 12 &&
              raceName.length > 12 &&
              (name.includes(raceName) || raceName.includes(name))
            ? 2
            : (venue.length > 8 && venue === track) || (track.length > 12 && name.endsWith(track))
              ? 1
              : 0;
      return score ? [{ row, score }] : [];
    })
    .sort((a, b) => b.score - a.score);
  // A double-header at the same venue must have an identifying title, not a nearest-time guess.
  return candidates.length && (!candidates[1] || candidates[0].score > candidates[1].score)
    ? candidates[0].row
    : undefined;
}

export function parseNascarRace(
  game: SportsGame,
  scheduled: Json,
  weekend: unknown,
  drivers: NascarDriver[],
  live?: unknown,
): NascarRaceData {
  const series = nascarSeriesForLeague(game.league)!;
  const season = number(scheduled.race_season)!;
  const raceId = id(scheduled.race_id);
  const event = array(object(weekend).weekend_race, 10).find(
    (row) =>
      id(row.race_id) === raceId &&
      number(row.series_id) === series &&
      number(row.race_season) === season,
  );
  const info = event || scheduled;
  const runs = array(object(weekend).weekend_runs, 30).filter((run) => id(run.race_id) === raceId);
  const completed =
    game.state === "post" ||
    info.inspection_complete === true ||
    positive(info.winner_driver_id) != null;
  const officialResults = array(info.results, 100).filter(
    (row) =>
      (!row.race_id || id(row.race_id) === raceId) &&
      (!row.series_id || number(row.series_id) === series),
  );
  const qualifying = runs.find((run) => number(run.run_type) === 2);
  let results: NascarRaceResult[] = (
    officialResults.length ? officialResults : array(qualifying?.results, 100)
  ).flatMap((row) => {
    const driver = driverFor(row, drivers);
    if (!driver.id || !driver.name) return [];
    return [
      {
        driver,
        position: officialResults.length ? positive(row.finishing_position) : undefined,
        grid:
          positive(row.starting_position) ||
          positive(row.qualifying_position) ||
          (!officialResults.length ? positive(row.finishing_position) : undefined),
        laps: number(row.laps_completed),
        lapsLed: number(row.laps_led),
        status: text(row.finishing_status) || text(row.comment) || undefined,
        points: number(row.points_earned),
        manufacturer: text(row.car_make) || text(row.manufacturer) || undefined,
        speed: number(row.qualifying_speed) || number(row.best_lap_speed),
        delta: number(row.diff_laps)
          ? `${row.diff_laps} laps`
          : positive(row.diff_time)
            ? `${row.diff_time}s`
            : undefined,
      },
    ];
  });
  const liveData = object(live);
  const exactLive =
    game.state === "in" &&
    !completed &&
    id(liveData.race_id) === raceId &&
    number(liveData.series_id) === series &&
    number(liveData.run_type) === 3;
  if (exactLive)
    results = array(liveData.vehicles, 100).flatMap((row) => {
      const identity = object(row.driver);
      const driver = driverFor(
        {
          driver_id: identity.driver_id,
          driver_name: text(identity.full_name).replace(/\s*\(C\)$/, ""),
          car_number: row.vehicle_number,
          manufacturer: row.vehicle_manufacturer,
        },
        drivers,
      );
      if (!driver.id || !driver.name) return [];
      const prior = results.find((result) => result.driver.id === driver.id);
      return [
        {
          ...prior,
          driver,
          position: positive(row.running_position),
          grid: positive(row.starting_position),
          laps: number(row.laps_completed),
          lapsLed: array(row.laps_led, 100).reduce(
            (sum, lap) =>
              sum + Math.max(0, (number(lap.end_lap) ?? 0) - (number(lap.start_lap) ?? 0) + 1),
            0,
          ),
          speed: number(row.last_lap_speed),
          delta: number(row.delta) != null ? String(row.delta) : undefined,
        },
      ];
    });
  results.sort((a, b) => (a.position ?? a.grid ?? 999) - (b.position ?? b.grid ?? 999));
  const sessions = array(info.schedule, 100).flatMap((session) => {
    const type = number(session.run_type);
    const startMs = utcDate(session.start_time_utc);
    if (![1, 2, 3].includes(type!) || !Number.isFinite(startMs)) return [];
    return [
      {
        id: `${raceId}:${type}:${startMs}`,
        name: text(session.event_name),
        startMs,
        type:
          type === 1
            ? ("practice" as const)
            : type === 2
              ? ("qualifying" as const)
              : ("race" as const),
      },
    ];
  });
  return {
    raceId,
    series,
    season,
    name: text(info.race_name),
    trackName: text(info.track_name),
    trackId: id(info.track_id) || undefined,
    startMs: nascarRaceStart(info),
    scheduledLaps: positive(info.scheduled_laps),
    completedLaps: exactLive
      ? number(liveData.lap_number)
      : completed
        ? number(info.actual_laps)
        : undefined,
    distanceMiles: positive(info.scheduled_distance),
    state: completed ? "post" : game.state,
    results,
    sessions,
    sourceUrl: `https://www.nascar.com/results/racecenter/${season}/${seriesSlug(series)}/`,
    fetchedAt: Date.now(),
    partial: !event,
  };
}

/** Only reads the provider's explicitly labelled career table; no scripts or HTML are executed. */
export function parseNascarCareerHtml(html: string, expectedUrl?: string): NascarCareerSeason[] {
  if (expectedUrl) {
    const canonicalTag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0];
    const canonical = officialUrl(canonicalTag?.match(/\bhref=["']([^"']+)["']/i)?.[1]);
    if (
      !canonical ||
      new URL(canonical).pathname.replace(/\/$/, "") !==
        new URL(expectedUrl).pathname.replace(/\/$/, "")
    )
      return [];
  }
  const marker = html.indexOf('aria-label="All-Time Career Table"');
  if (marker < 0) return [];
  const result = html
    .slice(marker, marker + 300_000)
    .split(/<div\b[^>]*class=["']table-row["'][^>]*>/i)
    .slice(1, 200)
    .flatMap((row) => {
      const cells = [
        ...row.matchAll(
          /<div\b[^>]*class=["']([^"']*\brow-col\b[^"']*)["'][^>]*>([\s\S]*?)<\/div>/gi,
        ),
      ];
      const cell = (name: string) =>
        cells
          .find((match) => match[1].split(/\s+/).includes(name))?.[2]
          .replace(/<[^>]*>/g, "")
          .trim();
      const season = number(cell("year"));
      const series = Number(
        cells.find((match) => /seriesId-[123]/.test(match[1]))?.[1].match(/seriesId-([123])/)?.[1],
      ) as NascarSeries;
      if (
        !season ||
        season < 1949 ||
        season > new Date().getUTCFullYear() + 1 ||
        ![1, 2, 3].includes(series)
      )
        return [];
      return [
        {
          season,
          series,
          starts: number(cell("starts")),
          wins: number(cell("wins")),
          poles: number(cell("poles")),
          top5: number(cell("top-5s")),
          top10: number(cell("top-10s")),
          lapsLed: number(cell("laps-led")),
        },
      ];
    });
  return [...new Map(result.map((row) => [`${row.season}:${row.series}`, row])).values()].sort(
    (a, b) => b.season - a.season || a.series - b.series,
  );
}

export type NascarTransport = {
  json: (url: string, signal: AbortSignal) => Promise<unknown>;
  text: (url: string, signal: AbortSignal) => Promise<string>;
};
export function createNascarClient(transport: NascarTransport) {
  const cache = new Map<string, { value: unknown; expires: number }>();
  const pending = new Map<
    string,
    { promise: Promise<unknown>; controller: AbortController; users: number }
  >();
  function cached<T>(
    key: string,
    ttl: number,
    signal: AbortSignal,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);
    let flight = pending.get(key);
    if (!flight || flight.controller.signal.aborted) {
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 10000);
      const entry = {
        promise: Promise.resolve<unknown>(undefined),
        controller,
        users: 0,
      };
      entry.promise = new Promise<T>((resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        controller.signal.addEventListener("abort", abort, { once: true });
        run(controller.signal)
          .then(resolve, reject)
          .finally(() => controller.signal.removeEventListener("abort", abort));
      })
        .then((value) => {
          if (!controller.signal.aborted && value !== null) {
            cache.set(key, { value, expires: Date.now() + ttl });
            if (cache.size > 36) cache.delete(cache.keys().next().value!);
          }
          return value;
        })
        .finally(() => {
          clearTimeout(deadline);
          if (pending.get(key) === entry) pending.delete(key);
        });
      pending.set(key, entry);
      flight = entry;
    }
    const entry = flight;
    entry.users++;
    return new Promise<T>((resolve, reject) => {
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
          if (release()) resolve(value as T);
        },
        (error) => {
          if (release()) reject(error);
        },
      );
    });
  }
  const validSeason = (season: number) =>
    Number.isInteger(season) && season >= 1949 && season <= new Date().getUTCFullYear() + 1;
  const roster = (season: number, series: NascarSeries, signal: AbortSignal) =>
    cached(`drivers:${season}:${series}`, 6 * 3600_000, signal, async (abort) =>
      parseNascarDrivers(
        await transport.json(
          `${CF}/cacher/${season}/${series}/drivers-combined-feed-v2.json`,
          abort,
        ),
        series,
      ),
    );
  async function loadNascarStandings(
    season: number,
    series: NascarSeries,
    signal: AbortSignal,
  ): Promise<NascarStandings> {
    if (!validSeason(season) || ![1, 2, 3].includes(series))
      throw new Error("Invalid NASCAR season");
    return cached(`standings:${season}:${series}`, 120_000, signal, async (abort) => {
      const [points, drivers] = await Promise.allSettled([
        transport.json(`${CF}/cacher/${season}/${series}/points-feed.json`, abort),
        roster(season, series, abort),
      ]);
      if (points.status !== "fulfilled" || !Array.isArray(points.value))
        throw new Error("NASCAR standings unavailable");
      return {
        season,
        series,
        standings: parseNascarStandings(
          points.value,
          drivers.status === "fulfilled" ? drivers.value : [],
        ),
        fetchedAt: Date.now(),
        partial: drivers.status === "rejected",
      };
    });
  }
  async function loadNascarRace(
    game: SportsGame,
    signal: AbortSignal,
  ): Promise<NascarRaceData | null> {
    const series = nascarSeriesForLeague(game.league),
      season = new Date(game.startMs).getUTCFullYear();
    if (!series || !validSeason(season)) return null;
    return cached(
      `event:${game.league}:${game.id}:${game.startMs}:${game.state}`,
      game.state === "in" ? 20000 : 300_000,
      signal,
      async (abort) => {
        const [calendar, drivers] = await Promise.allSettled([
          cached(`calendar:${season}`, 3600_000, abort, async (inner) => {
            const data = object(
              await transport.json(`${CF}/cacher/${season}/race_list_basic.json`, inner),
            );
            // Keep only normalized calendar fields; discard administrative schedules and unused nested records.
            return Object.fromEntries(
              [1, 2, 3].map((s) => [
                `series_${s}`,
                array(data[`series_${s}`], 100).map((row) => ({
                  race_id: row.race_id,
                  series_id: row.series_id,
                  race_season: row.race_season,
                  race_name: row.race_name,
                  track_id: row.track_id,
                  track_name: row.track_name,
                  date_scheduled: row.date_scheduled,
                  scheduled_laps: row.scheduled_laps,
                  scheduled_distance: row.scheduled_distance,
                  inspection_complete: row.inspection_complete,
                  winner_driver_id: row.winner_driver_id,
                  schedule: array(row.schedule, 100).filter((item) =>
                    [1, 2, 3].includes(Number(item.run_type)),
                  ),
                })),
              ]),
            );
          }),
          roster(season, series, abort),
        ]);
        if (calendar.status !== "fulfilled") return null;
        const matched = matchNascarRace(game, calendar.value);
        if (!matched) return null;
        const [weekend, live] = await Promise.allSettled([
          transport.json(
            `${CF}/cacher/${season}/${series}/${id(matched.race_id)}/weekend-feed.json`,
            abort,
          ),
          game.state === "in"
            ? transport.json(`${CF}/live/feeds/live-feed.json`, abort)
            : Promise.resolve(undefined),
        ]);
        const result = parseNascarRace(
          game,
          matched,
          weekend.status === "fulfilled" ? weekend.value : {},
          drivers.status === "fulfilled" ? drivers.value : [],
          live.status === "fulfilled" ? live.value : undefined,
        );
        return {
          ...result,
          partial:
            result.partial ||
            drivers.status === "rejected" ||
            (game.state === "in" && live.status === "rejected"),
        };
      },
    );
  }
  async function loadNascarDriver(
    driverId: string,
    season: number,
    series: NascarSeries,
    signal: AbortSignal,
  ): Promise<NascarDriverProfile> {
    if (!id(driverId) || !validSeason(season) || ![1, 2, 3].includes(series))
      throw new Error("Invalid NASCAR driver");
    return cached(`profile:${driverId}:${season}:${series}`, 600_000, signal, async (abort) => {
      const standings = await loadNascarStandings(season, series, abort).catch(() => undefined);
      const standing = standings?.standings.find((row) => row.driver.id === driverId);
      let driver = standing?.driver;
      if (!driver?.url) {
        const drivers = await roster(season, series, abort).catch(() => []);
        driver = drivers.find((row) => row.id === driverId) || driver;
      }
      if (!driver) throw new Error("NASCAR driver unavailable");
      let career: NascarCareerSeason[] = [];
      if (driver.url)
        career = await cached(`career:${driverId}`, 86400_000, abort, async (inner) =>
          parseNascarCareerHtml(await transport.text(driver!.url!, inner), driver!.url!),
        ).catch(() => []);
      // The current season is known from the points feed even if the public biography site blocks its career table.
      if (!career.some((row) => row.season === season && row.series === series) && standing) {
        const {
          driver: _driver,
          position: _position,
          points: _points,
          playoffPoints: _playoffPoints,
          ...stats
        } = standing;
        career = [{ season, series, ...stats }, ...career];
      }
      return {
        driver,
        standing,
        career,
        fetchedAt: Date.now(),
        partial: !career.some((row) => row.season < season) || !!standings?.partial,
      };
    });
  }
  return { loadNascarRace, loadNascarStandings, loadNascarDriver };
}

async function response(url: string, signal: AbortSignal): Promise<Response> {
  const { safeFetch } = await import("@/lib/safe-fetch");
  const result = await safeFetch(url, { signal });
  if (!result.ok) throw new Error(`NASCAR feed ${result.status}`);
  if (Number(result.headers.get("content-length")) > 3_000_000)
    throw new Error("NASCAR feed is too large");
  return result;
}
const client = createNascarClient({
  json: async (url, signal) => (await response(url, signal)).json(),
  text: async (url, signal) => {
    const html = await (await response(url, signal)).text();
    if (html.length > 2_000_000) throw new Error("NASCAR profile is too large");
    return html;
  },
});
export const loadNascarRace = client.loadNascarRace;
export const loadNascarStandings = client.loadNascarStandings;
export const loadNascarDriver = client.loadNascarDriver;
