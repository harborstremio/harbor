import { invoke } from "@tauri-apps/api/core";
import { safeFetch } from "@/lib/safe-fetch";
import { getSecret, loadSecrets } from "@/lib/secret-store";
import { stationTracks } from "./catalog";
import { LASTFM_API_KEY } from "./lastfm";
import { getMusicState, setMusicQueue, subscribeMusic } from "./player";
import { loadRecordingProfile } from "./recording-profile";
import { artistCreditParts } from "./search-artists";
import { normalizeName, normalizeTitle } from "./search-normalize";
import { searchMusic } from "./sources";
import type { MusicSourceCandidate, MusicTrack } from "./types";

type Obj = Record<string, unknown>;
type Lane = "lastfm" | "youtube" | "deezerRadio" | "related";
type Features = { bpm?: number; gain?: number; year?: number; genres: number[] };
type Seed = MusicTrack & { deezerId?: number; artistId?: number; features: Features };
type Candidate = {
  track: MusicTrack;
  key: string;
  deezerId?: number;
  lanes: Map<Lane, number>;
  features?: Features;
  score: number;
};

const STATION_SIZE = 40;
const EXTEND_SIZE = 18;
const EXTEND_AT = 4;
const LANE_MS = 7000;
const FEATURE_LOOKUPS = 36;
const LANE_WEIGHT: Record<Lane, number> = {
  lastfm: 1,
  youtube: 0.9,
  deezerRadio: 0.7,
  related: 0.6,
};
const VARIANT =
  /\b(karaoke|instrumental|tribute|cover|sped ?up|slowed|nightcore|8d|reverb|remix|live at|acoustic version|piano version|ringtone|made popular|originally performed|in the style of)\b/i;

const dzCache = new Map<string, { until: number; value: Obj }>();
const dzPending = new Map<string, Promise<Obj>>();
const obj = (value: unknown): Obj =>
  value !== null && typeof value === "object" ? (value as Obj) : {};
const rows = (value: unknown): Obj[] => (Array.isArray(value) ? value.slice(0, 120).map(obj) : []);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const image = (...values: unknown[]): string =>
  values.map(text).find((value) => value.startsWith("https://")) ?? "";
const deezerNumeric = (id: string | undefined, kind: string): number | undefined => {
  const found = new RegExp(`^deezer:${kind}:(\\d+)$`).exec(id ?? "")?.[1];
  return found ? Number(found) : undefined;
};

