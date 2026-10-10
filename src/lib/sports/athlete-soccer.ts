export type SoccerCareerCategory = {
  name: string;
  labels: string[];
  descriptions: string[];
  totals: string[];
  rows: { season: string; team: string; values: string[] }[];
};
type Json = Record<string, unknown>;
type SeasonData = { season: string; data: unknown };
const record = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string => (typeof value === "string" ? value.slice(0, 240) : "");
const value = (stat: Json): string => {
  const display = text(stat.displayValue);
  if (display) return display;
  return typeof stat.value === "number" && Number.isFinite(stat.value) ? String(stat.value) : "—";
};
const categories = (data: unknown) =>
  list(record(record(data).splits).categories)
    .slice(0, 20)
    .map(record);

/** Align stats by provider identity because season responses can reorder or omit columns. */
export function parseSoccerCareer(totals: unknown, seasons: SeasonData[]): SoccerCareerCategory[] {
  const definitions = new Map<string, { name: string; stats: Map<string, Json> }>();
  for (const data of [totals, ...seasons.map((season) => season.data)]) {
    for (const category of categories(data)) {
      const key = text(category.name);
      if (!key) continue;
      let entry = definitions.get(key);
      if (!entry) {
        entry = { name: text(category.displayName) || key, stats: new Map() };
        definitions.set(key, entry);
      }
      for (const item of list(category.stats).slice(0, 40)) {
        const stat = record(item),
          name = text(stat.name);
        if (name && !entry.stats.has(name)) entry.stats.set(name, stat);
      }
    }
  }
  const cells = (data: unknown, key: string, names: string[]) => {
    const category = categories(data).find((candidate) => candidate.name === key);
    const stats = new Map(
      list(category?.stats).map((item) => {
        const stat = record(item);
        return [text(stat.name), stat] as const;
      }),
    );
    return names.map((name) => (stats.has(name) ? value(stats.get(name)!) : "—"));
  };
  return [...definitions.entries()]
    .slice(0, 20)
    .map(([key, definition]) => {
      const names = [...definition.stats.keys()].slice(0, 40);
      return {
        name: definition.name,
        labels: names.map(
          (name) =>
            text(definition.stats.get(name)!.abbreviation) ||
            text(definition.stats.get(name)!.shortDisplayName) ||
            name,
        ),
        descriptions: names.map(
          (name) =>
            text(definition.stats.get(name)!.description) ||
            text(definition.stats.get(name)!.displayName) ||
            name,
        ),
        totals: cells(totals, key, names),
        rows: seasons.slice(0, 40).map((season) => ({
          season: season.season,
          team: "",
          values: cells(season.data, key, names),
        })),
      };
    })
    .filter((category) => category.labels.length > 0);
}

const CORE = "https://sports.core.api.espn.com";
/** The provider returns HTTP refs; upgrade only exact official host/path matches. */
export function soccerSeasonReferences(
  raw: unknown,
  league: string,
): { season: string; url: string }[] {
  const prefix = `/v2/sports/soccer/leagues/${league}/seasons/`;
  const found = new Map<string, string>();
  for (const item of list(record(raw).items)) {
    try {
      const url = new URL(text(record(item).$ref));
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.hostname !== "sports.core.api.espn.com" ||
        url.port ||
        url.username ||
        url.password ||
        !url.pathname.startsWith(prefix)
      )
        continue;
      const season = url.pathname.slice(prefix.length);
      if (!/^\d{4}$/.test(season)) continue;
      found.set(season, `${CORE}${url.pathname}`);
    } catch {
      /* Invalid provider references are not followed. */
    }
  }
  return [...found]
    .sort(([a], [b]) => Number(b) - Number(a))
    .slice(0, 40)
    .map(([season, url]) => ({ season, url }));
}

const cache = new Map<string, { at: number; complete: boolean; data: SoccerCareerCategory[] }>();

export async function fetchSoccerCareer(
  path: string,
  athleteId: string,
  signal: AbortSignal,
): Promise<SoccerCareerCategory[]> {
  signal.throwIfAborted();
  const match = /^soccer\/([a-z0-9][a-z0-9.-]{0,40})$/.exec(path);
  if (!match || match[1] === "all" || !/^\d{1,20}$/.test(athleteId)) return [];
  const key = `${path}:${athleteId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.complete ? 3_600_000 : 60_000)) return hit.data;
  const { safeFetch } = await import("../safe-fetch");
  const base = `${CORE}/v2/sports/soccer/leagues/${match[1]}`;
  const json = async (url: string) => {
    signal.throwIfAborted();
    const response = await safeFetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Football career feed ${response.status}`);
    return response.json() as Promise<unknown>;
  };
  const [totals, index] = await Promise.allSettled([
    json(`${base}/athletes/${athleteId}/statistics`),
    json(`${base}/athletes/${athleteId}/seasons?limit=100`),
  ]);
  signal.throwIfAborted();
  if (totals.status === "rejected" && index.status === "rejected") throw totals.reason;
  const refs = index.status === "fulfilled" ? soccerSeasonReferences(index.value, match[1]) : [];
  const seasonData: (SeasonData | undefined)[] = Array.from(
    { length: refs.length },
    () => undefined,
  );
  let cursor = 0,
    failed = false;
  const worker = async () => {
    while (cursor < refs.length) {
      signal.throwIfAborted();
      const slot = cursor++,
        ref = refs[slot];
      try {
        const data = await json(`${ref.url}/types/1/athletes/${athleteId}/statistics`);
        if (categories(data).length) seasonData[slot] = { season: ref.season, data };
      } catch {
        signal.throwIfAborted();
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, refs.length) }, worker));
  signal.throwIfAborted();
  const result = parseSoccerCareer(
    totals.status === "fulfilled" ? totals.value : null,
    seasonData.filter((season): season is SeasonData => !!season),
  );
  cache.delete(key);
  cache.set(key, {
    at: Date.now(),
    complete: !failed && totals.status === "fulfilled" && index.status === "fulfilled",
    data: result,
  });
  while (cache.size > 30) cache.delete(cache.keys().next().value!);
  return result;
}
