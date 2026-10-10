import { useEffect, useRef, useState } from "react";
import type { ScoredStream } from "@/lib/streams/types";
import type { SourceDescriptor } from "@/lib/together/protocol";
import { engineP2pEligible } from "@/lib/torrent/stremio-stream";
import { hasInstantMarker, streamMatchesLangs, torrentFilename } from "./picker-utils";
import { episodeVariantMatch } from "@/lib/streams/episode-file";
import { episodeSpanContains } from "@/lib/episode-span";
import type { AddonProgress } from "@/lib/streams/addons";
import { preferredSourceAddonPending, type PlaybackEntry } from "@/lib/playback-history";

const AUTO_SETTLE_MS = 1500;
const AUTO_SETTLE_PACK_MS = 4000;
const HIGH_CONFIDENCE_GRACE_MS = 350;
const HOST_SOURCE_WAIT_MS = 12_000;
const PREFERRED_SOURCE_WAIT_MS = 10_000;
const QUORUM_RATIO = 0.8;
const QUORUM_CAP_MS = 10_000;

export function useAutoFire(args: {
  autoActive: boolean;
  rememberedHandledFirst?: boolean;
  attempt?: number;
  autoCandidates: ScoredStream[];
  resolving: unknown;
  autoAttemptIdx: number;
  autoSettleReady: boolean;
  pipelineDone: boolean;
  firstResultAt: number | null;
  isCached: (s: ScoredStream) => boolean;
  p2pAutoConsent: boolean;
  preferredLangs: string[];
  hasStrongAddon: boolean;
  isTorrentioStream: (s: ScoredStream) => boolean;
  expectHostSource?: boolean;
  hostSource?: SourceDescriptor | null;
  preferredSourceEntry?: PlaybackEntry | null;
  preferredSourceMatched?: boolean;
  season?: number | null;
  episode?: number | null;
  addonQuorum: AddonProgress;
  pipelineStartedAt: number | null;
  autoFiredRef: React.MutableRefObject<boolean>;
  setAutoSettleReady: (v: boolean) => void;
  setAutoCancelled: (v: boolean) => void;
  onPlay: (s: ScoredStream, committed: boolean, skipP2pConfirm?: boolean, auto?: boolean) => void;
}): void {
  const {
    autoActive,
    rememberedHandledFirst,
    attempt,
    autoCandidates,
    resolving,
    autoAttemptIdx,
    autoSettleReady,
    pipelineDone,
    firstResultAt,
    isCached,
    p2pAutoConsent,
    preferredLangs,
    hasStrongAddon,
    isTorrentioStream,
    expectHostSource,
    hostSource,
    preferredSourceEntry,
    preferredSourceMatched,
    season,
    episode,
    addonQuorum,
    pipelineStartedAt,
    autoFiredRef,
    setAutoSettleReady,
    setAutoCancelled,
    onPlay,
  } = args;
  const episodeQualifies = (s: ScoredStream) => {
    if (episode == null) return true;
    if (season != null && s.season != null && episodeSpanContains(s, season, episode)) return true;
    if (s.episode === episode && (season == null || s.season == null || s.season === season))
      return true;
    if (s.episode != null) return false;
    return episodeVariantMatch(torrentFilename(s), season ?? null, episode);
  };
  const nameAbsent = (s: ScoredStream) => s.nameAbsent === true;
  const topInstantPlayable = (s: ScoredStream) =>
    isCached(s) || !!s.url || (p2pAutoConsent && engineP2pEligible(s));
  const isHighConfidence = (s: ScoredStream, langOk: boolean) =>
    hasInstantMarker(s) &&
    isCached(s) &&
    langOk &&
    episodeQualifies(s) &&
    !nameAbsent(s) &&
    (!hasStrongAddon || !isTorrentioStream(s));
  const highConfidenceSinceRef = useRef<number | null>(null);
  const [highConfidenceTick, setHighConfidenceTick] = useState(0);

  const [hostWaitElapsed, setHostWaitElapsed] = useState(false);
  useEffect(() => {
    if (!autoActive || !expectHostSource || hostSource || hostWaitElapsed) return;
    const t = window.setTimeout(() => setHostWaitElapsed(true), HOST_SOURCE_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [autoActive, expectHostSource, hostSource, hostWaitElapsed]);
  const waitingForHostSource = !!expectHostSource && !hostSource && !hostWaitElapsed;

  const preferredAddonPending = preferredSourceAddonPending(
    preferredSourceEntry ?? null,
    preferredSourceMatched === true,
    pipelineDone,
    addonQuorum,
  );
  const [preferredWaitElapsed, setPreferredWaitElapsed] = useState(false);
  useEffect(() => {
    setPreferredWaitElapsed(false);
    if (!autoActive || !preferredAddonPending) return;
    const elapsed = pipelineStartedAt == null ? 0 : performance.now() - pipelineStartedAt;
    const t = window.setTimeout(
      () => setPreferredWaitElapsed(true),
      Math.max(0, PREFERRED_SOURCE_WAIT_MS - elapsed),
    );
    return () => window.clearTimeout(t);
  }, [autoActive, pipelineStartedAt, preferredAddonPending, preferredSourceEntry]);
  const waitingForPreferredSource = preferredAddonPending && !preferredWaitElapsed;
  const protectingPreferredSource = !!preferredSourceEntry && !preferredSourceMatched;

  useEffect(() => {
    if (waitingForHostSource || waitingForPreferredSource || protectingPreferredSource) return;
    if (!autoActive || autoFiredRef.current || pipelineDone || autoSettleReady) return;
    const top = autoCandidates[0];
    const langOk =
      preferredLangs.length === 0 || (top != null && streamMatchesLangs(top, preferredLangs));
    if (!top || !isHighConfidence(top, langOk)) {
      highConfidenceSinceRef.current = null;
      return;
    }
    const t = window.setTimeout(
      () => setHighConfidenceTick((n) => n + 1),
      HIGH_CONFIDENCE_GRACE_MS + 20,
    );
    return () => window.clearTimeout(t);
  }, [
    autoActive,
    pipelineDone,
    autoSettleReady,
    autoCandidates,
    isCached,
    preferredLangs,
    hasStrongAddon,
    isTorrentioStream,
    autoFiredRef,
    waitingForHostSource,
    waitingForPreferredSource,
    protectingPreferredSource,
    episode,
    season,
  ]);

  useEffect(() => {
    if (!autoActive || autoSettleReady || pipelineDone) return;
    if (firstResultAt == null) return;

    const top = autoCandidates[0];
    const topLangOk =
      preferredLangs.length === 0 || (top != null && streamMatchesLangs(top, preferredLangs));
    const floorEligible =
      top != null && topInstantPlayable(top) && !nameAbsent(top) && episodeQualifies(top);

    const hasCachedExact = autoCandidates.some((c) => isCached(c) && episodeQualifies(c));
    const baselineSettleMs =
      episode != null && !hasCachedExact ? AUTO_SETTLE_PACK_MS : AUTO_SETTLE_MS;

    const evaluate = () => {
      const sinceFirst = performance.now() - firstResultAt;
      const sinceStart = pipelineStartedAt == null ? 0 : performance.now() - pipelineStartedAt;
      const quorumReached =
        addonQuorum.total > 0 && addonQuorum.settled / addonQuorum.total >= QUORUM_RATIO;

      const instantTopFloor = floorEligible && topLangOk && sinceFirst >= baselineSettleMs;
      const quorumFloor = quorumReached && topLangOk && sinceFirst >= AUTO_SETTLE_MS;
      const capElapsed = pipelineStartedAt != null && sinceStart >= QUORUM_CAP_MS;

      if (instantTopFloor || quorumFloor || capElapsed) setAutoSettleReady(true);
    };

    evaluate();
    const now = performance.now();
    const tFloor = window.setTimeout(
      evaluate,
      Math.max(0, baselineSettleMs - (now - firstResultAt)),
    );
    const tQuorum = window.setTimeout(
      evaluate,
      Math.max(0, AUTO_SETTLE_MS - (now - firstResultAt)),
    );
    const tCap =
      pipelineStartedAt == null
        ? undefined
        : window.setTimeout(evaluate, Math.max(0, QUORUM_CAP_MS - (now - pipelineStartedAt)));
    return () => {
      window.clearTimeout(tFloor);
      window.clearTimeout(tQuorum);
      if (tCap != null) window.clearTimeout(tCap);
    };
  }, [
    autoActive,
    autoSettleReady,
    pipelineDone,
    firstResultAt,
    pipelineStartedAt,
    autoCandidates,
    addonQuorum,
    isCached,
    p2pAutoConsent,
    episode,
    season,
    preferredLangs,
    setAutoSettleReady,
  ]);

  useEffect(() => {
    if (!autoActive || autoFiredRef.current) return;
    if (rememberedHandledFirst) return;
    if (waitingForHostSource || waitingForPreferredSource) return;
    const top = autoCandidates[0];
    const isFirstAttempt = (attempt ?? 0) === 0 && autoAttemptIdx === 0;
    const langOk =
      preferredLangs.length === 0 || (top != null && streamMatchesLangs(top, preferredLangs));
    const highConfidenceTop = top != null && isHighConfidence(top, langOk);
    if (isFirstAttempt && !pipelineDone) {
      if (highConfidenceTop) {
        const now = performance.now();
        if (highConfidenceSinceRef.current == null) highConfidenceSinceRef.current = now;
        if (now - highConfidenceSinceRef.current < HIGH_CONFIDENCE_GRACE_MS) return;
      } else {
        highConfidenceSinceRef.current = null;
        if (!autoSettleReady) return;
      }
    }
    if (autoCandidates.length === 0) return;
    if (resolving) return;
    const idx = Math.min((attempt ?? 0) + autoAttemptIdx, autoCandidates.length - 1);
    const pick = autoCandidates[idx];
    if (!pick) return;
    const pickInstant = isCached(pick) || !!pick.url || (p2pAutoConsent && engineP2pEligible(pick));
    if (!pickInstant) {
      if (pipelineDone) setAutoCancelled(true);
      return;
    }
    autoFiredRef.current = true;
    const p2pConsentPick =
      !isCached(pick) && !pick.url && p2pAutoConsent && engineP2pEligible(pick);
    onPlay(pick, p2pConsentPick, p2pConsentPick, true);
  }, [
    autoActive,
    rememberedHandledFirst,
    attempt,
    autoCandidates,
    resolving,
    autoAttemptIdx,
    autoSettleReady,
    pipelineDone,
    isCached,
    preferredLangs,
    hasStrongAddon,
    isTorrentioStream,
    autoFiredRef,
    setAutoCancelled,
    onPlay,
    highConfidenceTick,
    waitingForHostSource,
    waitingForPreferredSource,
  ]);
}
