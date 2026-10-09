import { useCallback, useState } from "react";
import { MAX_SLOTS } from "./bridge";

export type Layout = "1" | "2" | "2v" | "3" | "2x2";

export type SlotChannel = { name: string; url: string; userAgent?: string };

export type MultiviewState = {
  slots: (SlotChannel | null)[];
  layout: Layout;
  audioFocus: number;
  split: number;
  splitRow: number;
  splitRow2: number;
  split3a: number;
  split3b: number;
};

const LAYOUT_KEY = "harbor.multiview.layout";
const SPLIT_KEY = "harbor.multiview.split";
const SPLIT_ROW_KEY = "harbor.multiview.split-row";
const SPLIT_ROW2_KEY = "harbor.multiview.split-row2";
const SPLIT3A_KEY = "harbor.multiview.split3a";
const SPLIT3B_KEY = "harbor.multiview.split3b";

export const SPLIT_MIN = 28;
export const SPLIT_MAX = 72;
export const SPLIT_DEFAULT = 50;
export const SPLIT3A_MIN = 20;
export const SPLIT3A_MAX = 70;
export const SPLIT3A_DEFAULT = 33.3;
export const SPLIT3B_MIN = 25;
export const SPLIT3B_MAX = 90;
export const SPLIT3B_DEFAULT = 50;

function clampNum(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clampSplit(n: number): number {
  if (!Number.isFinite(n)) return SPLIT_DEFAULT;
  return clampNum(n, SPLIT_MIN, SPLIT_MAX);
}

export function clampSplitRow(n: number): number {
  if (!Number.isFinite(n)) return SPLIT_DEFAULT;
  return clampNum(n, SPLIT_MIN, SPLIT_MAX);
}

export function clampSplit3a(n: number): number {
  if (!Number.isFinite(n)) return SPLIT3A_DEFAULT;
  return clampNum(n, SPLIT3A_MIN, SPLIT3A_MAX);
}

export function clampSplit3b(n: number): number {
  if (!Number.isFinite(n)) return SPLIT3B_DEFAULT;
  return clampNum(n, SPLIT3B_MIN, SPLIT3B_MAX);
}

function readNum(key: string, fallback: number, clamp: (n: number) => number): number {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  return v == null ? fallback : clamp(Number(v));
}

function initialLayout(): Layout {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(LAYOUT_KEY) : null;
  return v === "1" || v === "2" || v === "2v" || v === "3" || v === "2x2" ? v : "2x2";
}

export function layoutSlotCount(l: Layout): number {
  if (l === "1") return 1;
  if (l === "2" || l === "2v") return 2;
  if (l === "3") return 3;
  return 4;
}

export function useMultiviewStore() {
  const [slots, setSlots] = useState<(SlotChannel | null)[]>(() =>
    Array.from({ length: MAX_SLOTS }, () => null),
  );
  const [layout, setLayoutState] = useState<Layout>(initialLayout);
  const [audioFocus, setAudioFocus] = useState(0);
  const [split, setSplitState] = useState<number>(readNum(SPLIT_KEY, SPLIT_DEFAULT, clampSplit));
  const [splitRow, setSplitRowState] = useState<number>(
    readNum(SPLIT_ROW_KEY, SPLIT_DEFAULT, clampSplitRow),
  );
  const [splitRow2, setSplitRow2State] = useState<number>(
    readNum(SPLIT_ROW2_KEY, SPLIT_DEFAULT, clampSplitRow),
  );
  const [split3a, setSplit3aState] = useState<number>(
    readNum(SPLIT3A_KEY, SPLIT3A_DEFAULT, clampSplit3a),
  );
  const [split3b, setSplit3bState] = useState<number>(
    readNum(SPLIT3B_KEY, SPLIT3B_DEFAULT, clampSplit3b),
  );

  const persist = useCallback(
    (key: string) => (v: string) => {
      try {
        localStorage.setItem(key, v);
      } catch {
        /* noop */
      }
    },
    [],
  );

  const setSlot = useCallback((i: number, ch: SlotChannel | null) => {
    setSlots((cur) => {
      const next = cur.slice();
      next[i] = ch;
      return next;
    });
  }, []);

  const setLayout = useCallback(
    (l: Layout) => {
      setLayoutState(l);
      persist(LAYOUT_KEY)(l);
    },
    [persist],
  );

  const setSplit = useCallback(
    (n: number) => {
      const c = clampSplit(n);
      setSplitState(c);
      persist(SPLIT_KEY)(String(c));
    },
    [persist],
  );

  const setSplitRow = useCallback(
    (n: number) => {
      const c = clampSplitRow(n);
      setSplitRowState(c);
      persist(SPLIT_ROW_KEY)(String(c));
    },
    [persist],
  );

  const setSplitRow2 = useCallback(
    (n: number) => {
      const c = clampSplitRow(n);
      setSplitRow2State(c);
      persist(SPLIT_ROW2_KEY)(String(c));
    },
    [persist],
  );

  const setSplit3a = useCallback(
    (n: number) => {
      const c = clampSplit3a(n);
      setSplit3aState(c);
      persist(SPLIT3A_KEY)(String(c));
    },
    [persist],
  );

  const setSplit3b = useCallback(
    (n: number) => {
      const c = clampSplit3b(n);
      setSplit3bState(c);
      persist(SPLIT3B_KEY)(String(c));
    },
    [persist],
  );

  const reset = useCallback(() => {
    setSlots(Array.from({ length: MAX_SLOTS }, () => null));
    setAudioFocus(0);
  }, []);

  return {
    slots,
    layout,
    audioFocus,
    split,
    splitRow,
    splitRow2,
    split3a,
    split3b,
    setSlot,
    setLayout,
    setAudioFocus,
    setSplit,
    setSplitRow,
    setSplitRow2,
    setSplit3a,
    setSplit3b,
    reset,
  };
}
