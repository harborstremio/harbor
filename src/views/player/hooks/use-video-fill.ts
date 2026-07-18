import { useEffect, useRef, useState, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { t } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";

type CropMode = {
  id: string;
  label: string;
  panscan: number;
  aspect: string;
  zoom: number;
  stretch?: boolean;
};

const ZOOM_MIN = 0;
const ZOOM_MAX = 1;

const MODES: CropMode[] = [
  { id: "fit", label: "Fit", panscan: 0, aspect: "-1", zoom: 0 },
  { id: "fill", label: "Fill", panscan: 1, aspect: "-1", zoom: 0 },
  { id: "stretch", label: "Stretch", panscan: 0, aspect: "-1", zoom: 0, stretch: true },
  { id: "zoom", label: "Zoom", panscan: 0, aspect: "-1", zoom: 0 },
  { id: "16:9", label: "16:9", panscan: 0, aspect: "16:9", zoom: 0 },
  { id: "4:3", label: "4:3", panscan: 0, aspect: "4:3", zoom: 0 },
  { id: "21:9", label: "21:9", panscan: 0, aspect: "21:9", zoom: 0 },
  { id: "1.85:1", label: "1.85:1", panscan: 0, aspect: "1.85:1", zoom: 0 },
  { id: "original", label: "2.39:1", panscan: 0, aspect: "2.39:1", zoom: 0 },
];

export const CROP_PRESETS: ReadonlyArray<{ id: string; label: string }> = MODES.filter(
  (m) => m.id !== "zoom",
).map((m) => ({ id: m.id, label: m.label }));

const modeIndex = (id: string) => {
  const i = MODES.findIndex((m) => m.id === id);
  return i < 0 ? 0 : i;
};

export function useVideoFill(
  bridgeRef: RefObject<PlayerBridge | null>,
  srcKey: string,
  loaded: boolean,
) {
  const { settings, update } = useSettings();
  const [pill, setPill] = useState<string | null>(null);
  const index = useRef(modeIndex(settings.cropMode));
  const zoom = useRef(0);
  const timer = useRef<number | null>(null);
  const appliedSrc = useRef<string | null>(null);

  const flash = (text: string) => {
    setPill(text);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPill(null), 1200);
  };

  const apply = (i: number, zoomLevel: number, showPill: boolean) => {
    const mode = MODES[i];
    const bridge = bridgeRef.current;
    if (bridge) {
      bridge.setPanscan(mode.panscan);
      bridge.setAspectOverride(mode.aspect);
      bridge.setVideoZoom(mode.id === "zoom" ? zoomLevel : 0);
      bridge.setStretch(mode.stretch === true);
    }
    if (!showPill) return;
    if (mode.id === "zoom" && zoomLevel > 0) {
      flash(t("Zoom {pct}%", { pct: Math.round(Math.pow(2, zoomLevel) * 100) }));
    } else {
      flash(t(mode.label));
    }
  };

  useEffect(() => {
    index.current = modeIndex(settings.cropMode);
    zoom.current = 0;
    appliedSrc.current = null;
    apply(index.current, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcKey]);

  useEffect(() => {
    if (!loaded || appliedSrc.current === srcKey) return;
    appliedSrc.current = srcKey;
    apply(index.current, zoom.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, srcKey]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const cycle = () => {
    const next = (index.current + 1) % MODES.length;
    index.current = next;
    if (MODES[next].id !== "zoom") zoom.current = 0;
    apply(next, zoom.current, true);
    update({ cropMode: MODES[next].id });
  };

  const step = (delta: number) => {
    const zoomIdx = modeIndex("zoom");
    if (index.current !== zoomIdx) {
      index.current = zoomIdx;
      update({ cropMode: "zoom" });
    }
    zoom.current = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX, Math.round((zoom.current + delta) * 100) / 100),
    );
    apply(zoomIdx, zoom.current, true);
  };

  const setMode = (id: string) => {
    const i = modeIndex(id);
    index.current = i;
    if (MODES[i].id !== "zoom") zoom.current = 0;
    apply(i, zoom.current, true);
    update({ cropMode: MODES[i].id });
  };

  return { cycle, step, setMode, mode: settings.cropMode, pill };
}
