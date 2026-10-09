import { normalizeName } from "./search-normalize";
import { artistCreditParts } from "./search-artists";
import { audienceValue } from "./artist-popularity";
import { RELEVANT_NAME_SCORE, popularityFromCount, scoreCandidateParts } from "./search-score";
import type { MusicCatalogItem, MusicSearchResults } from "./types";

/** Stamped by mergeMusicSearchLanes; read inline because sources.ts pulls in the Tauri bridge. */
type Ranked = { sourceCount?: number; sourceRank?: number };

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

function sourceCountOf(item: unknown): number {
  const value = (item as Ranked | null | undefined)?.sourceCount;
  return typeof value === "number" && value > 0 ? value : 1;
}

/** An unstamped item came off a path that never ranked, so it sorts behind every stamped one. */
const UNKNOWN_SOURCE_RANK = Number.MAX_SAFE_INTEGER;

function sourceRankOf(item: unknown): number {
  const value = (item as Ranked | null | undefined)?.sourceRank;
  return typeof value === "number" && value >= 0 ? value : UNKNOWN_SOURCE_RANK;
}

/** Two connectors agreeing on an identity is the merge layer's only statement about who is real. */
const agreementOf = (item: unknown) => clamp01((sourceCountOf(item) - 1) / 2);

/** YouTube Music and ListenBrainz hide the only real audience number in a free-text subtitle. */
export function audienceOf(subtitle: string | undefined): number {
  return audienceValue(subtitle);
}

function creditKeys(name: string): string[] {
  return [
    ...new Set([normalizeName(name), ...artistCreditParts(name, true).map(normalizeName)]),
  ].filter(Boolean);
}

type Standing = { audience: number; audienceOwner: string; credits: number; agreement: number };
type Corpus = { standings: Map<string, Standing>; peakAudience: number; peakCredits: number };

function reach(map: Map<string, Standing>, key: string): Standing {
  const existing = map.get(key);
  if (existing) return existing;
  const fresh: Standing = { audience: 0, audienceOwner: "", credits: 0, agreement: 0 };
  map.set(key, fresh);
  return fresh;
}

const accountKey = (item: { connectorId?: string; id: string }) =>
  `${item.connectorId ?? ""}:${item.id}`;

/**
 * No music connector returns a popularity number, so standing is assembled from what the answer
 * itself reveals: how many connectors agreed on a name, and how much of the returned catalogue
 * that name is credited on. A squatter one letter off a famous name carries neither.
 */
function buildCorpus(results: MusicSearchResults): Corpus {
  const standings = new Map<string, Standing>();
  for (const artist of results.artists) {
    const audience = audienceOf(artist.subtitle);
    const agreement = agreementOf(artist);
    for (const key of creditKeys(artist.name)) {
      const row = reach(standings, key);
      if (audience > row.audience) {
        row.audience = audience;
        row.audienceOwner = accountKey(artist);
      }
      row.agreement = Math.max(row.agreement, agreement);
    }
  }
  for (const track of results.tracks) {
    for (const key of creditKeys(track.artist)) reach(standings, key).credits += 1;
  }
  for (const album of results.albums) {
    for (const key of creditKeys(album.artist)) reach(standings, key).credits += 0.5;
  }
  const rows = [...standings.values()];
  return {
    standings,
    peakAudience: Math.max(0, ...rows.map((row) => row.audience)),
    peakCredits: Math.max(0, ...rows.map((row) => row.credits)),
  };
}

/** Being the only credited name in a thin answer is not dominance, so share needs real mass. */
const CREDIT_FLOOR = 3;

/** The weight of a signal no connector populated moves to the signals that are real. */
function standingOf(corpus: Corpus, name: string, owner?: string): number {
  const rich = corpus.peakAudience > 0;
  let best = 0;
  for (const key of creditKeys(name)) {
    const row = corpus.standings.get(key);
    if (!row) continue;
    const credits = clamp01(row.credits / Math.max(corpus.peakCredits, CREDIT_FLOOR));
    const unmeasured = 0.66 * credits + 0.34 * row.agreement;
    const holds = owner === undefined || row.audienceOwner === owner;
    const measured =
      0.42 * popularityFromCount(row.audience) + 0.38 * credits + 0.2 * row.agreement;
    best = Math.max(best, rich && holds ? Math.max(measured, unmeasured) : unmeasured);
  }
  return best;
}

function identityOf(artist: Extract<MusicCatalogItem, { kind: "artist" }>): number {
  const known =
    artist.musicBrainzId ||
    /^(deezer:artist:|itunes:artist:|spotify:|musicbrainz:artist:)/.test(artist.id);
  return (known ? 0.6 : 0) + (artist.artwork ? 0.4 : 0);
}

