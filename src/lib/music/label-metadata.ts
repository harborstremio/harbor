import { safeFetch } from "@/lib/safe-fetch";
import { scheduleMusicBrainzRequest } from "./recording-profile";
import { artistIdentityKey } from "./artist-authority";

export type MusicLabelRef = {
  id: string;
  name: string;
  releases: number;
};

export type MusicLabelProfile = {
  id: string;
  name: string;
  kind: string;
  country: string;
  began: string;
  ended: string;
  note: string;
  homepage: string;
  wikidata: string;
};

export type MusicLabelRelease = {
  id: string;
  title: string;
  artist: string;
  date: string;
};

const MB = "https://musicbrainz.org/ws/2";
const CACHE_MS = 30 * 60_000;
const PAGE = 100;
const MAX_LABELS = 4;
const MAX_ROSTER = 40;
const MAX_RELEASES = 24;
const MODERN_YEARS = 12;
const PLACEHOLDER = new Set(["157afde4-4bf5-4039-8ad2-5a15acc85176"]);

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const cache = new Map<string, { until: number; value: unknown }>();

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj =>
  value !== null && typeof value === "object" ? (value as Obj) : {};
const rows = (value: unknown): Obj[] => (Array.isArray(value) ? value.map(obj) : []);
const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 300) : "");