function bounded<T>(work: Promise<T>, ms = LANE_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("music.radio.error")), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function deezer(path: string): Promise<Obj> {
  const saved = dzCache.get(path);
  if (saved && saved.until > Date.now()) return saved.value;
  const pending = dzPending.get(path);
  if (pending) return pending;
  const request = (async () => {
    const response = await safeFetch(`https://api.deezer.com/${path}`, {
      signal: AbortSignal.timeout(LANE_MS),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("music.radio.error");
    const value = obj(await response.json());
    if (value.error) throw new Error("music.radio.error");
    dzCache.set(path, { until: Date.now() + 20 * 60_000, value });
    while (dzCache.size > 160) dzCache.delete(dzCache.keys().next().value!);
    return value;
  })().finally(() => dzPending.delete(path));
  dzPending.set(path, request);
  return request;
}

async function lastfm(params: Record<string, string>): Promise<Obj | null> {
  await loadSecrets();
  const key = getSecret(LASTFM_API_KEY);
  if (!key) return null;
  const query = new URLSearchParams({ ...params, api_key: key, format: "json", autocorrect: "1" });
  const response = await safeFetch(`https://ws.audioscrobbler.com/2.0/?${query}`, {
    signal: AbortSignal.timeout(LANE_MS),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const value = obj(await response.json());
  return value.error ? null : value;
}

function trackKey(track: Pick<MusicTrack, "title" | "artist">): string {
  const lead = artistCreditParts(track.artist)[0] ?? track.artist;
  return `${normalizeTitle(track.title)}|${normalizeName(lead)}`;
}

function deezerTrack(entry: Obj): MusicTrack | null {
  const id = num(entry.id);
  const title = text(entry.title);
  const artist = text(obj(entry.artist).name);
  if (!id || !title || !artist) return null;
  const album = obj(entry.album);
  const duration = Math.max(0, Math.floor(num(entry.duration) ?? 0));
  return {
    id: `deezer:track:${id}`,
    sourceId: String(id),
    connectorId: "catalog",
    title,
    artist,
    album: text(album.title) || undefined,
    artwork: image(album.cover_xl, album.cover_big, album.cover_medium),
    durationSeconds: duration,
    durationLabel: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
    explicit: typeof entry.explicit_lyrics === "boolean" ? entry.explicit_lyrics : undefined,
  };
}

function year(value: unknown): number | undefined {
  const found = /^(\d{4})-\d{2}-\d{2}$/.exec(text(value))?.[1];
  return found && found !== "0000" ? Number(found) : undefined;
}

async function trackFeatures(deezerId: number): Promise<Features> {
  const track = await deezer(`track/${deezerId}`);
  const albumId = num(obj(track.album).id);
  const album = albumId ? await deezer(`album/${albumId}`).catch(() => ({}) as Obj) : {};
  return {
    bpm: num(track.bpm) || undefined,
    gain: num(track.gain),
    year: year(track.release_date) ?? year(album.release_date),
    genres: rows(obj(album.genres).data)
      .map((entry) => num(entry.id) ?? 0)
      .filter(Boolean),
  };
}

async function resolveSeed(track: MusicTrack): Promise<Seed> {
  const profile = await bounded(loadRecordingProfile(track)).catch(() => null);
  const deezerId = deezerNumeric(profile?.catalogTrack.id ?? track.id, "track");
  const artistId = deezerNumeric(profile?.primaryArtist.id, "artist");
  const features = deezerId
    ? await trackFeatures(deezerId).catch(() => ({ genres: [] }))
    : { genres: [] };
  return { ...track, deezerId, artistId, features };
}

function youtubeId(track: MusicTrack): string | null {
  if (!["youtube", "youtube_music"].includes(track.connectorId ?? "")) return null;
  const id = track.sourceId ?? track.id.replace(/^(?:youtube_music|youtube):/, "");
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}

async function youtubeLane(seed: Seed): Promise<[MusicTrack, number][]> {
  let id = youtubeId(seed);
  if (!id) {
    const candidates = await bounded(
      invoke<MusicSourceCandidate[]>("music_source_candidates", { track: seed }),
    );
    id =
      candidates
        .filter((candidate) => candidate.health !== "offline")
        .map((candidate) => youtubeId(candidate.track))
        .find(Boolean) ?? null;
  }
  if (!id) return [];
  const list = await bounded(
    stationTracks({
      id: `RDAMVM${id}`,
      connectorId: "youtube_music",
      name: seed.title,
      artwork: seed.artwork,
    }),
  );
  return list.map((track, index) => [
    { ...track, mediaKind: "audio" as const },
    1 - index / Math.max(1, list.length),
  ]);
}

async function deezerRadioLane(seed: Seed): Promise<[MusicTrack, number][]> {
  if (!seed.artistId) return [];
  const list = rows((await deezer(`artist/${seed.artistId}/radio?limit=40`)).data)
    .map(deezerTrack)
    .filter((track): track is MusicTrack => !!track);
  return list.map((track, index) => [track, 1 - index / Math.max(1, list.length)]);
}

async function relatedLane(seed: Seed): Promise<[MusicTrack, number][]> {
  if (!seed.artistId) return [];
  const RELATED_DEPTH = 14;
  const found = rows((await deezer(`artist/${seed.artistId}/related?limit=${RELATED_DEPTH}`)).data);
  const best = new Map<string, Obj>();
  for (const artist of found) {
    const name = text(artist.name).toLowerCase();
    if (!name) continue;
    const held = best.get(name);
    if (!held || (num(artist.nb_fan) ?? 0) > (num(held.nb_fan) ?? 0)) best.set(name, artist);
  }
  const related = [...best.values()].slice(0, 12);
  const tops = await Promise.all(
    related.map((artist, rank) =>
      deezer(`artist/${num(artist.id)}/top?limit=5`)
        .then((page) =>
          rows(page.data)
            .map(deezerTrack)
            .filter((track): track is MusicTrack => !!track)
            .map((track, index): [MusicTrack, number] => [
              track,
              (1 - rank / RELATED_DEPTH) * (1 - index / 10),
            ]),
        )
        .catch(() => [] as [MusicTrack, number][]),
    ),
  );
  return tops.flat();
}

async function lastfmLane(seed: Seed): Promise<[MusicTrack, number][]> {
  const lead = artistCreditParts(seed.artist)[0] ?? seed.artist;
  const value = await lastfm({
    method: "track.getSimilar",
    artist: lead,
    track: seed.title,
    limit: "60",
  });
  const similar = rows(obj(value?.similartracks).track)
    .map((entry) => ({
      title: text(entry.name),
      artist: text(obj(entry.artist).name),
      match: num(entry.match) ?? 0,
    }))
    .filter((entry) => entry.title && entry.artist && entry.match > 0.05)
    .slice(0, 16);
  const found = await Promise.all(
    similar.map(async (entry) => {
      const hits = await bounded(searchMusic(`${entry.artist} ${entry.title}`, 4), 5000).catch(
        () => [] as MusicTrack[],
      );
      const wanted = `${normalizeTitle(entry.title)}|${normalizeName(entry.artist)}`;
      const exact =
        hits.find((hit) => trackKey(hit) === wanted) ??
        hits.find(
          (hit) =>
            normalizeTitle(hit.title) === normalizeTitle(entry.title) &&
            normalizeName(hit.artist).includes(normalizeName(entry.artist)),
        );
      return exact ? ([exact, entry.match] as [MusicTrack, number]) : null;
    }),
  );
  return found.filter((entry): entry is [MusicTrack, number] => !!entry);
}

function affinity(seed: Features, candidate: Features | undefined): number {
  if (!candidate) return 0;
  let bonus = 0;
  if (seed.bpm && candidate.bpm) {
    const delta = Math.min(
      Math.abs(seed.bpm - candidate.bpm),
      Math.abs(seed.bpm - candidate.bpm * 2),
      Math.abs(seed.bpm * 2 - candidate.bpm),
    );
    bonus += 0.15 * (1 - Math.min(1, delta / 25));
  }
  if (seed.year && candidate.year)
    bonus += 0.08 * (1 - Math.min(1, Math.abs(seed.year - candidate.year) / 12));
  if (seed.gain !== undefined && candidate.gain !== undefined)
    bonus += 0.05 * (1 - Math.min(1, Math.abs(seed.gain - candidate.gain) / 6));
  if (seed.genres.length && candidate.genres.some((id) => seed.genres.includes(id))) bonus += 0.1;
  return bonus;
}

async function gather(seeds: Seed[], exclude: Set<string>): Promise<Candidate[]> {
  const pool = new Map<string, Candidate>();
  const seedIsVariant = seeds.some((seed) => VARIANT.test(seed.title));
  const lanes: [Lane, (seed: Seed) => Promise<[MusicTrack, number][]>][] = [
    ["lastfm", lastfmLane],
    ["youtube", youtubeLane],
    ["deezerRadio", deezerRadioLane],
    ["related", relatedLane],
  ];
  const settled = await Promise.allSettled(
    seeds.flatMap((seed) =>
      lanes.map(async ([lane, run]) => [lane, await bounded(run(seed))] as const),
    ),
  );
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const [lane, list] = result.value;
    for (const [track, position] of list) {
      const key = trackKey(track);
      if (exclude.has(key) || (!seedIsVariant && VARIANT.test(track.title))) continue;
      const entry = pool.get(key) ?? {
        track,
        key,
        deezerId: deezerNumeric(track.id, "track"),
        lanes: new Map(),
        score: 0,
      };
      entry.lanes.set(lane, Math.max(entry.lanes.get(lane) ?? 0, position));
      if (!entry.deezerId) entry.deezerId = deezerNumeric(track.id, "track");
      if (
        entry.track.connectorId === "catalog" &&
        track.connectorId &&
        track.connectorId !== "catalog"
      )
        entry.track = track;
      pool.set(key, entry);
    }
  }
  return [...pool.values()];
}

async function enrich(candidates: Candidate[]): Promise<void> {
  const wanted = candidates.filter((candidate) => candidate.deezerId).slice(0, FEATURE_LOOKUPS);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (cursor < wanted.length) {
        const candidate = wanted[cursor++];
        candidate.features = await trackFeatures(candidate.deezerId!).catch(() => undefined);
      }
    }),
  );
}

