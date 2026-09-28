import { useEffect, useState } from "react";
import type { ScoredStream } from "@/lib/streams/types";
import type { SourceDescriptor } from "@/lib/together/protocol";
import { engineP2pEligible } from "@/lib/torrent/stremio-stream";

const HOST_SOURCE_WAIT_MS = 12_000;

export function useAutoFire(args: {
  autoActive: boolean;
  rememberedHandledFirst?: boolean;
  attempt?: number;
  autoCandidates: ScoredStream[];
  resolving: unknown;
  autoAttemptIdx: number;
  pipelineDone: boolean;
  isCached: (s: ScoredStream) => boolean;
  p2pAutoConsent: boolean;
  expectHostSource?: boolean;
  hostSource?: SourceDescriptor | null;
  autoFiredRef: React.MutableRefObject<boolean>;
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
    pipelineDone,
    isCached,
    p2pAutoConsent,
    expectHostSource,
    hostSource,
    autoFiredRef,
    setAutoCancelled,
    onPlay,
  } = args;

  const [hostWaitElapsed, setHostWaitElapsed] = useState(false);
  useEffect(() => {
    if (!autoActive || !expectHostSource || hostSource || hostWaitElapsed) return;
    const t = window.setTimeout(() => setHostWaitElapsed(true), HOST_SOURCE_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [autoActive, expectHostSource, hostSource, hostWaitElapsed]);
  const waitingForHostSource = !!expectHostSource && !hostSource && !hostWaitElapsed;

  useEffect(() => {
    if (!autoActive || autoFiredRef.current || rememberedHandledFirst || waitingForHostSource)
      return;
    // Compare the complete source set; a fast lower-quality addon must not win the race.
    if (!pipelineDone) return;
    if (autoCandidates.length === 0) return;
    if (resolving) return;
    const idx = Math.min((attempt ?? 0) + autoAttemptIdx, autoCandidates.length - 1);
    const pick = autoCandidates[idx];
    if (!pick) return;
    const pickInstant = isCached(pick) || !!pick.url || (p2pAutoConsent && engineP2pEligible(pick));
    if (!pickInstant) {
      setAutoCancelled(true);
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
    pipelineDone,
    isCached,
    p2pAutoConsent,
    autoFiredRef,
    setAutoCancelled,
    onPlay,
    waitingForHostSource,
  ]);
}