function popularityOf(corpus: Corpus, item: MusicCatalogItem): number {
  if (item.kind === "artist") {
    const standing = standingOf(corpus, item.name, accountKey(item));
    const identity = identityOf(item);
    if (corpus.peakAudience <= 0) return clamp01(0.85 * standing + 0.15 * identity);
    // Two accounts can share a name, so an artist is also credited for the audience it alone holds.
    const own = popularityFromCount(audienceOf(item.subtitle));
    return clamp01(0.7 * standing + 0.18 * own + 0.12 * identity);
  }
  if (item.kind === "track" || item.kind === "album") {
    return clamp01(
      0.62 * standingOf(corpus, item.artist) +
        0.26 * agreementOf(item) +
        0.12 * (item.artwork ? 1 : 0),
    );
  }
  if (item.kind === "playlist") {
    return clamp01(0.6 * agreementOf(item) + 0.4 * (item.artwork.length ? 1 : 0));
  }
  return 0.4 * (item.artwork ? 1 : 0);
}

/** A track or album answers to its own title and to the title said together with the artist. */
function namesOf(item: MusicCatalogItem): string[] {
  if (item.kind === "track" || item.kind === "album")
    return [item.title, `${item.title} ${item.artist}`];
  return [item.name];
}

const identityKey = (item: MusicCatalogItem) => `${item.kind}:${item.connectorId ?? ""}:${item.id}`;

function candidatesOf(results: MusicSearchResults): MusicCatalogItem[] {
  const items: MusicCatalogItem[] = [
    ...results.tracks.map((track) => ({ kind: "track", ...track }) as MusicCatalogItem),
    ...results.artists.map((artist) => ({ kind: "artist", ...artist }) as MusicCatalogItem),
    ...results.albums.map((album) => ({ kind: "album", ...album }) as MusicCatalogItem),
    ...results.playlists.map((playlist) => ({ kind: "playlist", ...playlist }) as MusicCatalogItem),
  ];
  if (!results.top) return items;
  const key = identityKey(results.top);
  return items.some((item) => identityKey(item) === key) ? items : [results.top, ...items];
}

export type MusicRankedItem = {
  item: MusicCatalogItem;
  /** scoreCandidate's combined relevance, comparable across every kind. */
  score: number;
  /** Name agreement alone; below RELEVANT_NAME_SCORE this is not what the user typed. */
  relevance: number;
};

/**
 * One comparable scale across artists, tracks, albums and playlists. Every weighting lives in
 * search-score.ts; what this layer supplies is the popularity the music sources never send.
 */
export function rankMusicItems(results: MusicSearchResults, query: string): MusicRankedItem[] {
  const corpus = buildCorpus(results);
  const scored = candidatesOf(results).map((item, index) => {
    const popularity = popularityOf(corpus, item);
    const sourceRank = sourceRankOf(item);
    let best = { score: 0, relevance: 0 };
    for (const name of namesOf(item)) {
      const parts = scoreCandidateParts({ query, name, popularity, kind: item.kind, sourceRank });
      if (parts.total > best.score) best = { score: parts.total, relevance: parts.name };
    }
    return { item, ...best, index };
  });
  scored.sort((left, right) => right.score - left.score || left.index - right.index);
  return scored.map(({ item, score, relevance }) => ({ item, score, relevance }));
}

/** A pick nobody typed is worse than no pick, so an irrelevant winner yields to the source's own. */
function pickTop(
  ranked: MusicRankedItem[],
  results: MusicSearchResults,
): MusicCatalogItem | undefined {
  const best = ranked[0];
  if (!best) return results.top;
  return best.relevance >= RELEVANT_NAME_SCORE ? best.item : results.top;
}

/** Ranked grids in the shape the panel already renders. Nothing is dropped, only reordered. */
export function rankMusicSearch(
  results: MusicSearchResults | null,
  query: string,
): MusicSearchResults | null {
  if (!results) return null;
  if (!normalizeName(query)) return results;
  const ranked = rankMusicItems(results, query);
  const order = new Map(ranked.map((entry, index) => [identityKey(entry.item), index]));
  const sorted = <T>(items: T[], kind: MusicCatalogItem["kind"], id: (item: T) => string) =>
    items
      .map((item, index) => ({
        item,
        rank: order.get(`${kind}:${id(item)}`) ?? Number.MAX_SAFE_INTEGER,
        index,
      }))
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .map((entry) => entry.item);
  return {
    top: pickTop(ranked, results),
    tracks: sorted(results.tracks, "track", (track) => `${track.connectorId ?? ""}:${track.id}`),
    albums: sorted(results.albums, "album", (album) => `${album.connectorId}:${album.id}`),
    artists: sorted(results.artists, "artist", (artist) => `${artist.connectorId}:${artist.id}`),
    playlists: sorted(
      results.playlists,
      "playlist",
      (playlist) => `${playlist.connectorId}:${playlist.id}`,
    ),
  };
}

/** The one result the user meant. Exactness is a weighted signal now, never a winning one. */
export function musicSearchTop(
  results: MusicSearchResults | null,
  query: string,
): MusicCatalogItem | undefined {
  if (!results) return undefined;
  if (!normalizeName(query)) return results.top;
  return pickTop(rankMusicItems(results, query), results);
}
