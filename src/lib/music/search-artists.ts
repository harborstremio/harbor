import { artistIdentityKey, peekArtistIdentity } from "@/lib/music/artist-authority";
import {
  captionFor,
  displayClusters,
  parseAudience,
  rankArtistCandidates,
} from "@/lib/music/artist-popularity";
import type { ArtistCandidate, ArtistCluster, ArtistRanking } from "@/lib/music/artist-popularity";
import type { MusicArtistRef } from "./types";

const verified = (artist: MusicArtistRef) =>
  Boolean(artist.musicBrainzId || /^(deezer:artist:|spotify:|musicbrainz:artist:)/.test(artist.id));
export const artistCreditParts = (name: string, preserveGroups = false) =>
  name
    .split(
      preserveGroups
        ? /\s*(?:,|\s+\(?feat\.?\s|\s+\(?ft\.?\s|\s+\(?featuring\s)\s*/i
        : /\s*(?:,|\s&\s|\s+\(?feat\.?\s|\s+\(?ft\.?\s|\s+\(?featuring\s)\s*/i,
    )
    .map((value) =>
      (/\b(?:feat\.?|ft\.?|featuring)\s/i.test(name) ? value.replace(/\)\s*$/, "") : value).trim(),
    )
    .filter(Boolean);

export async function resolveSearchCollaborations(
  artists: MusicArtistRef[],
  search: (name: string) => Promise<MusicArtistRef[]>,
): Promise<MusicArtistRef[]> {
  const pending = artists.filter(
    (artist) => !verified(artist) && artistCreditParts(artist.name).length > 1,
  );
  const names = [...new Set(pending.flatMap((artist) => artistCreditParts(artist.name)))];
  const found: MusicArtistRef[] = [];
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, names.length) }, async () => {
      while (index < names.length) {
        const name = names[index++];
        const existing = artists.filter(
          (artist) => artistIdentityKey(artist.name) === artistIdentityKey(name),
        );
        const matches = existing.length ? existing : await search(name).catch(() => []);
        const exact = uniqueSearchArtists(
          matches.filter((artist) => artistIdentityKey(artist.name) === artistIdentityKey(name)),
        );
        const preferred = exact.filter((artist) => artist.id.startsWith("deezer:artist:"));
        const candidates = preferred.length ? preferred : exact;
        if (candidates.length === 1) found.push(candidates[0]);
      }
    }),
  );
  return uniqueSearchArtists([...artists, ...found]);
}

/** Written by mergeMusicSearchLanes in sources.ts; read inline so this module stays import-free. */
type RankedArtist = MusicArtistRef & {
  sourceCount?: number;
  sourceRank?: number;
  sourceConnectorIds?: string[];
};

function artistStrength(artist: MusicArtistRef): number {
  const ranked = artist as RankedArtist;
  const agreement = Math.min(ranked.sourceCount ?? 1, 8) * 8;
  const position = 8 - Math.min(ranked.sourceRank ?? 8, 8);
  return (
    (verified(artist) ? 1024 : 0) +
    agreement +
    position +
    (artist.artwork ? 4 : 0) +
    (artist.subtitle ? 1 : 0)
  );
}

/** Collapsing onto the stronger entry, not the first seen, keeps the provider copy over a stub. */
function preferArtist(left: MusicArtistRef, right: MusicArtistRef): MusicArtistRef {
  const base = artistStrength(right) > artistStrength(left) ? right : left;
  const other = base === left ? right : left;
  return {
    ...other,
    ...base,
    musicBrainzId: base.musicBrainzId || other.musicBrainzId,
    artwork: base.artwork || other.artwork,
    subtitle: base.subtitle || other.subtitle,
  };
}

export function uniqueSearchArtists(artists: MusicArtistRef[]): MusicArtistRef[] {
  const unique = new Map<string, MusicArtistRef>();
  // The same provider artist can arrive with and without an id, so treat the id as an alias of the
  // identity it first appeared under rather than as a second key that renders a second card.
  const byMusicBrainz = new Map<string, string>();
  for (const artist of artists) {
    const identity = `${artist.connectorId}:${artist.id}`;
    const key = (artist.musicBrainzId && byMusicBrainz.get(artist.musicBrainzId)) || identity;
    const previous = unique.get(key);
    const merged = previous ? preferArtist(previous, artist) : artist;
    unique.set(key, merged);
    if (merged.musicBrainzId) byMusicBrainz.set(merged.musicBrainzId, key);
  }
  const values = [...unique.values()];
  const names = new Set(values.map((artist) => artistIdentityKey(artist.name)));
  return values.filter((artist) => {
    // Drop a combined search placeholder only when every individual is present.
    // A real provider artist or a band with '&' in its name keeps its identity.
    if (verified(artist)) return true;
    const parts = artistCreditParts(artist.name).map(artistIdentityKey);
    return parts.length < 2 || !parts.every((part) => names.has(part));
  });
}

const identityOf = (artist: MusicArtistRef) => `${artist.connectorId}:${artist.id}`;

function measuredCandidates(ranking: ArtistRanking | null): Map<string, ArtistCandidate> {
  const known = new Map<string, ArtistCandidate>();
  if (!ranking) return known;
  for (const cluster of ranking.clusters) {
    for (const member of cluster.members) known.set(identityOf(member), member);
  }
  return known;
}

function candidateOf(
  artist: MusicArtistRef,
  index: number,
  known: ArtistCandidate | undefined,
): ArtistCandidate {
  const audience = parseAudience(artist.subtitle);
  const measured: { metric: number; tier: 0 | 1 | 2 } =
    known && (!audience || known.tier >= audience.tier)
      ? { metric: known.metric, tier: known.tier }
      : { metric: audience?.value ?? 0, tier: audience?.tier ?? 0 };
  return {
    ...artist,
    sourceId: artist.connectorId,
    albums: known?.albums ?? 0,
    index,
    ...measured,
  };
}

function sourcesOf(cluster: ArtistCluster, source: Map<string, RankedArtist>): string[] {
  const ids: string[] = [];
  for (const member of cluster.members) {
    const base = source.get(identityOf(member));
    const supplied = base?.sourceConnectorIds?.length
      ? base.sourceConnectorIds
      : [member.connectorId];
    for (const id of supplied) if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function rowOf(
  cluster: ArtistCluster,
  source: Map<string, RankedArtist>,
  locale: string,
  fansLabel: string,
): MusicArtistRef {
  const lead = cluster.lead;
  const base = source.get(identityOf(lead)) ?? {
    id: lead.id,
    connectorId: lead.connectorId,
    name: lead.name,
    artwork: lead.artwork,
    subtitle: lead.subtitle,
    musicBrainzId: lead.musicBrainzId,
  };
  const subtitle = captionFor(cluster, fansLabel, locale) || lead.subtitle || base.subtitle;
  const connectors = sourcesOf(cluster, source);
  const row: RankedArtist = {
    ...base,
    id: lead.id,
    connectorId: lead.connectorId,
    name: lead.name,
    artwork: lead.artwork ?? base.artwork,
    musicBrainzId: lead.musicBrainzId ?? base.musicBrainzId,
    sourceCount: connectors.length,
    sourceConnectorIds: connectors,
    ...(subtitle ? { subtitle } : {}),
  };
  return row;
}

export function collapseArtistRows(
  artists: MusicArtistRef[],
  locale: string,
  fansLabel: string,
  pendingKey?: string,
): MusicArtistRef[] {
  const groups = new Map<string, MusicArtistRef[]>();
  for (const artist of artists) {
    const key = artistIdentityKey(artist.name);
    const group = groups.get(key);
    if (group) group.push(artist);
    else groups.set(key, [artist]);
  }
  const rows: MusicArtistRef[] = [];
  for (const [key, group] of groups) {
    const view = peekArtistIdentity(group[0].name);
    if (group.length > 1 && !view.probed && key === pendingKey) continue;
    const known = measuredCandidates(view.ranking);
    const source = new Map(group.map((artist) => [identityOf(artist), artist as RankedArtist]));
    const ranking = rankArtistCandidates(
      group.map((artist, index) => candidateOf(artist, index, known.get(identityOf(artist)))),
    );
    const shown = displayClusters(ranking);
    if (!shown.length) {
      rows.push(group[0]);
      continue;
    }
    for (const cluster of shown) rows.push(rowOf(cluster, source, locale, fansLabel));
  }
  return rows;
}
