import type { LeagueDef } from "./espn-types";
import type { SportsTeam } from "./favourites";
import { saudiTeamAliases } from "./saudi-team-aliases";

type CatalogLeague = Pick<LeagueDef, "key" | "path" | "group"> & { labelEn?: string };
type Row = Record<string, unknown>;
type Entry = { at: number; teams: SportsTeam[]; partial?: boolean };
export type TeamCatalogStatus = "ready" | "not-published" | "unavailable";
const FRESH_MS = 6 * 60 * 60 * 1000;
const STALE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 96;
const MAX_STORAGE_CHARS = 1_000_000;
const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const STANDINGS = "https://site.api.espn.com/apis/v2/sports";
const DB = "https://www.thesportsdb.com/api/v1/json/123";
const obj = (value: unknown): Row => (value && typeof value === "object" ? (value as Row) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string => (typeof value === "string" ? value : "");

/** ESPN team catalogs, grouped standings, and cricket's scoreboard roster use different envelopes. */
export function parseCatalogTeams(data: unknown, league: CatalogLeague): SportsTeam[] {
  const found = new Map<string, SportsTeam>();
  if (/^\d+$/.test(league.path)) {
    for (const value of list(obj(data).teams)) {
      const row = obj(value);
      const member = [
        "idLeague",
        "idLeague2",
        "idLeague3",
        "idLeague4",
        "idLeague5",
        "idLeague6",
        "idLeague7",
      ].some((key) => str(row[key]) === league.path);
      const id = str(row.idTeam),
        name = str(row.strTeam);
      if (!member || !id || !name || found.has(id) || found.size >= 2000) continue;
      const logo = str(row.strBadge) || str(row.strTeamBadge);
      const aliases = [
        ...new Set(
          (str(row.strAlternate) || str(row.strTeamAlternate))
            .split(/[,;|]/)
            .map((name) => name.trim())
            .filter(Boolean),
        ),
      ];
      found.set(id, {
        id,
        name,
        leagueKey: league.key,
        group: league.group,
        shortName: str(row.strTeamShort) || name,
        abbr: str(row.strTeamShort),
        aliases,
        logo: /^https?:\/\//i.test(logo) ? logo : "",
      });
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  function add(value: unknown) {
    const row = obj(value);
    const team = row.team ? obj(row.team) : row;
    const id = typeof team.id === "number" ? String(team.id) : str(team.id);
    const name = str(team.displayName) || str(team.name);
    if (!id || !name || found.has(id) || found.size >= 2000) return;
    const logo = str(team.logo) || str(obj(list(team.logos)[0]).href);
    found.set(id, {
      id,
      name,
      leagueKey: league.key,
      group: league.group,
      shortName: str(team.shortDisplayName) || name,
      abbr: str(team.abbreviation),
      aliases: [...saudiTeamAliases(league.key, id)],
      logo: /^https?:\/\//i.test(logo) ? logo : "",
    });
  }
  function visit(value: unknown, depth = 0) {
    if (depth > 8) return;
    const row = obj(value);
    list(row.teams).forEach(add);
    list(obj(row.standings).entries).forEach(add);
    for (const key of ["sports", "leagues", "children"]) {
      for (const child of list(row[key])) visit(child, depth + 1);
    }
  }
  visit(data);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function createTeamCatalog(options: {
  request: (url: string, signal: AbortSignal) => Promise<unknown>;
  read?: () => string | null;
  readAsync?: () => Promise<string | null>;
  write?: (json: string) => void;
  now?: () => number;
  timeoutMs?: number;
}) {
  const now = options.now ?? Date.now;
  const cache = new Map<string, Entry>();
  const inflight = new Map<string, Promise<SportsTeam[]>>();
  const statuses = new Map<string, TeamCatalogStatus>();
  const queue: Array<() => void> = [];
  let active = 0;
  let restored = false;

  function restoreJson(raw: string | null | undefined) {
    try {
      if (!raw || raw.length > MAX_STORAGE_CHARS) return;
      for (const value of list(JSON.parse(raw)).slice(0, MAX_ENTRIES)) {
        const entry = obj(value);
        const key = str(entry.key);
        if (!key || typeof entry.at !== "number" || entry.at > now() || now() - entry.at > STALE_MS)
          continue;
        const teams = list(entry.teams)
          .filter((value): value is SportsTeam => {
            const team = obj(value);
            return (
              team.leagueKey === key &&
              typeof team.id === "string" &&
              !!team.id &&
              typeof team.name === "string" &&
              !!team.name &&
              [team.shortName, team.group, team.abbr, team.logo].every((v) => typeof v === "string")
            );
          })
          .slice(0, 2000)
          .map((team) => ({
            ...team,
            aliases: [
              ...new Set([
                ...(Array.isArray(team.aliases)
                  ? team.aliases.filter((alias) => typeof alias === "string").slice(0, 20)
                  : []),
                ...saudiTeamAliases(team.leagueKey, team.id),
              ]),
            ],
          }));
        if (teams.length && entry.at > (cache.get(key)?.at ?? -1))
          cache.set(key, { at: entry.at, teams, partial: entry.partial === true });
      }
    } catch {
      /* A damaged or unavailable cache must not prevent a live request. */
    }
  }

  function restore() {
    if (restored) return;
    restored = true;
    try {
      restoreJson(options.read?.());
    } catch {
      /* Storage may be unavailable. */
    }
  }
  // Start disk hydration once, before the picker opens; never overwrite newer network data.
  const diskReady = options.readAsync
    ? Promise.resolve()
        .then(options.readAsync)
        .then(restoreJson)
        .catch(() => {})
    : Promise.resolve();

  function persist() {
    const entries = [...cache]
      .filter(([, value]) => now() - value.at <= STALE_MS)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX_ENTRIES);
    cache.clear();
    for (const [key, value] of entries) cache.set(key, value);
    const rows: Array<{ key: string } & Entry> = [];
    let length = 2;
    for (const [key, value] of entries) {
      const row = { key, ...value };
      const size = JSON.stringify(row).length + 1;
      if (length + size > MAX_STORAGE_CHARS) continue;
      rows.push(row);
      length += size;
    }
    try {
      options.write?.(JSON.stringify(rows));
    } catch {
      /* Memory cache still serves this session. */
    }
  }

  function cached(key: string): SportsTeam[] {
    restore();
    const entry = cache.get(key);
    if (!entry || now() - entry.at > STALE_MS) return [];
    return entry.teams;
  }

  // Bound headers AND JSON decoding even when a native bridge does not honor AbortSignal.
  async function request(url: string): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => options.request(url, controller.signal)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("Team catalog request timed out"));
          }, options.timeoutMs ?? 10_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function load(league: CatalogLeague): Promise<SportsTeam[]> {
    if (/^\d+$/.test(league.path)) {
      // Free search/table responses are capped. Never turn a demo league or a prior season into this roster.
      const teams = new Map<string, SportsTeam>();
      let successful = false;
      let failed = false;
      try {
        const path = league.labelEn
          ? `search_all_teams.php?l=${encodeURIComponent(league.labelEn)}`
          : `lookup_all_teams.php?id=${league.path}`;
        const data = await request(`${DB}/${path}`);
        for (const team of parseCatalogTeams(data, league)) teams.set(team.id, team);
        successful =
          teams.size > 0 ||
          obj(data).teams === null ||
          (Array.isArray(obj(data).teams) && list(obj(data).teams).length === 0);
        if (!successful) failed = true;
      } catch {
        failed = true; /* Matching current standings may still supply real teams. */
      }
      try {
        const info = await request(`${DB}/lookupleague.php?id=${league.path}`);
        const record = list(obj(info).leagues)
          .map(obj)
          .find((row) => str(row.idLeague) === league.path);
        if (!record) failed = true;
        const season = str(record?.strCurrentSeason);
        if (record && /^\d{4}(?:[-/]\d{2,4})?$/.test(season)) {
          const table = await request(
            `${DB}/lookuptable.php?l=${league.path}&s=${encodeURIComponent(season)}`,
          );
          for (const row of list(obj(table).table).map(obj)) {
            if (str(row.idLeague) !== league.path || str(row.strSeason) !== season) continue;
            const id = str(row.idTeam),
              name = str(row.strTeam),
              logo = str(row.strBadge);
            if (!id || !name || teams.has(id)) continue;
            teams.set(id, {
              id,
              name,
              shortName: name,
              abbr: "",
              leagueKey: league.key,
              group: league.group,
              logo: /^https?:\/\//i.test(logo) ? logo : "",
            });
          }
        }
      } catch {
        failed = true; /* A partial directory remains useful when optional standings cannot load. */
      }
      if (teams.size) {
        const value = [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
        cache.set(league.key, { at: now(), teams: value, partial: true });
        statuses.set(league.key, "ready");
        persist();
        return value;
      }
      const known = cached(league.key);
      statuses.set(
        league.key,
        known.length ? "ready" : successful && !failed ? "not-published" : "unavailable",
      );
      return known;
    }
    // /teams defaults to 50 and truncates college leagues. Cricket does not expose /teams.
    const urls =
      league.group === "cricket"
        ? [`${STANDINGS}/${league.path}/standings`, `${SITE}/${league.path}/scoreboard?limit=1000`]
        : [`${SITE}/${league.path}/teams?limit=1000`, `${STANDINGS}/${league.path}/standings`];
    let successfulEmpty = 0;
    for (const url of urls) {
      try {
        const data = await request(url);
        const teams = parseCatalogTeams(data, league);
        if (teams.length) {
          cache.set(league.key, { at: now(), teams });
          statuses.set(league.key, "ready");
          persist();
          return teams;
        }
        if (["sports", "children", "teams"].some((key) => Array.isArray(obj(data)[key])))
          successfulEmpty++;
      } catch {
        /* The independent standings/roster feed can still recover this league. */
      }
    }
    // Empty/error responses are never cached as success and never replace known teams.
    const known = cached(league.key);
    statuses.set(
      league.key,
      known.length ? "ready" : successfulEmpty === urls.length ? "not-published" : "unavailable",
    );
    return known;
  }

  function runNext() {
    while (active < 3 && queue.length) queue.shift()?.();
  }

  function fetch(league: CatalogLeague, force = false): Promise<SportsTeam[]> {
    const known = cached(league.key);
    if (!force && known.length && now() - cache.get(league.key)!.at < FRESH_MS)
      return Promise.resolve(known);
    const pending = inflight.get(league.key);
    if (pending) return pending;
    if (!/^\d+$/.test(league.path) && !/^[a-z-]+\/[a-z0-9._-]+$/i.test(league.path))
      return Promise.resolve(known);
    const promise = new Promise<SportsTeam[]>((resolve) => {
      queue.push(() => {
        active++;
        const finish = (teams: SportsTeam[]) => {
          active--;
          inflight.delete(league.key);
          resolve(teams);
          runNext();
        };
        void diskReady
          .then(() => {
            const saved = cached(league.key);
            return !force && saved.length && now() - cache.get(league.key)!.at < FRESH_MS
              ? saved
              : load(league);
          })
          .then(finish, () => finish(cached(league.key)));
      });
    });
    inflight.set(league.key, promise);
    runNext();
    return promise;
  }
  const status = (key: string): TeamCatalogStatus =>
    cached(key).length ? "ready" : (statuses.get(key) ?? "unavailable");
  return {
    cached,
    fetch,
    status,
    isPartial: (key: string) => !!cached(key).length && cache.get(key)?.partial === true,
  };
}
