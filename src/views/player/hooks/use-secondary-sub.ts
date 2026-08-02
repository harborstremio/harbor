import { useEffect, useRef, type RefObject } from "react";
import type { PlayerBridge, PlayerSnapshot, TrackInfo } from "@/lib/player/bridge";
import { resetSecondarySub, useSecondarySubChoice } from "@/lib/player/secondary-sub";
import { pickBestTrack } from "@/lib/subtitles/language";
import { applySecondarySubNative } from "@/lib/player/sub-style";
import type { Settings } from "@/lib/settings";

function autoPick(tracks: TrackInfo[], lang: string, primaryId: string | null): string | null {
  if (!lang.trim()) return null;
  const pool = tracks.filter((t) => t.id !== primaryId);
  return pickBestTrack(pool, [lang])?.id ?? null;
}

export function useSecondarySub({
  bridgeRef,
  snap,
  sourceUrl,
  lang,
  nativeRender,
  placement,
  marginY,
}: {
  bridgeRef: RefObject<PlayerBridge | null>;
  snap: PlayerSnapshot;
  sourceUrl: string;
  lang: string;
  /** True on surfaces our overlay cannot draw over, so mpv must render instead. */
  nativeRender: boolean;
  placement: Settings["subSecondaryPlacement"];
  marginY: number;
}): void {
  const choice = useSecondarySubChoice();
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    void applySecondarySubNative(nativeRender, placement, marginY);
  }, [nativeRender, placement, marginY]);

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
    const target = wanted != null && wanted !== primaryId ? wanted : null;
    if (target === currentId) {
      appliedRef.current = target;
      return;
    }
    if (appliedRef.current === target) return;
    appliedRef.current = target;
    bridge.setSecondarySubtitleTrack(target);
  }, [bridgeRef, choice, lang, snap.subtitleTracks]);
}
