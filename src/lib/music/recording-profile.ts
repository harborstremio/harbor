import { safeFetch } from "@/lib/safe-fetch";
import type { MusicAlbumRef, MusicArtistRef, MusicTrack } from "./types";

declare const __APP_VERSION__: string;
export const MUSICBRAINZ_HEADERS = {
  Accept: "application/json",
  "User-Agent": `Harbor/${typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev"} (https://github.com/harborstremio/harbor)`,
};

type Obj = Record<string, unknown>;
export type RecordingMatch = "provider-id" | "isrc" | "unique-title-artist";
export type RecordingCredit = {
  name: string;
  /** Provider role, normalized only for Deezer's Main/Featured labels. */
  role: string;
  artist: MusicArtistRef;
  source: "Deezer" | "MusicBrainz";
  sourceUrl: string;
  attributes?: string[];
  workTitle?: string;
};
export type RecordingProfile = {
  /** A separate catalog identity. Never replace the actual playback track with this object. */
  catalogTrack: MusicTrack;
  album: MusicAlbumRef;
  primaryArtist: MusicArtistRef;
  credits: RecordingCredit[];
  provenance: { source: "Deezer" | "MusicBrainz"; url: string; matchedBy: RecordingMatch }[];
  isrc?: string;
};

const obj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 300) : "");
const rows = (value: unknown): Obj[] => (Array.isArray(value) ? value.slice(0, 200).map(obj) : []);
const numericId = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const nameKey = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const key = (value: string) =>
  nameKey(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const cache = new Map<string, { until: number; data: Obj }>();
const MAX_BYTES = 512 * 1024;
let mbQueue: Promise<unknown> = Promise.resolve();
let nextMbRequest = 0;
let mbWaiting = 0;
let mbBackoffUntil = 0;

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** Shared with artist metadata: MusicBrainz requires at most one request per second per app. */
export function scheduleMusicBrainzRequest<T>(
  task: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (mbWaiting >= 12) return Promise.reject(new Error("MusicBrainz metadata queue is busy"));
  mbWaiting++;
  const pending = mbQueue
    .then(async () => {
      signal?.throwIfAborted();
      if (Date.now() < mbBackoffUntil)
        throw new Error("MusicBrainz metadata is temporarily unavailable");
      await wait(Math.max(0, nextMbRequest - Date.now()), signal);
      signal?.throwIfAborted();
      nextMbRequest = Date.now() + 1100;
      return task();
    })
    .finally(() => {
      mbWaiting--;
    });
  mbQueue = pending.catch(() => {});
  return pending;
}

async function readJson(response: Response, signal: AbortSignal): Promise<Obj> {
  const size = Number(response.headers.get("content-length"));
  if (size > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("Recording metadata is too large");
  }
  if (!response.body) throw new Error("Recording metadata has no body");
  const reader = response.body.getReader();
  const abort = () => {
    void reader.cancel(signal.reason).catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) throw new Error("Recording metadata is too large");
      chunks.push(value);
    }
    signal.throwIfAborted();
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return obj(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

async function json(url: string, signal: AbortSignal): Promise<Obj> {
  signal.throwIfAborted();
  const saved = cache.get(url);
  if (saved && saved.until > Date.now()) return saved.data;
  const musicBrainz = url.startsWith("https://musicbrainz.org/");
  const request = async () => {
    signal.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(
      () => controller.abort(new DOMException("Timed out", "TimeoutError")),
      6000,
    );
    try {
      const response = await safeFetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(musicBrainz ? { "User-Agent": "Harbor/0.9 (https://harbor.site)" } : {}),
        },
      });
      if (!response.ok) {
        if (musicBrainz && [429, 503].includes(response.status))
          mbBackoffUntil = Date.now() + 60_000;
        await response.body?.cancel();
        throw new Error("Recording metadata is unavailable");
      }
      const data = await readJson(response, controller.signal);
      controller.signal.throwIfAborted();
      if (data.error) throw new Error("Recording metadata is unavailable");
      const target = new URL(url);
      if (target.hostname === "api.deezer.com" && target.pathname.startsWith("/track/")) {
        const requested = target.pathname.slice(7);
        const expectedIsrc = requested.startsWith("isrc:")
          ? isrcCode(requested.slice(5))
          : undefined;
        const id = expectedIsrc ? numericId(data.id) : Number(requested);
        if (!id || !parseDeezerRecording(data, id, "provider-id", expectedIsrc))
          throw new Error("Recording metadata identity did not match");
      }
      cache.delete(url);
      cache.set(url, { until: Date.now() + 30 * 60_000, data });
      while (cache.size > 64) cache.delete(cache.keys().next().value!);
      return data;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  };
  return musicBrainz ? scheduleMusicBrainzRequest(request, signal) : request();
}

