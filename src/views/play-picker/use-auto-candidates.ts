import { isStreamDead } from "@/lib/dead-streams";
import { streamMatchesEntry, streamMatchesSource, type PlaybackEntry } from "@/lib/playback-history";
import type { ScoredStream } from "@/lib/streams/types";
import { hostSourceStream } from "@/lib/together/host-stream";
import type { SourceDescriptor } from "@/lib/together/protocol";
import { buildMatchScores } from "@/lib/together/source-match";
import { engineP2pEligible } from "@/lib/torrent/stremio-stream";
import { useMemo } from "react";

import { hasInstantMarker, isWatchHub, needsDownload, streamMatchesLangs } from "./picker-utils";

const RES_PREF: Record<string, number> = { "1080p": 0, "720p": 1, "480p": 2, "4K": 3, SD: 4 };
const LIKELY_PACK_BYTES = 12 * 1024 * 1024 * 1024;

export function useAutoCandidates(args: {
  filteredPicker: { all: ScoredStream[]; primary: ScoredStream | null } | null;
  previousPlayback: PlaybackEntry | null;
  sourceEntry: PlaybackEntry | null;
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
}): ScoredStream[] {
  const {
    filteredPicker,
    previousPlayback,
    sourceEntry,
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
      if (s.episode !== episode) return true;
      return season != null && s.season != null && s.season !== season;
    };
    const episodeExact = (s: ScoredStream) =>
      episode != null && s.episode === episode && (season == null || s.season == null || s.season === season);
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
    const addonRank = new Map<string, number>();
    (addons ?? []).forEach((a, i) => {
      if (a.manifest?.id) addonRank.set(a.manifest.id, i);
    });
    const matchScores = hostSource ? buildMatchScores(filteredPicker.all, hostSource) : null;
    const previousMatch = previousPlayback
      ? (filteredPicker.all.find((s) => streamMatchesEntry(s, previousPlayback)) ?? null)
      : null;
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
      if (isStreamDead(s)) return;
      if (isWatchHub(s)) return;
      if (episodeConflict(s)) return;
      if (!isCached(s) && !s.url && !engineP2pEligible(s)) return;
      const k = key(s);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(s);
    };
    const sourceMatch = sourceEntry
      ? (filteredPicker.all.find((s) => streamMatchesSource(s, sourceEntry)) ?? null)
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
  ]);
}
