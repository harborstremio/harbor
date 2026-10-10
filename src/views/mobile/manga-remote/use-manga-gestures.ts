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
  axis?: "x" | "y";
  tapZones?: boolean;
  onTurn: (dir: TurnDir) => void;
  onZoom: (zoom: number) => void;
  onPan?: (dx: number, dy: number) => void;
  onToggleChrome: () => void;
  progressive?: boolean;
  onDrag?: (progress: number) => void;
  onDragEnd?: (commit: boolean, dir: TurnDir) => void;
};

type Visual = { tx: number; ty: number; scale: number; hintDir: TurnDir | null };
type Mode = "idle" | "pending" | "drag" | "pinch";

const GLIDE_MS = 220;
const PINCH_MIN = 0.85;
const PINCH_MAX = 1.6;
const STANDALONE_GUTTER = 8;

export function useMangaGestures(input: MangaGestureInput) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [visual, setVisual] = useState<Visual>({ tx: 0, ty: 0, scale: 1, hintDir: null });
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
    height: 1,
    tx: 0,
    ty: 0,
    pinchD0: 0,
    pinchZoom0: 1,
    lastSentZoom: -1,
    panX: Number.NaN,
    panY: Number.NaN,
    raf: 0,
    streamRaf: 0,
    streamVal: 0,
    tapTimer: 0,
    lastTapAt: 0,
  });
  const axis = input.axis ?? "x";

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
    !!input.progressive && !!input.onDrag && !!input.onDragEnd && !input.reduce && input.zoom <= 1.01;

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
    const fromX = st.current.tx;
    const fromY = st.current.ty;
    if (input.reduce || (Math.abs(fromX) < 0.5 && Math.abs(fromY) < 0.5)) {
      st.current.tx = 0;
      st.current.ty = 0;
      setVisual((v) => ({ ...v, tx: 0, ty: 0, hintDir: null }));
      return;
    }
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / GLIDE_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      const tx = fromX * (1 - eased);
      const ty = fromY * (1 - eased);
      st.current.tx = tx;
      st.current.ty = ty;
      setVisual((v) => ({ ...v, tx, ty, hintDir: null }));
      if (p < 1) {
        st.current.raf = requestAnimationFrame(tick);
      } else {
        st.current.tx = 0;
        st.current.ty = 0;
        st.current.raf = 0;
        setVisual((v) => ({ ...v, tx: 0, ty: 0, hintDir: null }));
      }
    };
    st.current.raf = requestAnimationFrame(tick);
  };

  const resolveCommit = () => {
    const size = axis === "y" ? st.current.height : st.current.width;
    const t = axis === "y" ? st.current.ty : st.current.tx;
    const vel = st.current.vel;
    const flick = Math.abs(vel) >= FLICK_VEL;
    const projected = t + project(vel);
    const passed = Math.abs(t) >= TURN_FRAC * size || Math.abs(projected) >= TURN_FRAC * size;
    const carrier = flick ? vel : t;
    if (progressiveOn()) {
      cancelStream();
      const dir = readingDir(carrier || t || -1, input.rtl);
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

  const handleTap = (fracX: number) => {
    if (input.tapZones) {
      const zone = fracX < 1 / 3 ? "prev" : fracX > 2 / 3 ? "next" : null;
      if (zone == null) {
        input.onToggleChrome();
        return;
      }
      const ok = zone === "next" ? input.canNext : input.canPrev;
      if (ok) input.onTurn(zone);
      return;
    }
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
      st.current.ty = 0;
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
      setVisual((v) => ({ ...v, tx: 0, ty: 0, hintDir: null }));
      st.current.panX = Number.NaN;
      st.current.panY = Number.NaN;
      return;
    }

    cancelRaf();
    const now = performance.now();
    st.current.mode = "pending";
    const rect = surfaceRef.current?.getBoundingClientRect();
    st.current.width = Math.max(1, rect?.width ?? vw);
    st.current.height = Math.max(1, rect?.height ?? 1);
    st.current.startX = e.clientX;
    st.current.startY = e.clientY;
    st.current.startT = now;
    st.current.lastX = e.clientX;
    st.current.lastY = e.clientY;
    st.current.lastT = now;
    st.current.vel = 0;
    st.current.tx = 0;
    st.current.ty = 0;
    setVisual((v) => (v.tx === 0 && v.ty === 0 && v.hintDir === null ? v : { ...v, tx: 0, ty: 0, hintDir: null }));
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
      setVisual((v) => (v.scale === scale && v.tx === 0 && v.ty === 0 ? v : { ...v, scale, tx: 0, ty: 0, hintDir: null }));
      if (z !== st.current.lastSentZoom) {
        st.current.lastSentZoom = z;
        input.onZoom(z);
      }
      if (input.onPan) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        if (Number.isNaN(st.current.panX)) {
          st.current.panX = mx;
          st.current.panY = my;
        } else {
          const dx = mx - st.current.panX;
          const dy = my - st.current.panY;
          st.current.panX = mx;
          st.current.panY = my;
          if (dx !== 0 || dy !== 0) input.onPan(dx, dy);
        }
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
    const primaryNow = axis === "y" ? e.clientY : e.clientX;
    const primaryLast = axis === "y" ? st.current.lastY : st.current.lastX;
    st.current.vel = emaVel(st.current.vel, (primaryNow - primaryLast) / dt);
    st.current.lastX = e.clientX;
    st.current.lastY = e.clientY;
    st.current.lastT = now;

    const d = axis === "y" ? dy : dx;
    const dir = readingDir(d, input.rtl);
    const allowed = dir === "next" ? input.canNext : input.canPrev;
    const size = axis === "y" ? st.current.height : st.current.width;
    const travel = allowed ? d : d * RUBBER;
    const t = Math.max(-size, Math.min(size, travel));
    if (axis === "y") {
      st.current.ty = t;
      st.current.tx = 0;
    } else {
      st.current.tx = t;
      st.current.ty = 0;
    }
    const hintDir = allowed && Math.abs(t) >= TURN_FRAC * size ? dir : null;
    setVisual((v) => (v.tx === st.current.tx && v.ty === st.current.ty && v.hintDir === hintDir ? v : { ...v, tx: st.current.tx, ty: st.current.ty, hintDir }));
    if (progressiveOn()) scheduleStream(allowed ? t / size : 0);
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
        st.current.panX = Number.NaN;
        st.current.panY = Number.NaN;
        st.current.mode = "idle";
        setVisual((v) => ({ ...v, scale: 1, tx: 0, ty: 0, hintDir: null }));
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
      const moved = Math.hypot(st.current.lastX - st.current.startX, st.current.lastY - st.current.startY);
      if (held <= TAP_MS && moved <= TAP_SLOP) {
        const rect = surfaceRef.current?.getBoundingClientRect();
        const fracX = rect && rect.width > 0 ? (st.current.lastX - rect.left) / rect.width : 0.5;
        handleTap(fracX);
      }
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
    } else setVisual((v) => ({ ...v, tx: 0, ty: 0, scale: 1, hintDir: null }));
  };

  useEffect(() => {
    const clear = () => {
      pointers.current.clear();
      const s = st.current;
      s.mode = "idle";
      s.pinchD0 = 0;
      s.vel = 0;
      s.tx = 0;
      s.ty = 0;
      s.lastSentZoom = -1;
      s.lastTapAt = 0;
      s.panX = Number.NaN;
      s.panY = Number.NaN;
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
      if (s.streamRaf) cancelAnimationFrame(s.streamRaf);
      s.streamRaf = 0;
      if (s.tapTimer) window.clearTimeout(s.tapTimer);
      s.tapTimer = 0;
      setVisual({ tx: 0, ty: 0, scale: 1, hintDir: null });
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") clear();
    };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVisibility);
      const s = st.current;
      if (s.raf) cancelAnimationFrame(s.raf);
      if (s.streamRaf) cancelAnimationFrame(s.streamRaf);
      if (s.tapTimer) window.clearTimeout(s.tapTimer);
    };
  }, []);

  return {
    surfaceRef,
    visual,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