function isrcCode(value: unknown): string | undefined {
  const code = text(value).replace(/-/g, "").toUpperCase();
  return /^[A-Z]{2}[A-Z\d]{3}\d{7}$/.test(code) ? code : undefined;
}

function artistNames(artist: string): string[] {
  return artist
    .split(/\s+(?:feat\.?|ft\.?|featuring|with|&|x)\s+|,\s*/i)
    .map(nameKey)
    .filter(Boolean);
}

function titleIdentity(title: string, primaryArtist = ""): { title: string; featured: string[] } {
  let value = title.normalize("NFKC").trim();
  const prefix = /^(.+?)\s+[-–—]\s+(.+)$/.exec(value);
  if (prefix && nameKey(prefix[1]) === nameKey(primaryArtist)) value = prefix[2];
  // Only presentation labels are removed. Remix/live/acoustic/remaster/edit descriptors remain.
  value = value.replace(
    /[([]\s*(?:official(?: music)? video|official audio|lyrics?(?: video)?|visuali[sz]er|hd|hq|4k)\s*[)\]]/gi,
    " ",
  );
  const featured: string[] = [];
  const credit = (_: string, names: string) => {
    // A plain "feat. Guest (Remix)" suffix must not swallow the version marker.
    const version =
      /\s+(?=[([]|[-–—]\s)|\b(?:remix|live|acoustic|instrumental|karaoke|remaster(?:ed)?|edit|cover|sped up|slowed|nightcore)\b/i.exec(
        names,
      );
    featured.push(...artistNames(version ? names.slice(0, version.index) : names));
    return version ? ` ${names.slice(version.index)}` : " ";
  };
  value = value.replace(/[([]\s*(?:feat\.?|ft\.?|featuring|with)\s+([^\])]+)[)\]]/gi, credit);
  value = value.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i, credit);
  return { title: key(value), featured };
}

/** Checks recording identity without treating a music video's longer runtime as a different song. */
export function matchesRecordingCandidate(
  track: MusicTrack,
  candidate: unknown,
  requireFeatured = true,
): boolean {
  const data = obj(candidate);
  const artist = text(obj(data.artist).name);
  const inputArtists =
    nameKey(track.artist) === nameKey(artist) ? [nameKey(artist)] : artistNames(track.artist);
  if (!artist || !inputArtists.length || inputArtists[0] !== nameKey(artist)) return false;
  const requested = titleIdentity(track.title, artist);
  const version = text(data.title_version);
  const actualTitle = text(data.title);
  const actual = titleIdentity(
    version && !key(actualTitle).includes(key(version)) ? `${actualTitle} ${version}` : actualTitle,
    artist,
  );
  if (!requested.title || requested.title !== actual.title) return false;
  if (requireFeatured) {
    const credited = new Set([
      nameKey(artist),
      ...rows(data.contributors).map((person) => nameKey(text(person.name))),
      ...actual.featured,
    ]);
    if ([...inputArtists.slice(1), ...requested.featured].some((name) => !credited.has(name)))
      return false;
  }
  const video = track.mediaKind === "video" || /youtube/i.test(track.connectorId ?? "");
  if (
    !video &&
    typeof data.duration === "number" &&
    track.durationSeconds > 0 &&
    Math.abs(data.duration - track.durationSeconds) > Math.max(10, track.durationSeconds * 0.08)
  )
    return false;
  return true;
}

