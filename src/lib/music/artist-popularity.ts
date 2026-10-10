import { collapseWhitespace, normalizeName } from "./search-normalize";
import type { MusicArtistRef } from "./types";

export type MusicArtistCandidateRef = MusicArtistRef;

export type AudienceUnit =
  | "monthlyAudience"
  | "subscribers"
  | "followers"
  | "listeners"
  | "listens"
  | "plays"
  | "fans";

export type Audience = { value: number; unit: AudienceUnit; tier: 1 | 2 };

export type ArtistCandidate = MusicArtistRef & {
  sourceId: string;
  metric: number;
  tier: 0 | 1 | 2;
  albums: number;
  index: number;
};

export type ArtistCluster = {
  lead: MusicArtistCandidateRef;
  members: ArtistCandidate[];
  decades: number;
  folded: boolean;
  flagship: boolean;
};

export type ArtistRanking = {
  key: string;
  clusters: ArtistCluster[];
  canonical: MusicArtistRef | null;
  ambiguous: boolean;
  measured: boolean;
};

const AUDIENCE =
  /(\d[\d.,]*)\s*([kmb])?\s*(?:(monthly)\s+)?(audience|subscribers?|followers?|listeners?|listens?|plays?|fans?)/i;
const TOPIC_SUFFIX = /\s+topic$/;
const SOURCE_ORDER = [
  "catalog",
  "spotify",
  "youtube",
  "soundcloud",
  "local",
  "jellyfin",
  "plex",
  "subsonic",
];

export const DECISIVE_DECADES = 1;
export const TIE_DECADES = 0.3;
export const SUBSTANTIVE_AUDIENCE = 1000;

const UNITS: Array<[RegExp, AudienceUnit]> = [
  [/^audience$/, "monthlyAudience"],
  [/^subscribers?$/, "subscribers"],
  [/^followers?$/, "followers"],
  [/^listeners?$/, "listeners"],
  [/^listens?$/, "listens"],
  [/^plays?$/, "plays"],
  [/^fans?$/, "fans"],
];

function unitOf(word: string): AudienceUnit {
  for (const [pattern, unit] of UNITS) if (pattern.test(word)) return unit;
  return "fans";
}

