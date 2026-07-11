import type { PlayerBridge } from "@/lib/player/bridge";
import { useSettings } from "@/lib/settings";
import { PICTURE_KEYS } from "@/views/settings/mpv-panel/dials";
import { useEffect, type RefObject } from "react";

export function useLivePictureEq(bridgeRef: RefObject<PlayerBridge | null>, srcKey: string) {
  const { settings } = useSettings();
  const mpvTweaks = settings.mpvTweaks;
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const tweaks = mpvTweaks ?? {};
    for (const key of PICTURE_KEYS) {
      const raw = tweaks[key];
      const value = raw != null && raw !== "" ? parseFloat(raw) : 0;
      bridge.setVideoEq(key, Number.isFinite(value) ? value : 0);
    }
  }, [mpvTweaks, srcKey, bridgeRef]);
}