function rank(seed: Seed, candidates: Candidate[]): Candidate[] {
  const state = getMusicState();
  const familiar = new Set([...state.recents, ...state.likedTracks].map(trackKey));
  const seedLead = normalizeName(artistCreditParts(seed.artist)[0] ?? seed.artist);
  for (const candidate of candidates) {
    let score = 0;
    for (const [lane, position] of candidate.lanes) score += LANE_WEIGHT[lane] * position;
    if (candidate.lanes.size >= 2) score += 0.2 * (candidate.lanes.size - 1);
    score += affinity(seed.features, candidate.features);
    if (familiar.has(candidate.key)) score += 0.05;
    if (
      normalizeName(artistCreditParts(candidate.track.artist)[0] ?? candidate.track.artist) ===
      seedLead
    )
      score -= 0.15;
    candidate.score = score;
  }
  candidates.sort((left, right) => right.score - left.score);
  const perArtist = new Map<string, number>();
  const ordered: Candidate[] = [];
  const deferred: Candidate[] = [];
  let familiarCount = 0;
  for (const candidate of candidates) {
    const lead = normalizeName(
      artistCreditParts(candidate.track.artist)[0] ?? candidate.track.artist,
    );
    const seen = perArtist.get(lead) ?? 0;
    const known = familiar.has(candidate.key);
    if (
      seen >= (ordered.length < 30 ? 2 : 3) ||
      (known && familiarCount >= Math.ceil(STATION_SIZE / 5))
    ) {
      deferred.push(candidate);
      continue;
    }
    perArtist.set(lead, seen + 1);
    if (known) familiarCount += 1;
    ordered.push(candidate);
  }
  const spaced: Candidate[] = [];
  const rest = [...ordered, ...deferred];
  while (rest.length) {
    const previous = spaced.at(-1);
    const previousLead = previous
      ? normalizeName(artistCreditParts(previous.track.artist)[0] ?? previous.track.artist)
      : "";
    const index = rest.findIndex(
      (candidate) =>
        normalizeName(artistCreditParts(candidate.track.artist)[0] ?? candidate.track.artist) !==
        previousLead,
    );
    spaced.push(rest.splice(index < 0 ? 0 : index, 1)[0]);
  }
  return spaced;
}

