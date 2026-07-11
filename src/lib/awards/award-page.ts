import { AWARD_CATALOG } from "@/lib/awards-catalog";
import { readAwardHistory } from "@/lib/awards-history";
import type { Meta } from "@/lib/cinemeta";
import { get, IMG } from "@/lib/providers/tmdb/tmdb-client";
import type { AwardType } from "@/lib/providers/wikidata";

export type AwardPerson = {
  id: number;
  name: string;
  photo: string | null;
  role: string;
  work: string | null;
  wins: number;
};

export type AwardPeople = {
  actors: AwardPerson[];
  directors: AwardPerson[];
  writers: AwardPerson[];
};

export const EMPTY_PEOPLE: AwardPeople = { actors: [], directors: [], writers: [] };

type Role = "film" | "actor" | "director" | "writer" | "other";
type FilmSeed = { title: string; year: number; kind: "movie" | "series" };
type PersonSeed = { name: string; role: string; work: string | null; year: number; wins: number };

const PRIMARY_FILM_KEYS: Partial<Record<AwardType, string[]>> = {
  oscar: ["best_picture"],
  emmy: ["outstanding_drama_series", "outstanding_comedy_series", "outstanding_limited_series"],
  golden_globe: ["best_picture_drama", "best_picture_musical_comedy", "best_tv_drama", "best_tv_musical_comedy"],
  bafta: ["best_film"],
  sag: ["outstanding_cast_motion_picture", "outstanding_drama_ensemble", "outstanding_comedy_ensemble"],
  critics_choice: ["best_picture", "best_drama_series", "best_comedy_series"],
  cannes: ["palme_dor"],
  venice: ["golden_lion"],
  berlin: ["golden_bear"],
};

function classify(name: string): Role {
  const n = name.toLowerCase();
  if (/actor|actress|performance/.test(n)) return "actor";
  if (/director|directing/.test(n)) return "director";
  if (/screenplay|\bwrit/.test(n)) return "writer";
  if (/picture|film|feature|series|palme|lion|bear|grand prix|ensemble|cast/.test(n)) return "film";
  return "other";
}

function isSeries(name: string): boolean {
  return /\bseries\b|television|\btv\b/i.test(name);
}

function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NON_PERSON = new Set([
  "various",
  "various artists",
  "abc",
  "cbs",
  "nbc",
  "fx",
  "hbo",
  "hbo max",
  "max",
  "showtime",
  "amazon",
  "amazon prime video",
  "netflix",
  "hulu",
  "usa",
  "amc",
  "apple tv",
  "the novel",
  "the play",
  "the memoir",
  "the book",
  "the novella",
  "the short story",
  "the television play",
  "a story",
  "novel",
  "p r",
  "p n",
]);

function isPersonName(name: string): boolean {
  const k = norm(name);
  if (!k) return false;
  if (NON_PERSON.has(k)) return false;
  if (/^the (novel|play|memoir|book|novella|short story|television play|story)$/i.test(name.trim())) return false;
  if (/\bbrothers\b/i.test(name)) return false;
  return true;
}

function splitRecipients(raw: string): string[] {
  return raw
    .split(/\s*&\s*|\s+and\s+|\s*,\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && isPersonName(s));
}

