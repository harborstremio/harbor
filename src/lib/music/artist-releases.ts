import { safeFetch } from "@/lib/safe-fetch";
import { withTimeout } from "@/lib/progressive-rows";
import { resolveArtist } from "./artist-authority";
import { normalizeName } from "./search-normalize";
import { isRecentRelease } from "./release-recency";
import type { MusicTrack } from "./types";

export type FreshTrack = MusicTrack & { releaseDate: string };

type Obj = Record<string, unknown>;
type Release = { id: number; title: string; date: string; artwork: string };

const CACHE_MS = 30 * 60 * 1000;
const REQUEST_MS = 12_000;
const ARTIST_MS = 25_000;
const MAX_CACHE = 120;
const RELEASES_PER_ARTIST = 4;
const ALBUM_PAGE = 100;
const ALBUM_PAGES = 2;
const TRACKS_PER_RELEASE = 2;
const VARIANT =
  /\s*[([](?:deluxe|explicit|edited|clean|remaster|anniversary|expanded)[^)\]]*[)\]]\s*$/i;

const cache = new Map<string, { until: number; value: Obj }>();
const artists = new Map<string, { until: number; value: Promise<FreshTrack[]> }>();

function obj(value: unknown): Obj {
  return value !== null && typeof value === "object" ? (value as Obj) : {};
}

