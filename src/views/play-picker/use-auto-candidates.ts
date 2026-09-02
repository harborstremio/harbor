import { useMemo } from "react";
import { isStreamDead } from "@/lib/dead-streams";
import { engineP2pEligible } from "@/lib/torrent/stremio-stream";
import type { ScoredStream } from "@/lib/streams/types";
import {
  streamMatchesEntry,
  streamMatchesReleaseLineage,
  streamMatchesSource,
  type PlaybackEntry,
} from "@/lib/playback-history";
import type { SourceDescriptor } from "@/lib/together/protocol";
import { buildMatchScores } from "@/lib/together/source-match";
import { hostSourceStream } from "@/lib/together/host-stream";
import { hasInstantMarker, isWatchHub, needsDownload, streamMatchesLangs } from "./picker-utils";
import { titleTokensPresent } from "@/lib/streams/trust";
import { episodeSpanContains } from "@/lib/episode-span";

const RES_PREF: Record<string, number> = { "1080p": 0, "720p": 1, "480p": 2, "4K": 3, SD: 4 };
const LIKELY_PACK_BYTES = 12 * 1024 * 1024 * 1024;

export function useAutoCandidates(args: {
  filteredPicker: {
    all: ScoredStream[];
    allRaw: ScoredStream[];
    primary: ScoredStream | null;
  } | null;
  previousPlayback: PlaybackEntry | null;
  sourceEntry: PlaybackEntry | null;
  sourceEntryLineage?: boolean;
  isCached: (s: ScoredStream) => boolean;
  addons: Array<{ manifest?: { id?: string } }> | null;
  hasStrongAddon: boolean;
  isTorrentioStream: (s: ScoredStream) => boolean;
  preferredLangs: string[];
  hostSource?: SourceDescriptor | null;
  prefer1080?: boolean;
  preferPacks?: boolean;
  season?: number | null;
  episode?: number | null;
  expectedTitle?: string | null;
  expectedTitles?: string[] | null;
  isAnime?: boolean;
  filterDisabled?: boolean;
}): ScoredStream[] {
  const {
    filteredPicker,
    previousPlayback,
    sourceEntry,
    sourceEntryLineage,
    isCached,
    addons,
    hasStrongAddon,
    isTorrentioStream,
    preferredLangs,
    hostSource,
    prefer1080,
    preferPacks,
    season,
    episode,
    expectedTitle,
    expectedTitles,
    isAnime,
    filterDisabled,
  } = args;
  return useMemo(() => {
    const hostFallback = (): ScoredStream[] => {
      if (!hostSource) return [];
      const hs = hostSourceStream(hostSource);
      return hs ? [hs] : [];
    };
    if (!filteredPicker) return hostFallback();
    const key = (s: ScoredStream) => s.url ?? s.infoHash ?? `${s.addonId}:${s.title ?? ""}`;
    const episodeConflict = (s: ScoredStream) => {
      if (episode == null || s.episode == null) return false;
      if (season != null && s.season != null) return !episodeSpanContains(s, season, episode);
      return s.episode !== episode;
    };
    const episodeExact = (s: ScoredStream) =>
      episode != null &&
      (season != null && s.season != null
        ? episodeSpanContains(s, season, episode)
        : s.episode === episode) &&
      (season == null || s.season == null || s.season === season);
    const instantTier = (s: ScoredStream) => {
      if (!isCached(s)) return 2;
      return episodeExact(s) ? 0 : 1;
    };
    const isLikelyPack = (s: ScoredStream) => {
      if (episode == null) return false;
      if (s.seasonPack) return true;
      if (episodeExact(s)) return false;
      return s.size != null && s.size > LIKELY_PACK_BYTES;
    };
    const nameKnown = (s: ScoredStream): boolean => {
      if (filterDisabled) return true;
      if (s.seasonPack || s.fileIdx != null) return true;
      const hay = s.parsedTitle;
      if (!hay) return true;
      if (isAnime) {
        if (!expectedTitles || expectedTitles.length === 0) return true;
        return expectedTitles.some((t) => titleTokensPresent(t, hay));
      }
      if (!expectedTitle) return true;
      return titleTokensPresent(expectedTitle, hay);
    };
    const isYourMedia = (s: ScoredStream) => /\(your media\)/i.test(s.title ?? "");
    const addonRank = new Map<string, number>();
    (addons ?? []).forEach((a, i) => {
      if (a.manifest?.id) addonRank.set(a.manifest.id, i);
    });
    const matchScores = hostSource ? buildMatchScores(filteredPicker.all, hostSource) : null;
    const previousMatch = previousPlayback
      ? (filteredPicker.allRaw.find((s) => streamMatchesEntry(s, previousPlayback)) ?? null)
      : null;
    for (const s of filteredPicker.all) s.nameAbsent = !nameKnown(s);
    const sorted = filteredPicker.all.slice().sort((a, b) => {
      if (matchScores) {
        const dm = (matchScores.get(b) ?? 0) - (matchScores.get(a) ?? 0);
        if (dm !== 0) return dm;
      }
      const aw = isWatchHub(a) ? 1 : 0;
      const bw = isWatchHub(b) ? 1 : 0;
      if (aw !== bw) return aw - bw;
      const ai0 = instantTier(a);
      const bi0 = instantTier(b);
      if (ai0 !== bi0) return ai0 - bi0;
      const an = a.nameAbsent ? 1 : 0;
      const bn = b.nameAbsent ? 1 : 0;
      if (an !== bn) return an - bn;
      const aym = isYourMedia(a) ? 0 : 1;
      const bym = isYourMedia(b) ? 0 : 1;
      if (aym !== bym) return aym - bym;
      const ap = isLikelyPack(a) ? 1 : 0;
      const bp = isLikelyPack(b) ? 1 : 0;
      if (ap !== bp) return preferPacks ? bp - ap : ap - bp;
      const ad = needsDownload(a) ? 1 : 0;
      const bd = needsDownload(b) ? 1 : 0;
      if (ad !== bd) return ad - bd;
      if (prefer1080) {
        const dr = (RES_PREF[a.resolution] ?? 5) - (RES_PREF[b.resolution] ?? 5);
        if (dr !== 0) return dr;
      }
      if (hasStrongAddon) {
        const at = isTorrentioStream(a) ? 1 : 0;
        const bt = isTorrentioStream(b) ? 1 : 0;
        if (at !== bt) return at - bt;
      }
      if (preferredLangs.length > 0) {
        const al = streamMatchesLangs(a, preferredLangs) ? 0 : 1;
        const bl = streamMatchesLangs(b, preferredLangs) ? 0 : 1;
        if (al !== bl) return al - bl;
      }
      const ar = addonRank.get(a.addonId) ?? 9999;
      const br = addonRank.get(b.addonId) ?? 9999;
      if (ar !== br) return ar - br;
      const ai = hasInstantMarker(a) ? 1 : 0;
      const bi = hasInstantMarker(b) ? 1 : 0;
      if (ai !== bi) return bi - ai;
      return 0;
    });
    const out: ScoredStream[] = [];
    const seen = new Set<string>();
    const push = (s: ScoredStream | null | undefined) => {
      if (!s) return;
      s.nameAbsent = !nameKnown(s);
      if (isStreamDead(s)) return;
      if (isWatchHub(s)) return;
      if (episodeConflict(s)) return;
      if (!isCached(s) && !s.url && !engineP2pEligible(s)) return;
      const k = key(s);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(s);
    };
    const matchSource = sourceEntryLineage ? streamMatchesReleaseLineage : streamMatchesSource;
    const sourceMatch = sourceEntry
      ? (filteredPicker.allRaw.find((s) => matchSource(s, sourceEntry)) ?? null)
      : null;
    const instantPlayable = (s: ScoredStream | null) => !!s && (isCached(s) || !!s.url);
    if (!matchScores) {
      if (instantPlayable(sourceMatch)) push(sourceMatch);
      if (instantPlayable(previousMatch)) push(previousMatch);
    }
    for (const s of sorted) push(s);
    if (out.length > 0) return out;
    const synthetic = hostFallback();
    if (synthetic.length > 0) return synthetic;
    if (hostSource) {
      const ownBest = sorted.find((s) => !isStreamDead(s) && !isWatchHub(s) && !episodeConflict(s));
      if (ownBest) return [ownBest];
    }
    return [];
  }, [
    filteredPicker,
    previousPlayback,
    sourceEntry,
    sourceEntryLineage,
    isCached,
    addons,
    hasStrongAddon,
    isTorrentioStream,
    preferredLangs,
    hostSource,
    prefer1080,
    preferPacks,
    season,
    episode,
    expectedTitle,
    expectedTitles,
    isAnime,
    filterDisabled,
  ]);
}