async function build(seeds: Seed[], exclude: Set<string>, size: number): Promise<MusicTrack[]> {
  const candidates = await gather(seeds, exclude);
  await enrich(candidates);
  return rank(seeds[0], candidates)
    .slice(0, size)
    .map((candidate) => ({ ...candidate.track, mediaKind: "audio" as const }));
}

const SEED_ARTIST_TARGET = 4;

/** Wanting more of a song usually means wanting a little more of who made it, not a solo mix. */
async function withSeedArtist(
  seed: Seed,
  track: MusicTrack,
  mix: MusicTrack[],
): Promise<MusicTrack[]> {
  if (!seed.artistId) return mix;
  const credited = new Set(
    [track.artist, ...artistCreditParts(track.artist)].map(normalizeName).filter(Boolean),
  );
  const leadOf = (entry: MusicTrack) =>
    normalizeName(artistCreditParts(entry.artist)[0] ?? entry.artist);
  const held = mix.filter((entry) => credited.has(leadOf(entry))).length;
  const want = SEED_ARTIST_TARGET - held;
  if (want <= 0) return mix;
  const seen = new Set([trackKey(track), ...mix.map(trackKey)]);
  const page = await deezer(`artist/${seed.artistId}/top?limit=12`).catch(() => ({}) as Obj);
  const extra: MusicTrack[] = [];
  for (const entry of rows(page.data)) {
    const candidate = deezerTrack(entry);
    if (!candidate || seen.has(trackKey(candidate))) continue;
    seen.add(trackKey(candidate));
    extra.push({ ...candidate, mediaKind: "audio" });
    if (extra.length >= want) break;
  }
  if (!extra.length) return mix;
  const out = [...mix];
  extra.forEach((entry, index) => out.splice(Math.min(out.length, 3 + index * 6), 0, entry));
  return out;
}

export async function loadSimilarTracks(track: MusicTrack): Promise<MusicTrack[]> {
  const seed = await resolveSeed(track);
  const following = await build([seed], new Set([trackKey(track)]), STATION_SIZE);
  if (following.length < 5) throw new Error("music.radio.error");
  return withSeedArtist(seed, track, following);
}

export async function loadTrackRadio(track: MusicTrack): Promise<MusicTrack[]> {
  const seed = await resolveSeed(track);
  const following = await build([seed], new Set([trackKey(track)]), STATION_SIZE);
  if (following.length < 5) throw new Error("music.radio.error");
  return [{ ...track, mediaKind: "audio" }, ...following];
}

let armed: { seedKey: string; stop: () => void; extending: boolean } | null = null;

export function disarmTrackRadio(): void {
  armed?.stop();
  armed = null;
}

export function armTrackRadio(station: MusicTrack[]): void {
  disarmTrackRadio();
  const seedKey = trackKey(station[0]);
  const station_ = { seedKey, extending: false, stop: () => {} };
  station_.stop = subscribeMusic(() => {
    const state = getMusicState();
    const queue = state.queue;
    if (!queue.length || trackKey(queue[0]) !== seedKey) {
      disarmTrackRadio();
      return;
    }
    if (station_.extending || state.queueIndex < 0 || state.queueIndex < queue.length - EXTEND_AT)
      return;
    station_.extending = true;
    const recent = queue.slice(Math.max(0, state.queueIndex - 2), state.queueIndex + 1);
    void Promise.all(recent.map(resolveSeed))
      .then((seeds) => build(seeds, new Set(queue.map(trackKey)), EXTEND_SIZE))
      .then((more) => {
        const latest = getMusicState().queue;
        if (armed !== station_ || !latest.length || trackKey(latest[0]) !== seedKey || !more.length)
          return;
        setMusicQueue([...latest, ...more]);
      })
      .catch(() => {})
      .finally(() => {
        station_.extending = false;
      });
  });
  armed = station_;
}