function buildSeeds(awardType: AwardType): {
  films: FilmSeed[];
  actors: PersonSeed[];
  directors: PersonSeed[];
  writers: PersonSeed[];
} {
  const meta = AWARD_CATALOG[awardType];
  const history = readAwardHistory(awardType, meta.categories);
  const filmKeys = new Set(PRIMARY_FILM_KEYS[awardType] ?? []);
  const filmByKey = new Map<string, FilmSeed>();
  const people: Record<"actor" | "director" | "writer", Map<string, PersonSeed>> = {
    actor: new Map(),
    director: new Map(),
    writer: new Map(),
  };
  for (const group of history) {
    let role: Role = filmKeys.has(group.category.key) ? "film" : classify(group.category.name);
    if (role === "film" && !filmKeys.has(group.category.key)) role = "other";
    const kind = isSeries(group.category.name) ? "series" : "movie";
    for (const e of group.entries) {
      if (role === "film") {
        const k = norm(e.workTitle);
        const prev = filmByKey.get(k);
        if (!prev || e.year > prev.year) filmByKey.set(k, { title: e.workTitle, year: e.year, kind });
      } else if (role === "actor" || role === "director" || role === "writer") {
        const names = e.recipients.flatMap(splitRecipients);
        for (const name of names) {
          const k = norm(name);
          if (!k) continue;
          const map = people[role];
          const prev = map.get(k);
          if (prev) {
            prev.wins += 1;
            if (e.year > prev.year) {
              prev.year = e.year;
              prev.work = e.workTitle;
            }
          } else {
            map.set(k, { name, role: group.category.name, work: e.workTitle, year: e.year, wins: 1 });
          }
        }
      }
    }
  }
  const topPeople = (m: Map<string, PersonSeed>, n: number) =>
    [...m.values()].sort((a, b) => b.wins - a.wins || b.year - a.year).slice(0, n);
  return {
    films: [...filmByKey.values()].sort((a, b) => b.year - a.year).slice(0, 300),
    actors: topPeople(people.actor, 18),
    directors: topPeople(people.director, 14),
    writers: topPeople(people.writer, 14),
  };
}

type RawResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  profile_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  popularity?: number;
  known_for_department?: string;
};

async function searchTitle(key: string, seed: FilmSeed): Promise<Meta | null> {
  const data = await get<{ results?: RawResult[] }>(key, "search/multi", {
    query: seed.title,
    include_adult: "false",
  });
  const wantTv = seed.kind === "series";
  const yearOf = (r: RawResult) => Number((r.release_date ?? r.first_air_date ?? "").slice(0, 4)) || 0;
  const results = (data?.results ?? []).filter(
    (r) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path,
  );
  if (results.length === 0) return null;
  results.sort((a, b) => {
    const ka = a.media_type === (wantTv ? "tv" : "movie") ? 0 : 1;
    const kb = b.media_type === (wantTv ? "tv" : "movie") ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const da = Math.abs(yearOf(a) - seed.year);
    const db = Math.abs(yearOf(b) - seed.year);
    if (da !== db) return da - db;
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });
  const r = results[0];
  const isTv = r.media_type === "tv";
  return {
    id: `tmdb:${isTv ? "tv" : "movie"}:${r.id}`,
    type: isTv ? "series" : "movie",
    name: r.title ?? r.name ?? seed.title,
    poster: `${IMG}/w342${r.poster_path}`,
    background: r.backdrop_path ? `${IMG}/w780${r.backdrop_path}` : undefined,
    releaseInfo: String(yearOf(r) || seed.year),
    imdbRating: r.vote_average ? r.vote_average.toFixed(1) : undefined,
  } as Meta;
}

function tokenMatch(a: string, b: string): boolean {
  const ta = a.split(" ").filter(Boolean);
  const tb = b.split(" ").filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return false;
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const set = new Set(longer);
  return shorter.every((t) => set.has(t));
}

const ROLE_DEPARTMENT: Record<string, string> = {
  actor: "Acting",
  director: "Directing",
  writer: "Writing",
};