function artwork(value: unknown): string {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname.endsWith(".dzcdn.net") || url.hostname === "api.deezer.com")
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export function parseDeezerRecording(
  value: unknown,
  expectedId: number,
  matchedBy: RecordingMatch,
  expectedIsrc?: string,
): RecordingProfile | null {
  const data = obj(value),
    artist = obj(data.artist),
    album = obj(data.album);
  const id = numericId(data.id),
    artistId = numericId(artist.id),
    albumId = numericId(album.id);
  const isrc = isrcCode(data.isrc);
  if (
    data.error ||
    data.type !== "track" ||
    id !== expectedId ||
    !artistId ||
    !albumId ||
    !text(data.title) ||
    !text(artist.name) ||
    !text(album.title) ||
    (expectedIsrc && isrc !== expectedIsrc)
  )
    return null;
  const duration =
    typeof data.duration === "number" && Number.isFinite(data.duration) && data.duration > 0
      ? Math.round(data.duration)
      : 0;
  const cover = artwork(album.cover_xl) || artwork(album.cover_big) || artwork(album.cover_medium);
  const sourceUrl = `https://www.deezer.com/track/${id}`;
  const credits: RecordingCredit[] = [];
  for (const person of rows(data.contributors)) {
    const personId = numericId(person.id),
      name = text(person.name),
      suppliedRole = text(person.role);
    if (!personId || !name || !suppliedRole) continue;
    const role =
      suppliedRole === "Main"
        ? "main artist"
        : suppliedRole === "Featured"
          ? "featured artist"
          : suppliedRole.toLowerCase();
    if (
      credits.some(
        (credit) => credit.artist.id === `deezer:artist:${personId}` && credit.role === role,
      )
    )
      continue;
    credits.push({
      name,
      role,
      artist: { id: `deezer:artist:${personId}`, connectorId: "catalog", name },
      source: "Deezer",
      sourceUrl,
    });
  }
  return {
    catalogTrack: {
      id: `deezer:track:${id}`,
      sourceId: String(id),
      connectorId: "catalog",
      title: text(data.title),
      artist: text(artist.name),
      album: text(album.title),
      artwork: cover,
      durationSeconds: duration,
      durationLabel: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
    },
    album: {
      id: `deezer:album:${albumId}`,
      connectorId: "catalog",
      title: text(album.title),
      artist: text(artist.name),
      artwork: cover,
    },
    primaryArtist: {
      id: `deezer:artist:${artistId}`,
      connectorId: "catalog",
      name: text(artist.name),
    },
    credits,
    provenance: [{ source: "Deezer", url: sourceUrl, matchedBy }],
    isrc,
  };
}

/** Reads only artist relationships attached to this verified recording or its performed works. */
export function parseMusicBrainzRecordingCredits(
  value: unknown,
  recordingId: string,
  expectedIsrc: string,
  track: MusicTrack,
): RecordingCredit[] {
  const data = obj(value);
  if (
    !uuid.test(recordingId) ||
    data.id !== recordingId ||
    !Array.isArray(data.isrcs) ||
    !data.isrcs.includes(expectedIsrc)
  )
    return [];
  const artists = rows(data["artist-credit"]).map((entry) => obj(entry.artist));
  if (
    !matchesRecordingCandidate(track, {
      title: data.title,
      title_version: data.disambiguation,
      artist: artists[0],
      contributors: artists,
      duration: typeof data.length === "number" ? data.length / 1000 : undefined,
    })
  )
    return [];
  const result: RecordingCredit[] = [];
  const read = (relations: unknown, sourceUrl: string, workTitle?: string) => {
    for (const relation of rows(relations)) {
      const person = obj(relation.artist),
        id = text(person.id),
        name = text(person.name),
        role = text(relation.type);
      const allowed = workTitle
        ? ["composer", "lyricist", "writer", "arranger", "librettist", "translator"]
        : [
            "producer",
            "mix",
            "engineer",
            "mastering",
            "recording",
            "instrument",
            "vocal",
            "performer",
            "arranger",
            "remixer",
            "conductor",
            "orchestrator",
          ];
      if (!uuid.test(id) || !name || !allowed.includes(role)) continue;
      const attributes = Array.isArray(relation.attributes)
        ? relation.attributes.map(text).filter(Boolean).slice(0, 8)
        : [];
      result.push({
        name,
        role,
        artist: { id: `musicbrainz:artist:${id}`, connectorId: "catalog", name, musicBrainzId: id },
        source: "MusicBrainz",
        sourceUrl,
        attributes,
        ...(workTitle ? { workTitle } : {}),
      });
    }
  };
  read(data.relations, `https://musicbrainz.org/recording/${recordingId}`);
  for (const relation of rows(data.relations)) {
    const work = obj(relation.work),
      id = text(work.id),
      title = text(work.title);
    if (relation.type === "performance" && uuid.test(id) && title)
      read(work.relations, `https://musicbrainz.org/work/${id}`, title);
  }
  return [
    ...new Map(
      result.map((credit) => [
        `${credit.artist.id}:${credit.role}:${credit.workTitle ?? ""}:${credit.attributes?.join(",")}`,
        credit,
      ]),
    ).values(),
  ].slice(0, 80);
}

