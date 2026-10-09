import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { t } from "@/lib/i18n";
import type { PlayerBridge } from "@/lib/player/bridge";
import {
  captureBaseTitle,
  captureDir,
  formatPosition,
  formatStamp,
  joinPath,
  safeName,
} from "@/lib/player/capture-path";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { PlayerSrc } from "@/lib/view";

export type FrameGrabToast = {
  id: number;
  kind: "ok" | "error";
  text: string;
  path?: string;
};

export function useFrameGrab(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  src: PlayerSrc;
}): { toast: FrameGrabToast | null; trigger: () => void } {
  const { bridgeRef, src } = params;
  const [toast, setToast] = useState<FrameGrabToast | null>(null);
  const busyRef = useRef(false);
  const dismissTimer = useRef<number | null>(null);

  const trigger = useCallback(async () => {
    if (busyRef.current) return;
    const bridge = bridgeRef.current;
    if (!bridge) return;
    busyRef.current = true;
    try {
      const filename = `${safeName(captureBaseTitle(src))} - ${formatStamp(new Date())} - ${formatPosition(
        getPlaybackPosition(),
      )}.png`;
      const dir = await captureDir();
      const fullPath = dir ? await joinPath(dir, filename) : filename;
      const result = await bridge.screenshot(fullPath);
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
      if (result.ok) {
        setToast({
          id: Date.now(),
          kind: "ok",
          text: t("Screenshot saved to {path}", { path: dir ? "Pictures/Harbor" : "downloads" }),
          path: result.path,
        });
      } else {
        setToast({
          id: Date.now(),
          kind: "error",
          text: result.error || t("Frame grab failed"),
        });
      }
      dismissTimer.current = window.setTimeout(() => setToast(null), 5200);
    } finally {
      busyRef.current = false;
    }
  }, [bridgeRef, src.meta.name, src.episode]);

  useEffect(
    () => () => {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    },
    [],
  );

  return { toast, trigger };
}
