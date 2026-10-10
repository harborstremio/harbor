import { lruGet, lruSet } from "@/lib/cache";
import { dwarn } from "@/lib/debug";
import { safeFetch } from "@/lib/safe-fetch";
import {
  DECISIVE_DECADES,
  artistIdentityKey,
  displayClusters,
  outrankedNamesake,
  parseAudience,
  rankArtistCandidates,
} from "./artist-popularity";
import type { ArtistCandidate, ArtistRanking } from "./artist-popularity";
import type { MusicArtistRef, MusicTrack } from "./types";

export { artistIdentityKey, displayClusters };

type Entry = { at: number; ttl: number; value: Promise<ArtistRanking>; ready?: ArtistRanking };
type Hint = { at: number; ttl: number; refs: MusicArtistRef[]; ranking: ArtistRanking };
export type ResolveOptions = { track?: MusicTrack; hint?: MusicArtistRef[] };
export type ArtistIdentityView = { ranking: ArtistRanking | null; probed: boolean };
type Row = Record<string, unknown>;
type Payload = { ok: boolean; body: Row | null };

const RANKING_MAX = 300;
const HINT_MAX = 900;
const MEASURED_TTL = 24 * 60 * 60_000;
const EMPTY_TTL = 60 * 60_000;
const FAILED_TTL = 5 * 60_000;
const HINT_TTL = 60 * 60_000;
const SEARCH_LIMIT = 40;
const TOPIC_QUERY = /\s*-\s*topic\s*$/i;

const rankings = new Map<string, Entry>();
const hints = new Map<string, Hint>();
const warned = new Set<string>();

const emptyRanking = (key: string): ArtistRanking => ({
  key,
  clusters: [],
  canonical: null,
  ambiguous: false,
  measured: false,
});

const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object") : [];
const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
const text = (value: unknown) => (typeof value === "string" ? value : "");
const object = (value: unknown): Row => (value && typeof value === "object" ? (value as Row) : {});
const fresh = (entry: { at: number; ttl: number } | undefined): boolean =>
  entry !== undefined && Date.now() - entry.at < entry.ttl;
const refKey = (ref: { connectorId: string; id: string }) => `${ref.connectorId}:${ref.id}`;
const probeQuery = (name: string) => name.replace(TOPIC_QUERY, "").trim() || name.trim();

async function deezerJson(url: string): Promise<Payload> {
  try {
    const response = await safeFetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return { ok: false, body: null };
    const value = await response.json();
    return { ok: true, body: value && typeof value === "object" ? (value as Row) : null };
  } catch {
    return { ok: false, body: null };
  }
}

function artistCandidate(row: Row, index: number): ArtistCandidate | null {
  const id = count(row.id);
  const name = text(row.name);
  if (!id || !name) return null;
  const metric = count(row.nb_fan);
  return {
    id: `deezer:artist:${id}`,
    connectorId: "catalog",
    name,
    artwork: text(row.picture_xl) || text(row.picture_big) || undefined,
    sourceId: "catalog",
    metric,
    tier: metric > 0 ? 1 : 0,
    albums: count(row.nb_album),
    index,
  };
}

function searchCandidates(payload: Row | null, key: string): ArtistCandidate[] {
  const data = rows(payload?.data);
  const found: ArtistCandidate[] = [];
  for (const row of data) {
    if (artistIdentityKey(text(row.name)) !== key) continue;
    const candidate = artistCandidate(row, found.length);
    if (candidate) found.push(candidate);
  }
  if (found.length || data.length !== 1) return found;
  const only = artistCandidate(data[0], 0);
  return only ? [only] : [];
}

function withHints(
  base: ArtistCandidate[],
  refs: MusicArtistRef[],
  key: string,
): ArtistCandidate[] {
  if (!refs.length) return base;
  const seats = new Map<string, number>();
  for (const candidate of base)
    seats.set(candidate.sourceId, (seats.get(candidate.sourceId) ?? 0) + 1);
  const merged = [...base];
  for (const ref of refs) {
    if (artistIdentityKey(ref.name) !== key) continue;
    const index = seats.get(ref.connectorId) ?? 0;
    seats.set(ref.connectorId, index + 1);
    const audience = parseAudience(ref.subtitle);
    merged.push({
      ...ref,
      sourceId: ref.connectorId,
      metric: audience?.value ?? 0,
      tier: audience?.tier ?? 0,
      albums: 0,
      index,
    });
  }
  return merged;
}

