import { useEffect, useRef, type RefObject } from "react";
import type { PlayerBridge, PlayerSnapshot, TrackInfo } from "@/lib/player/bridge";
import { resetSecondarySub, useSecondarySubChoice } from "@/lib/player/secondary-sub";
import { pickBestTrack } from "@/lib/subtitles/language";
import { canBeSecondarySub } from "@/lib/player/sub-format";

function autoPick(tracks: TrackInfo[], lang: string, primaryId: string | null): string | null {
  if (!lang.trim()) return null;
  const pool = tracks.filter((t) => t.id !== primaryId && canBeSecondarySub(t));
  return pickBestTrack(pool, [lang])?.id ?? null;
}

export function useSecondarySub({
  bridgeRef,
  snap,
  sourceUrl,
  lang,
}: {
  bridgeRef: RefObject<PlayerBridge | null>;
  snap: PlayerSnapshot;
  sourceUrl: string;
  lang: string;
}): void {
  const choice = useSecondarySubChoice();
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    appliedRef.current = null;
    resetSecondarySub();
  }, [sourceUrl]);

  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const primaryId = snap.subtitleTracks.find((t) => t.selected)?.id ?? null;
    const currentId = snap.subtitleTracks.find((t) => t.secondary)?.id ?? null;
    const wanted = choice === "auto" ? autoPick(snap.subtitleTracks, lang, primaryId) : choice;
    // Gate on the resolved track, not just the id, so an explicit choice from any
    // caller is held to the same text-only rule the automatic pick is.
    const wantedTrack = snap.subtitleTracks.find((t) => t.id === wanted) ?? null;
    const target =
      wantedTrack && wantedTrack.id !== primaryId && canBeSecondarySub(wantedTrack)
        ? wantedTrack.id
        : null;
    if (target === currentId) {
      appliedRef.current = target;
      return;
    }
    if (appliedRef.current === target) return;
    appliedRef.current = target;
    bridge.setSecondarySubtitleTrack(target);
  }, [bridgeRef, choice, lang, snap.subtitleTracks]);
}