export function parseAudience(subtitle: string | undefined): Audience | null {
  if (!subtitle) return null;
  const digits = subtitle.replace(/\p{Nd}/gu, (character) =>
    character >= "0" && character <= "9" ? character : String(character.charCodeAt(0) & 0xf),
  );
  const found = AUDIENCE.exec(digits);
  if (!found) return null;
  const value = Number(found[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  const scale = found[2]?.toLowerCase();
  const unit = unitOf(found[4].toLowerCase());
  const flagship = unit === "monthlyAudience" || (Boolean(found[3]) && unit === "listeners");
  const factor = scale === "b" ? 1e9 : scale === "m" ? 1e6 : scale === "k" ? 1e3 : 1;
  return {
    value: Math.round(value * factor),
    unit: flagship ? "monthlyAudience" : unit,
    tier: flagship ? 2 : 1,
  };
}

export function audienceValue(subtitle: string | undefined): number {
  return parseAudience(subtitle)?.value ?? 0;
}

export function artistIdentityKey(name: string): string {
  const stripped = collapseWhitespace(normalizeName(name).replace(TOPIC_SUFFIX, ""));
  return stripped || name.trim().toLowerCase();
}

const refKey = (ref: { connectorId: string; id: string }) => `${ref.connectorId}:${ref.id}`;

const compare = (left: ArtistCandidate, right: ArtistCandidate) =>
  right.metric - left.metric || right.albums - left.albums || left.index - right.index;

function mergeSameRecord(lead: ArtistCandidate, other: ArtistCandidate): ArtistCandidate {
  return {
    ...lead,
    artwork: lead.artwork || other.artwork,
    subtitle: lead.subtitle || other.subtitle,
    metric: Math.max(lead.metric, other.metric),
    tier: Math.max(lead.tier, other.tier) as 0 | 1 | 2,
    albums: Math.max(lead.albums, other.albums),
  };
}

function dedupeExact(candidates: ArtistCandidate[]): ArtistCandidate[] {
  const seen = new Map<string, ArtistCandidate>();
  for (const candidate of candidates) {
    const key = refKey(candidate);
    const existing = seen.get(key);
    seen.set(key, existing ? mergeSameRecord(existing, candidate) : candidate);
  }
  return [...seen.values()];
}

function unionRef(lead: ArtistCandidate, folded: ArtistCandidate | null): MusicArtistCandidateRef {
  const union: MusicArtistCandidateRef = {
    id: lead.id,
    connectorId: lead.connectorId,
    name: lead.name,
    artwork: lead.artwork || folded?.artwork,
    subtitle: lead.subtitle || folded?.subtitle,
  };
  if (lead.musicBrainzId) union.musicBrainzId = lead.musicBrainzId;
  return union;
}

type SourceGroup = {
  sourceId: string;
  order: number;
  members: ArtistCandidate[];
  decades: number;
  measured: boolean;
};

function groupBySource(candidates: ArtistCandidate[]): SourceGroup[] {
  const buckets = new Map<string, ArtistCandidate[]>();
  for (const candidate of candidates) {
    const bucket = buckets.get(candidate.sourceId);
    if (bucket) bucket.push(candidate);
    else buckets.set(candidate.sourceId, [candidate]);
  }
  const groups: SourceGroup[] = [];
  for (const [sourceId, members] of buckets) {
    const top = Math.max(...members.map((member) => member.tier));
    const competing = members.filter((member) => member.tier === top).sort(compare);
    const lower = members.filter((member) => member.tier !== top).sort(compare);
    const lead = competing[0];
    const rival = competing[1];
    const order = SOURCE_ORDER.indexOf(sourceId);
    groups.push({
      sourceId,
      order: order < 0 ? SOURCE_ORDER.length : order,
      members: [...competing, ...lower],
      decades: rival
        ? Math.log10((lead.metric + 1) / (rival.metric + 1))
        : lead.metric > 0
          ? Infinity
          : 0,
      measured: lead.metric > 0,
    });
  }
  return groups.sort(
    (left, right) => left.order - right.order || left.sourceId.localeCompare(right.sourceId),
  );
}

const emptyRanking = (key: string): ArtistRanking => ({
  key,
  clusters: [],
  canonical: null,
  ambiguous: false,
  measured: false,
});

export function rankArtistCandidates(candidates: ArtistCandidate[]): ArtistRanking {
  const unique = dedupeExact(candidates);
  if (!unique.length) return emptyRanking("");
  const key = artistIdentityKey(unique[0].name);
  const groups = groupBySource(unique);
  const leadGroup =
    groups.find((group) => group.measured && group.decades >= DECISIVE_DECADES) ??
    groups.find((group) => group.measured) ??
    groups[0];
  const leadCandidate = leadGroup.members[0];
  const carried: ArtistCandidate[] = [];
  const folded = new Set<string>();
  if (leadGroup.measured && leadGroup.decades >= DECISIVE_DECADES) {
    for (const group of groups) {
      if (group === leadGroup || group.members.length !== 1 || group.members[0].tier !== 2)
        continue;
      carried.push(group.members[0]);
      folded.add(refKey(group.members[0]));
    }
  }
  const clusters: ArtistCluster[] = [];
  for (const group of groups) {
    for (const member of group.members) {
      if (folded.has(refKey(member))) continue;
      const attached = member === leadCandidate ? carried : [];
      const members = [member, ...attached];
      clusters.push({
        lead: unionRef(member, attached[0] ?? null),
        members,
        decades: member === group.members[0] ? group.decades : 0,
        folded: attached.length > 0,
        flagship: members.some((entry) => entry.tier === 2),
      });
    }
  }
  const at = clusters.findIndex((cluster) => refKey(cluster.lead) === refKey(leadCandidate));
  if (at > 0) clusters.unshift(...clusters.splice(at, 1));
  const top = clusters[0];
  return {
    key,
    clusters,
    canonical: top ? top.lead : null,
    ambiguous: clusters.length > 1 && top.decades < TIE_DECADES,
    measured: unique.some((candidate) => candidate.metric > 0),
  };
}

export const clusterMetric = (cluster: ArtistCluster): number =>
  cluster.members.reduce((best, member) => Math.max(best, member.metric), 0);

export function displayClusters(ranking: ArtistRanking): ArtistCluster[] {
  const [lead, ...rest] = ranking.clusters;
  if (!lead) return [];
  if (!ranking.measured) return [lead];
  const home = lead.lead.connectorId;
  const shown = [lead];
  const sources = new Set([home]);
  let rival = true;
  for (const cluster of rest) {
    if (cluster.lead.connectorId === home) {
      const tie = rival && Number.isFinite(lead.decades) && lead.decades < TIE_DECADES;
      rival = false;
      if (tie || clusterMetric(cluster) >= SUBSTANTIVE_AUDIENCE) shown.push(cluster);
      continue;
    }
    if (sources.has(cluster.lead.connectorId) || !cluster.flagship) continue;
    sources.add(cluster.lead.connectorId);
    shown.push(cluster);
  }
  return shown;
}

export function outrankedNamesake(ranking: ArtistRanking, cluster: ArtistCluster): boolean {
  const lead = ranking.clusters[0];
  if (!lead || lead === cluster) return false;
  if (lead.lead.connectorId !== cluster.lead.connectorId) return false;
  return lead.decades >= DECISIVE_DECADES && clusterMetric(cluster) < SUBSTANTIVE_AUDIENCE;
}

export function captionFor(cluster: ArtistCluster, fansLabel: string, locale: string): string {
  if (cluster.lead.subtitle) return cluster.lead.subtitle;
  const lead = cluster.members[0];
  if (lead && lead.id.startsWith("deezer:artist:") && lead.metric > 0)
    return `${lead.metric.toLocaleString(locale)} ${fansLabel}`;
  return "";
}