async function searchPerson(key: string, seed: PersonSeed): Promise<AwardPerson | null> {
  const data = await get<{ results?: RawResult[] }>(key, "search/person", {
    query: seed.name,
    include_adult: "false",
  });
  const want = norm(seed.name);
  const dept = ROLE_DEPARTMENT[classify(seed.role)] ?? "Acting";
  const named = (data?.results ?? []).filter((r) => r.id && r.name);
  const exact = named.filter((r) => norm(r.name!) === want);
  const matched = exact.length ? exact : named.filter((r) => tokenMatch(norm(r.name!), want));
  if (matched.length === 0) return null;
  const score = (r: RawResult) =>
    (!r.known_for_department || r.known_for_department === dept ? 1e6 : 0) + (r.popularity ?? 0);
  const r = matched.reduce((best, c) => (score(c) > score(best) ? c : best));
  return {
    id: r.id,
    name: r.name ?? seed.name,
    photo: r.profile_path ? `${IMG}/w342${r.profile_path}` : null,
    role: seed.role,
    work: seed.work,
    wins: seed.wins,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

async function resolveFilms(key: string, seeds: FilmSeed[]): Promise<Meta[]> {
  const hits = await mapLimit(seeds, 8, (s) => searchTitle(key, s));
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of hits) {
    if (!m || !m.poster || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

async function resolvePeople(key: string, seeds: PersonSeed[]): Promise<AwardPerson[]> {
  const hits = await mapLimit(seeds, 8, (s) => searchPerson(key, s));
  const seen = new Set<number>();
  const out: AwardPerson[] = [];
  for (const p of hits) {
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

const seedsMemo = new Map<AwardType, ReturnType<typeof buildSeeds>>();

function getSeeds(awardType: AwardType): ReturnType<typeof buildSeeds> {
  let s = seedsMemo.get(awardType);
  if (!s) {
    s = buildSeeds(awardType);
    seedsMemo.set(awardType, s);
  }
  return s;
}

function peopleCacheKey(awardType: AwardType): string {
  return `harbor.award.people.v1.${awardType}`;
}

function readPeopleCache(awardType: AwardType): AwardPeople | null {
  try {
    const raw = localStorage.getItem(peopleCacheKey(awardType));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AwardPeople;
    if (!parsed || !Array.isArray(parsed.actors)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePeopleCache(awardType: AwardType, data: AwardPeople): void {
  if (data.actors.length === 0 && data.directors.length === 0 && data.writers.length === 0) return;
  try {
    localStorage.setItem(peopleCacheKey(awardType), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

const peopleMemo = new Map<AwardType, AwardPeople>();
const peopleInflight = new Map<AwardType, Promise<AwardPeople>>();

export async function loadAwardPeople(tmdbKey: string, awardType: AwardType): Promise<AwardPeople> {
  if (!tmdbKey) return EMPTY_PEOPLE;
  const hit = peopleMemo.get(awardType);
  if (hit) return hit;
  const cached = readPeopleCache(awardType);
  if (cached) {
    peopleMemo.set(awardType, cached);
    return cached;
  }
  const existing = peopleInflight.get(awardType);
  if (existing) return existing;
  const p = (async () => {
    const seeds = getSeeds(awardType);
    const [actors, directors] = await Promise.all([
      resolvePeople(tmdbKey, seeds.actors),
      resolvePeople(tmdbKey, seeds.directors),
    ]);
    const writers = await resolvePeople(tmdbKey, seeds.writers);
    const data: AwardPeople = { actors, directors, writers };
    peopleMemo.set(awardType, data);
    writePeopleCache(awardType, data);
    return data;
  })();
  peopleInflight.set(awardType, p);
  try {
    return await p;
  } finally {
    peopleInflight.delete(awardType);
  }
}

type FilmState = { seeds: FilmSeed[]; resolved: Meta[]; ids: Set<string>; next: number };
const filmState = new Map<AwardType, FilmState>();

function filmStateFor(awardType: AwardType): FilmState {
  let s = filmState.get(awardType);
  if (!s) {
    s = { seeds: getSeeds(awardType).films, resolved: [], ids: new Set(), next: 0 };
    filmState.set(awardType, s);
  }
  return s;
}

export function awardFilmTotal(awardType: AwardType): number {
  return filmStateFor(awardType).seeds.length;
}

export async function loadAwardFilms(
  tmdbKey: string,
  awardType: AwardType,
  targetCount: number,
): Promise<{ films: Meta[]; done: boolean }> {
  if (!tmdbKey) return { films: [], done: true };
  const s = filmStateFor(awardType);
  while (s.resolved.length < targetCount && s.next < s.seeds.length) {
    const batch = s.seeds.slice(s.next, s.next + 12);
    s.next += batch.length;
    const metas = await resolveFilms(tmdbKey, batch);
    for (const m of metas) {
      if (s.ids.has(m.id)) continue;
      s.ids.add(m.id);
      s.resolved.push(m);
    }
  }
  return { films: s.resolved.slice(), done: s.next >= s.seeds.length };
}