async function uniqueDeezerMatch(track: MusicTrack, signal: AbortSignal): Promise<Obj | null> {
  const artist = text(track.artist);
  const primary = artistNames(artist)[0];
  const title = titleIdentity(track.title, artist).title;
  if (!primary || !title) return null;
  const found: Obj[] = [];
  for (let index = 0; index < 200; index += 100) {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=100&index=${index}`;
    const page = await json(url, signal);
    if (
      !Array.isArray(page.data) ||
      typeof page.total !== "number" ||
      !Number.isSafeInteger(page.total) ||
      page.total < 0 ||
      page.total > 200
    )
      return null;
    found.push(...rows(page.data));
    if (!page.next && found.length >= page.total) break;
    if (index === 100 || !page.data.length) return null;
  }
  let candidates = [
    ...new Map(
      found
        .filter((value) => numericId(value.id) && matchesRecordingCandidate(track, value, false))
        .map((value) => [value.id, value]),
    ).values(),
  ];
  // An explicitly supplied album may disambiguate releases; a video title is never treated as an album.
  if (candidates.length > 1 && track.album && !/^(?:single|unknown album)$/i.test(track.album)) {
    candidates = candidates.filter(
      (value) => key(text(obj(value.album).title)) === key(track.album!),
    );
  }
  if (!candidates.length || candidates.length > 4) return null;
  const verified = (
    await Promise.all(
      candidates.map(async (candidate) => {
        const value = await json(`https://api.deezer.com/track/${candidate.id}`, signal);
        return value.id === candidate.id && matchesRecordingCandidate(track, value) ? value : null;
      }),
    )
  ).filter((value): value is Obj => value !== null);
  return verified.length === 1 ? verified[0] : null;
}