function rows(value: unknown): Obj[] {
  return Array.isArray(value) ? value.slice(0, ALBUM_PAGE).map(obj) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function image(...values: unknown[]): string {
  return values.map(text).find((value) => value.startsWith("https://")) ?? "";
}

function released(value: unknown): string {
  const date = text(value);
  return isRecentRelease(date) ? date : "";
}

function credited(target: string, candidate: string): boolean {
  const left = normalizeName(target);
  const right = normalizeName(candidate);
  if (!left || !right) return false;
  return left === right;
}

async function deezer(path: string, signal: AbortSignal): Promise<Obj> {
  signal.throwIfAborted();
  const saved = cache.get(path);
  if (saved && saved.until > Date.now()) return saved.value;
  const response = await safeFetch(`https://api.deezer.com/${path}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_MS)]),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Deezer releases are unavailable");
  const value = obj(await response.json());
  signal.throwIfAborted();
  if (value.error) throw new Error("Deezer releases are unavailable");
  cache.delete(path);
  cache.set(path, { until: Date.now() + CACHE_MS, value });
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  return value;
}

function deezerArtistId(id: string): number {
  return count(Number(/^deezer:artist:(\d+)$/.exec(id)?.[1] ?? 0));
}

async function artistId(name: string, signal: AbortSignal): Promise<number> {
  const ranking = await withTimeout(resolveArtist(name), 8_000).catch(() => null);
  signal.throwIfAborted();
  const canonical = deezerArtistId(ranking?.canonical?.id ?? "");
  if (canonical) return canonical;
  for (const cluster of ranking?.clusters ?? []) {
    for (const member of cluster.members) {
      const id = deezerArtistId(member.id);
      if (id) return id;
    }
  }
  const wanted = normalizeName(name);
  if (!wanted) return 0;
  const found = await deezer(`search/artist?q=${encodeURIComponent(name)}&limit=10`, signal);
  let best = 0;
  let fans = -1;
  for (const entry of rows(found?.data)) {
    const metric = count(entry.nb_fan);
    if (normalizeName(text(entry.name)) !== wanted || metric <= fans) continue;
    fans = metric;
    best = count(entry.id);
  }
  return best;
}

async function albumRows(artist: number, signal: AbortSignal): Promise<Obj[]> {
  const found: Obj[] = [];
  let total = 0;
  for (let page = 0; page < ALBUM_PAGES; page += 1) {
    const index = page * ALBUM_PAGE;
    if (page > 0 && index >= total) break;
    const body = await deezer(`artist/${artist}/albums?limit=${ALBUM_PAGE}&index=${index}`, signal).catch(
      (cause) => {
        if (page === 0) throw cause;
        return null;
      },
    );
    if (!body) break;
    const data = rows(body.data);
    found.push(...data);
    total = count(body.total);
    if (data.length < ALBUM_PAGE) break;
  }
  return found;
}

async function newestReleases(artist: number, signal: AbortSignal): Promise<Release[]> {
  const newest = new Map<string, Release>();
  for (const entry of await albumRows(artist, signal)) {
    const id = count(entry.id);
    const title = text(entry.title);
    const date = released(entry.release_date);
    if (!id || !title || !date) continue;
    const key = normalizeName(title.replace(VARIANT, ""));
    const held = newest.get(key);
    if (held && held.date >= date) continue;
    newest.set(key, {
      id,
      title,
      date,
      artwork: image(entry.cover_xl, entry.cover_big, entry.cover_medium),
    });
  }
  return [...newest.values()]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, RELEASES_PER_ARTIST);
}

function trackOf(entry: Obj, release: Release, artist: string): FreshTrack | null {
  const id = count(entry.id);
  const title = text(entry.title);
  const lead = text(obj(entry.artist).name);
  const credits = [...new Set([lead, ...rows(entry.contributors).map(person => text(person.name))].filter(Boolean))];
  if (!id || !title || !credits.some(name => credited(artist, name))) return null;
  const credit = credits.join(", ");
  const duration = count(entry.duration);
  if (!duration || !release.artwork || entry.readable === false) return null;
  return {
    id: `deezer:track:${id}`,
    sourceId: String(id),
    connectorId: "catalog",
    title,
    artist: credit,
    album: release.title,
    artwork: release.artwork,
    durationSeconds: duration,
    durationLabel: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
    explicit: typeof entry.explicit_lyrics === "boolean" ? entry.explicit_lyrics : undefined,
    releaseDate: release.date,
  };
}

async function releaseTracks(release: Release, artist: string, signal: AbortSignal): Promise<FreshTrack[]> {
  const body = await deezer(`album/${release.id}`, signal);
  const cover = release.artwork || image(body.cover_xl, body.cover_big, body.cover_medium);
  const picked: FreshTrack[] = [];
  const contributor = rows(body.contributors).some(person => credited(artist, text(person.name)));
  let creditLookups = 0;
  for (const entry of rows(obj(body.tracks).data)) {
    if (picked.length >= TRACKS_PER_RELEASE) break;
    let track = trackOf(entry, { ...release, artwork: cover }, artist);
    // Album track summaries omit collaborators. Verify the recording's credits rather than
    // discarding singles such as S3RL collaborations or attributing a whole compilation to him.
    if (!track && contributor && count(entry.id) && creditLookups++ < 4) {
      const detail = await deezer(`track/${count(entry.id)}`, signal);
      track = trackOf(detail, { ...release, artwork: cover }, artist);
    }
    if (track) picked.push(track);
  }
  return picked;
}

async function artistTracks(artist: string, signal: AbortSignal): Promise<FreshTrack[]> {
  const id = await artistId(artist, signal);
  if (!id) return [];
  const newest = await newestReleases(id, signal);
  if (newest.length === 0) return [];
  const settled = await Promise.allSettled(newest.map((release) => releaseTracks(release, artist, signal)));
  if (settled.every((result) => result.status === "rejected")) {
    throw settled[0]?.status === "rejected"
      ? settled[0].reason
      : new Error("Deezer releases are unavailable");
  }
  return settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((left, right) => right.releaseDate.localeCompare(left.releaseDate));
}

export async function loadArtistFreshTracks(artist: string, want: number): Promise<FreshTrack[]> {
  const key = normalizeName(artist);
  if (!key || want <= 0) return [];
  let entry = artists.get(key);
  if (!entry || entry.until <= Date.now()) {
    const controller = new AbortController();
    const value = withTimeout(artistTracks(artist, controller.signal), ARTIST_MS)
      .finally(() => controller.abort());
    entry = { until: Date.now() + CACHE_MS, value };
    artists.delete(key);
    artists.set(key, entry);
    while (artists.size > MAX_CACHE) artists.delete(artists.keys().next().value!);
    const current = entry;
    value.catch(() => { if (artists.get(key) === current) artists.delete(key); });
  }
  // Share pending work across focus events/remounts; recheck dates across midnight.
  return (await entry.value).filter((track) => isRecentRelease(track.releaseDate)).slice(0, want);
}
