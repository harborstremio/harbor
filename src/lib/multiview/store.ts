import { useCallback, useState } from "react";

import { MAX_SLOTS } from "./bridge";

export type Layout = "1" | "2" | "3" | "2x2";

export type SlotChannel = { name: string; url: string; userAgent?: string };

export type MultiviewState = {
  slots: (SlotChannel | null)[];
  layout: Layout;
  audioFocus: number;
};

const LAYOUT_KEY = "harbor.multiview.layout";

function initialLayout(): Layout {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(LAYOUT_KEY) : null;
  return v === "1" || v === "2" || v === "3" || v === "2x2" ? v : "2x2";
}

export function layoutSlotCount(l: Layout): number {
  if (l === "1") return 1;
  if (l === "2") return 2;
  if (l === "3") return 3;
  return 4;
}

export function useMultiviewStore() {
  const [slots, setSlots] = useState<(SlotChannel | null)[]>(() => Array.from({ length: MAX_SLOTS }, () => null));
  const [layout, setLayoutState] = useState<Layout>(initialLayout);
  const [audioFocus, setAudioFocus] = useState(0);

  const setSlot = useCallback((i: number, ch: SlotChannel | null) => {
    setSlots((cur) => {
      const next = cur.slice();
      next[i] = ch;
      return next;
    });
  }, []);

  const setLayout = useCallback((l: Layout) => {
    setLayoutState(l);
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* noop */
    }
  }, []);

  const reset = useCallback(() => {
    setSlots(Array.from({ length: MAX_SLOTS }, () => null));
    setAudioFocus(0);
  }, []);

  return {
    slots,
    layout,
    audioFocus,
    setSlot,
    setLayout,
    setAudioFocus,
    reset,
  };
}
