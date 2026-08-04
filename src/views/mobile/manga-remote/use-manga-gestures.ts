import { useEffect, useMemo, useRef, useState } from "react";
import {
  DOUBLE_TAP_MS,
  EDGE_GUTTER,
  FLICK_VEL,
  RUBBER,
  SLOP,
  TAP_MS,
  TAP_SLOP,
  TURN_FRAC,
  clampZoom,
  emaVel,
  project,
  readingDir,
  type TurnDir,
} from "./gesture-math";

export type MangaGestureInput = {
  rtl: boolean;
  canPrev: boolean;
  canNext: boolean;
  zoom: number;
  canZoom: boolean;
  reduce: boolean;
  onTurn: (dir: TurnDir) => void;
  onZoom: (zoom: number) => void;
  onToggleChrome: () => void;
  progressive?: boolean;
  onDrag?: (progress: number) => void;
  onDragEnd?: (commit: boolean, dir: TurnDir) => void;
};

type Visual = { tx: number; scale: number; hintDir: TurnDir | null };
type Mode = "idle" | "pending" | "drag" | "pinch";

const GLIDE_MS = 220;
const PINCH_MIN = 0.85;
const PINCH_MAX = 1.6;
const STANDALONE_GUTTER = 8;

export function useMangaGestures(input: MangaGestureInput) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [visual, setVisual] = useState<Visual>({ tx: 0, scale: 1, hintDir: null });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const st = useRef({
    mode: "idle" as Mode,
    startX: 0,
    startY: 0,
    startT: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vel: 0,
    width: 1,
    tx: 0,
    pinchD0: 0,
    pinchZoom0: 1,
    lastSentZoom: -1,
    raf: 0,
    streamRaf: 0,
    streamVal: 0,
    tapTimer: 0,
    lastTapAt: 0,
  });

  const gutter = useMemo(() => {
    if (typeof window === "undefined") return EDGE_GUTTER;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    return standalone ? STANDALONE_GUTTER : EDGE_GUTTER;
  }, []);

  const cancelRaf = () => {
    if (st.current.raf) cancelAnimationFrame(st.current.raf);
    st.current.raf = 0;
  };

  const progressiveOn = () =>
    !!input.progressive &&
    !!input.onDrag &&
    !!input.onDragEnd &&
    !input.reduce &&
    input.zoom <= 1.01;

  const cancelStream = () => {
    if (st.current.streamRaf) cancelAnimationFrame(st.current.streamRaf);
    st.current.streamRaf = 0;
  };

  const scheduleStream = (v: number) => {
    st.current.streamVal = v;
    if (st.current.streamRaf) return;
    st.current.streamRaf = requestAnimationFrame(() => {
      st.current.streamRaf = 0;
      input.onDrag?.(st.current.streamVal);
    });
  };

  const glideToZero = () => {
    cancelRaf();
    const from = st.current.tx;
    if (input.reduce || Math.abs(from) < 0.5) {
      st.current.tx = 0;
      setVisual((v) => ({ ...v, tx: 0, hintDir: null }));
      return;
    }
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / GLIDE_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      const tx = from * (1 - eased);
      st.current.tx = tx;
      setVisual((v) => ({ ...v, tx, hintDir: null }));
      if (p < 1) {
        st.current.raf = requestAnimationFrame(tick);
      } else {
        st.current.tx = 0;
        st.current.raf = 0;
        setVisual((v) => ({ ...v, tx: 0, hintDir: null }));
      }
    };
    st.current.raf = requestAnimationFrame(tick);
  };

  const resolveCommit = () => {
    const w = st.current.width;
    const tx = st.current.tx;
    const vel = st.current.vel;
    const flick = Math.abs(vel) >= FLICK_VEL;
    const projected = tx + project(vel);
    const passed = Math.abs(tx) >= TURN_FRAC * w || Math.abs(projected) >= TURN_FRAC * w;
    const carrier = flick ? vel : tx;
    if (progressiveOn()) {
      cancelStream();
      const dir = readingDir(carrier || tx || -1, input.rtl);
      const ok = dir === "next" ? input.canNext : input.canPrev;
      input.onDragEnd?.((flick || passed) && carrier !== 0 && ok, dir);
      glideToZero();
      return;
    }
    if ((flick || passed) && carrier !== 0) {
      const dir = readingDir(carrier, input.rtl);
      const ok = dir === "next" ? input.canNext : input.canPrev;
      if (ok) input.onTurn(dir);
    }
    glideToZero();
  };

  const handleTap = () => {
    if (!input.canZoom) {
      input.onToggleChrome();
      return;
    }
    const now = performance.now();
    if (st.current.lastTapAt > 0 && now - st.current.lastTapAt <= DOUBLE_TAP_MS) {
      if (st.current.tapTimer) window.clearTimeout(st.current.tapTimer);
      st.current.tapTimer = 0;
      st.current.lastTapAt = 0;
      input.onZoom(clampZoom(input.zoom > 1.01 ? 1 : 2));
      return;
    }
    st.current.lastTapAt = now;
    if (st.current.tapTimer) window.clearTimeout(st.current.tapTimer);
    st.current.tapTimer = window.setTimeout(() => {
      st.current.tapTimer = 0;
      st.current.lastTapAt = 0;
      input.onToggleChrome();
    }, DOUBLE_TAP_MS);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const vw = typeof window === "undefined" ? 0 : window.innerWidth;
    if (vw > 0 && (e.clientX <= gutter || e.clientX >= vw - gutter)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2) {
      cancelRaf();
      st.current.mode = "pinch";
      st.current.tx = 0;
      if (input.canZoom) {
        const pts = [...pointers.current.values()];
        const a = pts[0];
        const b = pts[1];
        st.current.pinchD0 = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        st.current.pinchZoom0 = input.zoom;
        st.current.lastSentZoom = input.zoom;
      } else {
        st.current.pinchD0 = 0;
      }
      setVisual((v) => ({ ...v, tx: 0, hintDir: null }));
      return;
    }

    cancelRaf();
    const now = performance.now();
    st.current.mode = "pending";
    st.current.width = Math.max(1, surfaceRef.current?.getBoundingClientRect().width ?? vw);
    st.current.startX = e.clientX;
    st.current.startY = e.clientY;
    st.current.startT = now;
    st.current.lastX = e.clientX;
    st.current.lastY = e.clientY;
    st.current.lastT = now;
    st.current.vel = 0;
    st.current.tx = 0;
    setVisual((v) => (v.tx === 0 && v.hintDir === null ? v : { ...v, tx: 0, hintDir: null }));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (st.current.mode === "pinch") {
      if (st.current.pinchD0 <= 0 || pointers.current.size < 2) return;
      const pts = [...pointers.current.values()];
      const a = pts[0];
      const b = pts[1];
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) / st.current.pinchD0;
      const z = clampZoom(st.current.pinchZoom0 * ratio);
      const scale = Math.max(PINCH_MIN, Math.min(PINCH_MAX, ratio));
      setVisual((v) =>
        v.scale === scale && v.tx === 0 ? v : { ...v, scale, tx: 0, hintDir: null },
      );
      if (z !== st.current.lastSentZoom) {
        st.current.lastSentZoom = z;
        input.onZoom(z);
      }
      return;
    }
    if (st.current.mode !== "pending" && st.current.mode !== "drag") return;

    const now = performance.now();
    const dx = e.clientX - st.current.startX;
    const dy = e.clientY - st.current.startY;
    if (st.current.mode === "pending") {
      if (Math.hypot(dx, dy) < SLOP) return;
      st.current.mode = "drag";
    }
    const dt = Math.max(1, now - st.current.lastT);
    st.current.vel = emaVel(st.current.vel, (e.clientX - st.current.lastX) / dt);
    st.current.lastX = e.clientX;
    st.current.lastY = e.clientY;
    st.current.lastT = now;

    const dir = readingDir(dx, input.rtl);
    const allowed = dir === "next" ? input.canNext : input.canPrev;
    const w = st.current.width;
    const travel = allowed ? dx : dx * RUBBER;
    const tx = Math.max(-w, Math.min(w, travel));
    st.current.tx = tx;
    const hintDir = allowed && Math.abs(tx) >= TURN_FRAC * w ? dir : null;
    setVisual((v) => (v.tx === tx && v.hintDir === hintDir ? v : { ...v, tx, hintDir }));
    if (progressiveOn()) scheduleStream(allowed ? tx / w : 0);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (!pointers.current.delete(e.pointerId)) return;
    const remaining = pointers.current.size;

    if (st.current.mode === "pinch") {
      if (remaining === 0) {
        st.current.pinchD0 = 0;
        st.current.lastSentZoom = -1;
        st.current.mode = "idle";
        setVisual((v) => ({ ...v, scale: 1, tx: 0, hintDir: null }));
      }
      return;
    }
    if (remaining > 0) return;

    if (st.current.mode === "drag") {
      resolveCommit();
      st.current.mode = "idle";
      return;
    }
    if (st.current.mode === "pending") {
      const held = performance.now() - st.current.startT;
      const moved = Math.hypot(
        st.current.lastX - st.current.startX,
        st.current.lastY - st.current.startY,
      );
      if (held <= TAP_MS && moved <= TAP_SLOP) handleTap();
      st.current.mode = "idle";
      return;
    }
    st.current.mode = "idle";
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    const wasDrag = st.current.mode === "drag";
    st.current.mode = "idle";
    st.current.pinchD0 = 0;
    st.current.lastSentZoom = -1;
    if (wasDrag) {
      if (progressiveOn()) {
        cancelStream();
        input.onDragEnd?.(false, readingDir(st.current.tx || -1, input.rtl));
      }
      glideToZero();
    } else setVisual((v) => ({ ...v, tx: 0, scale: 1, hintDir: null }));
  };

  useEffect(() => {
    const activePointers = pointers.current;
    const gestureState = st.current;
    const clear = () => {
      activePointers.clear();
      gestureState.mode = "idle";
      gestureState.pinchD0 = 0;
      gestureState.vel = 0;
      gestureState.tx = 0;
      gestureState.lastSentZoom = -1;
      gestureState.lastTapAt = 0;
      if (gestureState.raf) cancelAnimationFrame(gestureState.raf);
      gestureState.raf = 0;
      if (gestureState.streamRaf) cancelAnimationFrame(gestureState.streamRaf);
      gestureState.streamRaf = 0;
      if (gestureState.tapTimer) window.clearTimeout(gestureState.tapTimer);
      gestureState.tapTimer = 0;
      setVisual({ tx: 0, scale: 1, hintDir: null });
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") clear();
    };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVisibility);
      if (gestureState.raf) cancelAnimationFrame(gestureState.raf);
      if (gestureState.streamRaf) cancelAnimationFrame(gestureState.streamRaf);
      if (gestureState.tapTimer) window.clearTimeout(gestureState.tapTimer);
    };
  }, []);

  return {
    surfaceRef,
    visual,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