async function mb<T>(path: string, parse: (body: Obj) => T, signal?: AbortSignal): Promise<T> {
  const saved = cache.get(path);
  if (saved && saved.until > Date.now()) return saved.value as T;
  const value = await scheduleMusicBrainzRequest(async () => {
    const response = await safeFetch(`${MB}/${path}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Label metadata is unavailable");
    return parse(obj(await response.json()));
  }, signal);
  cache.set(path, { until: Date.now() + CACHE_MS, value });
  while (cache.size > 60) cache.delete(cache.keys().next().value!);
  return value;
}

export function labelByName(name: string, signal?: AbortSignal): Promise<MusicLabelRef | null> {
  const query = name.trim();
  if (query.length < 2) return Promise.resolve(null);
  return mb(
    `label?query=${encodeURIComponent(`label:"${query}"`)}&limit=5&fmt=json`,
    (body) => {
      const wanted = query.toLowerCase();
      const found = rows(body.labels)
        .map((row) => ({
          id: text(row.id),
          name: text(row.name),
          releases: typeof row.score === "number" ? row.score : 0,
        }))
        .filter((row) => uuid.test(row.id) && row.name && !PLACEHOLDER.has(row.id));
      return (
        found.find((row) => row.name.toLowerCase() === wanted) ??
        found.sort((a, b) => b.releases - a.releases)[0] ??
        null
      );
    },
    signal,
  );
}

const lucene = (value: string) => value.replace(/["\\]/g, " ").trim();

/**
 * A printed label name is ambiguous (MusicBrainz lists five Columbias); the release that
 * carries it is not. The album decides which company, and the name only breaks ties.
 */
export function labelForRelease(
  artist: string,
  album: string,
  printed: string,
  signal?: AbortSignal,
): Promise<MusicLabelRef | null> {
  const left = lucene(album);
  const right = lucene(artist);
  if (!left || !right) return labelByName(printed, signal);
  const query = `release:"${left}" AND artist:"${right}"`;
  return mb(
    `release?query=${encodeURIComponent(query)}&limit=10&fmt=json`,
    (body) => {
      const wanted = artistIdentityKey(printed);
      let fallback: MusicLabelRef | null = null;
      for (const release of rows(body.releases)) {
        for (const info of rows(release["label-info"])) {
          const label = obj(info.label);
          const id = text(label.id);
          const name = text(label.name);
          if (!id || !name || PLACEHOLDER.has(id)) continue;
          const ref = { id, name, releases: 0 };
          if (artistIdentityKey(name) === wanted) return ref;
          fallback ??= ref;
        }
      }
      return fallback;
    },
    signal,
  ).then((found) => found ?? labelByName(printed, signal));
}

export function artistLabels(artistId: string, signal?: AbortSignal): Promise<MusicLabelRef[]> {
  if (!uuid.test(artistId)) return Promise.resolve([]);
  return mb(
    `release?artist=${artistId}&inc=labels&limit=${PAGE}&fmt=json`,
    (body) => {
      const counts = new Map<string, MusicLabelRef>();
      for (const release of rows(body.releases)) {
        for (const info of rows(release["label-info"])) {
          const label = obj(info.label);
          const id = text(label.id);
          const name = text(label.name);
          if (!uuid.test(id) || !name || PLACEHOLDER.has(id)) continue;
          const found = counts.get(id);
          if (found) found.releases += 1;
          else counts.set(id, { id, name, releases: 1 });
        }
      }
      return [...counts.values()]
        .sort((a, b) => b.releases - a.releases)
        .slice(0, MAX_LABELS);
    },
    signal,
  );
}

function relationUrl(body: Obj, type: string): string {
  for (const relation of rows(body.relations)) {
    if (text(relation.type).toLowerCase() !== type) continue;
    const url = text(obj(relation.url).resource);
    if (url) return url;
  }
  return "";
}

export function labelProfile(labelId: string, signal?: AbortSignal): Promise<MusicLabelProfile | null> {
  if (!uuid.test(labelId)) return Promise.resolve(null);
  return mb(
    `label/${labelId}?inc=url-rels&fmt=json`,
    (body) => {
      const name = text(body.name);
      if (!name) return null;
      const span = obj(body["life-span"]);
      return {
        id: labelId,
        name,
        kind: text(body.type),
        country: text(body.country) || text(obj(body.area).name),
        began: text(span.begin),
        ended: text(span.end),
        note: text(body.disambiguation),
        homepage: relationUrl(body, "official homepage"),
        wikidata: relationUrl(body, "wikidata"),
      };
    },
    signal,
  );
}

/** Browse returns a label's oldest pressings first, so the roster is searched and dated. */
function labelSearchPath(labelId: string, offset = 0): string {
  const since = new Date().getFullYear() - MODERN_YEARS;
  const query = `laid:${labelId} AND date:[${since} TO *]`;
  const page = offset > 0 ? `&offset=${offset}` : "";
  return `release?query=${encodeURIComponent(query)}&limit=${PAGE}${page}&fmt=json`;
}

export function labelReleases(
  labelId: string,
  signal?: AbortSignal,
): Promise<MusicLabelRelease[]> {
  if (!uuid.test(labelId)) return Promise.resolve([]);
  return mb(
    labelSearchPath(labelId),
    (body) => {
      const seen = new Set<string>();
      const out: MusicLabelRelease[] = [];
      for (const release of rows(body.releases)) {
        const title = text(release.title);
        const artist = text(obj(rows(release["artist-credit"])[0]?.artist).name);
        const date = text(release.date);
        if (!title || !artist) continue;
        const key = `${artistIdentityKey(artist)}::${title.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: text(release.id), title, artist, date });
      }
      return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_RELEASES);
    },
    signal,
  );
}

function rosterCounts(body: Obj, counts: Map<string, { name: string; n: number }>): void {
  for (const release of rows(body.releases)) {
    for (const credit of rows(release["artist-credit"])) {
      const name = text(obj(credit.artist).name);
      if (!name) continue;
      const key = artistIdentityKey(name);
      const found = counts.get(key);
      if (found) found.n += 1;
      else counts.set(key, { name, n: 1 });
    }
  }
}

/** A major label's roster is far wider than one page of releases, so two are folded together. */
export async function labelRoster(labelId: string, signal?: AbortSignal): Promise<string[]> {
  if (!uuid.test(labelId)) return [];
  const counts = new Map<string, { name: string; n: number }>();
  const pages = await Promise.all(
    [0, PAGE].map((offset) =>
      mb(labelSearchPath(labelId, offset), (body) => body, signal).catch(() => null),
    ),
  );
  for (const body of pages) if (body) rosterCounts(body, counts);
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, MAX_ROSTER)
    .map((entry) => entry.name);
}