async function narrowByTrack(
  candidates: ArtistCandidate[],
  name: string,
  track: MusicTrack,
  key: string,
): Promise<ArtistCandidate[]> {
  const query = `artist:"${name.replace(/"/g, "")}" track:"${track.title.replace(/"/g, "")}"`;
  const payload = await deezerJson(
    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=20`,
  );
  if (!payload.body) return candidates;
  const title = artistIdentityKey(track.title);
  const ids = new Set<string>();
  for (const row of rows(payload.body.data)) {
    const artist = object(row.artist);
    if (
      artistIdentityKey(text(row.title)) !== title ||
      artistIdentityKey(text(artist.name)) !== key
    )
      continue;
    ids.add(`deezer:artist:${count(artist.id)}`);
  }
  const narrowed = candidates.filter(
    (candidate) => candidate.sourceId !== "catalog" || ids.has(candidate.id),
  );
  return narrowed.some((candidate) => candidate.sourceId === "catalog") ? narrowed : candidates;
}

function storedHints(key: string): MusicArtistRef[] {
  const entry = lruGet(hints, key);
  return entry && fresh(entry) ? entry.refs : [];
}

async function probe(
  key: string,
  name: string,
  opts?: ResolveOptions,
): Promise<{ ranking: ArtistRanking; ok: boolean }> {
  const payload = await deezerJson(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(probeQuery(name))}&limit=${SEARCH_LIMIT}`,
  );
  const held = [...(opts?.hint ?? []), ...storedHints(key)];
  let candidates = withHints(searchCandidates(payload.body, key), held, key);
  if (!candidates.length) return { ranking: emptyRanking(key), ok: payload.ok };
  let ranking = rankArtistCandidates(candidates);
  const decisive = (ranking.clusters[0]?.decades ?? 0) >= DECISIVE_DECADES;
  if (opts?.track && candidates.length > 1 && !decisive) {
    candidates = await narrowByTrack(candidates, name, opts.track, key);
    ranking = rankArtistCandidates(candidates);
  }
  return { ranking, ok: payload.ok };
}

export async function resolveArtist(name: string, opts?: ResolveOptions): Promise<ArtistRanking> {
  const key = artistIdentityKey(name);
  if (!key) return emptyRanking("");
  const cached = lruGet(rankings, key);
  if (cached && fresh(cached)) return cached.value;
  const entry = { at: Date.now(), ttl: FAILED_TTL } as Entry;
  entry.value = probe(key, name, opts).then(({ ranking, ok }) => {
    entry.ttl = !ok ? FAILED_TTL : ranking.measured ? MEASURED_TTL : EMPTY_TTL;
    entry.ready = ranking;
    return ranking;
  });
  lruSet(rankings, key, entry, RANKING_MAX);
  return entry.value;
}

export function primeArtistCandidates(nameKey: string, refs: MusicArtistRef[]): void {
  const key = artistIdentityKey(nameKey);
  if (!key) return;
  const merged = new Map<string, MusicArtistRef>();
  for (const ref of [...storedHints(key), ...refs])
    if (artistIdentityKey(ref.name) === key) merged.set(refKey(ref), ref);
  const held = [...merged.values()];
  if (!held.length) return;
  const ranking = rankArtistCandidates(withHints([], held, key));
  lruSet(hints, key, { at: Date.now(), ttl: HINT_TTL, refs: held, ranking }, HINT_MAX);
}

export function peekArtistIdentity(name: string): ArtistIdentityView {
  const key = artistIdentityKey(name);
  if (!key) return { ranking: null, probed: false };
  const entry = lruGet(rankings, key);
  if (entry && fresh(entry) && entry.ready) return { ranking: entry.ready, probed: true };
  const hinted = lruGet(hints, key);
  return { ranking: hinted && fresh(hinted) ? hinted.ranking : null, probed: false };
}

function enrich(
  ref: MusicArtistRef,
  member: { artwork?: string; subtitle?: string },
): MusicArtistRef {
  const artwork = ref.artwork || member.artwork;
  const subtitle = ref.subtitle || member.subtitle;
  if (artwork === ref.artwork && subtitle === ref.subtitle) return ref;
  return { ...ref, artwork, subtitle };
}

function locate(ranking: ArtistRanking, ref: MusicArtistRef): MusicArtistRef {
  const wanted = refKey(ref);
  if (!ranking.measured) {
    if (!warned.has(wanted)) {
      warned.add(wanted);
      dwarn("artist authority has no popularity signal for", ref.name);
    }
    return ref;
  }
  const top = ranking.clusters[0];
  for (const cluster of ranking.clusters) {
    const member = cluster.members.find((entry) => refKey(entry) === wanted);
    if (!member) continue;
    const own = refKey(cluster.lead) === wanted;
    if (cluster === top) return own ? enrich(ref, cluster.lead) : cluster.lead;
    if (cluster.folded || outrankedNamesake(ranking, cluster)) return top.lead;
    return own ? enrich(ref, cluster.lead) : enrich(ref, member);
  }
  return ref;
}

const verifiedRefs = new Map<string, Promise<MusicArtistRef>>();

export async function identityForRef(ref: MusicArtistRef): Promise<MusicArtistRef> {
  if (ref.connectorId === "local") return ref;
  const ranking = await resolveArtist(ref.name, { hint: [ref] });
  const located = locate(ranking, ref);
  const canonical = ranking.canonical;
  if (!canonical || ranking.ambiguous || refKey(located) === refKey(canonical)
    || located.connectorId === canonical.connectorId
    || artistIdentityKey(located.name) !== artistIdentityKey(canonical.name)) return located;
  const key = `${refKey(located)}=>${refKey(canonical)}`;
  const held = lruGet(verifiedRefs, key);
  if (held) return held;
  const checked = (async () => {
    // Search may arrive after a dock lookup cached a ranking without this provider's ref.
    const [{ artistTop }, { sharesArtistRecordings }, { withTimeout }] = await Promise.all([
      import("./catalog"), import("./artist-recording-match"), import("@/lib/progressive-rows"),
    ]);
    const [left, right] = await withTimeout(Promise.all([artistTop(located), artistTop(canonical)]), 12_000);
    return sharesArtistRecordings(left, right) ? canonical : located;
  })().catch(() => { verifiedRefs.delete(key); return located; });
  lruSet(verifiedRefs, key, checked, RANKING_MAX);
  return checked;
}