async function resolveRecordingProfile(
  track: MusicTrack & { isrc?: string },
  signal?: AbortSignal,
): Promise<RecordingProfile | null> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Timed out", "TimeoutError")),
    15_000,
  );
  let profile: RecordingProfile | null = null;
  try {
    const declaredIsrc = isrcCode(track.isrc);
    const direct = ["catalog", "deezer"].includes(track.connectorId ?? "")
      ? (/^deezer:track:([1-9]\d*)$/.exec(track.id)?.[1] ??
        (track.connectorId === "deezer"
          ? /^[1-9]\d*$/.exec(track.sourceId ?? track.id)?.[0]
          : undefined))
      : undefined;
    let data: Obj | null, matchedBy: RecordingMatch;
    if (direct && Number.isSafeInteger(Number(direct))) {
      data = await json(`https://api.deezer.com/track/${direct}`, controller.signal);
      matchedBy = "provider-id";
      if (data.id !== Number(direct)) return null;
    } else if (declaredIsrc) {
      data = await json(`https://api.deezer.com/track/isrc:${declaredIsrc}`, controller.signal);
      matchedBy = "isrc";
    } else {
      data = await uniqueDeezerMatch(track, controller.signal);
      matchedBy = "unique-title-artist";
    }
    if (!data || !numericId(data.id)) return null;
    profile = parseDeezerRecording(data, data.id as number, matchedBy, declaredIsrc);
    if (!profile?.isrc) return profile;
    const lookup = await json(
      `https://musicbrainz.org/ws/2/isrc/${profile.isrc}?inc=artist-credits&fmt=json`,
      controller.signal,
    );
    if (
      lookup.isrc !== profile.isrc ||
      !Array.isArray(lookup.recordings) ||
      lookup.recordings.length >= 25
    )
      return profile;
    const candidates = rows(lookup.recordings).filter((recording) => {
      const artists = rows(recording["artist-credit"]).map((entry) => obj(entry.artist));
      return (
        uuid.test(text(recording.id)) &&
        matchesRecordingCandidate(profile!.catalogTrack, {
          title: recording.title,
          title_version: recording.disambiguation,
          artist: artists[0],
          contributors: artists,
          duration: typeof recording.length === "number" ? recording.length / 1000 : undefined,
        })
      );
    });
    const ids = [...new Set(candidates.map((recording) => text(recording.id)))];
    if (ids.length !== 1) return profile;
    const recording = await json(
      `https://musicbrainz.org/ws/2/recording/${ids[0]}?inc=isrcs%2Bartist-credits%2Bartist-rels%2Bwork-rels%2Bwork-level-rels&fmt=json`,
      controller.signal,
    );
    const credits = parseMusicBrainzRecordingCredits(
      recording,
      ids[0],
      profile.isrc,
      profile.catalogTrack,
    );
    if (credits.length) {
      profile = {
        ...profile,
        credits: [...profile.credits, ...credits],
        provenance: [
          ...profile.provenance,
          {
            source: "MusicBrainz",
            url: `https://musicbrainz.org/recording/${ids[0]}`,
            matchedBy: "isrc",
          },
        ],
      };
    }
    controller.signal.throwIfAborted();
    return profile;
  } catch {
    signal?.throwIfAborted();
    return profile;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

type ProfileInput = MusicTrack & { isrc?: string };
type PendingProfile = {
  promise: Promise<RecordingProfile | null>;
  controller: AbortController;
  users: number;
  done: boolean;
};
const profiles = new Map<string, { until: number; profile: RecordingProfile }>();
const pendingProfiles = new Map<string, PendingProfile>();

function copyProfile(profile: RecordingProfile | null): RecordingProfile | null {
  return (
    profile && {
      ...profile,
      catalogTrack: { ...profile.catalogTrack },
      album: { ...profile.album },
      primaryArtist: { ...profile.primaryArtist },
      credits: profile.credits.map((credit) => ({
        ...credit,
        artist: { ...credit.artist },
        attributes: credit.attributes?.slice(),
      })),
      provenance: profile.provenance.map((source) => ({ ...source })),
    }
  );
}

/** Deduplicates dock/detail lookups without allowing one component to cancel another's request. */
export function loadRecordingProfile(
  track: ProfileInput,
  signal?: AbortSignal,
): Promise<RecordingProfile | null> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  const identity = JSON.stringify([
    track.connectorId,
    track.id,
    track.sourceId,
    track.isrc,
    track.title,
    track.artist,
    track.album,
    track.mediaKind,
    track.durationSeconds,
  ]);
  const saved = profiles.get(identity);
  if (saved && saved.until > Date.now()) return Promise.resolve(copyProfile(saved.profile));
  let pending = pendingProfiles.get(identity);
  if (!pending || pending.controller.signal.aborted) {
    if (pendingProfiles.size >= 24) return Promise.resolve(null);
    const entry: PendingProfile = {
      promise: Promise.resolve(null),
      controller: new AbortController(),
      users: 0,
      done: false,
    };
    pendingProfiles.set(identity, entry);
    entry.promise = resolveRecordingProfile({ ...track }, entry.controller.signal)
      .then((profile) => {
        if (profile && !entry.controller.signal.aborted) {
          profiles.delete(identity);
          profiles.set(identity, {
            until:
              Date.now() +
              (profile.provenance.some((source) => source.source === "MusicBrainz") ? 30 : 5) *
                60_000,
            profile,
          });
          while (profiles.size > 80) profiles.delete(profiles.keys().next().value!);
        }
        return profile;
      })
      .finally(() => {
        entry.done = true;
        if (pendingProfiles.get(identity) === entry) pendingProfiles.delete(identity);
      });
    pending = entry;
  }
  const shared = pending;
  shared.users++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value: RecordingProfile | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      shared.users--;
      if (!shared.done && shared.users === 0) shared.controller.abort();
      if (error !== undefined) reject(error);
      else resolve(copyProfile(value));
    };
    const abort = () => finish(null, signal?.reason ?? new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    shared.promise.then(
      (value) => finish(value),
      (error) => finish(null, error),
    );
  });
}
