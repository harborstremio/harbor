import { useEffect, useRef } from "react";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const PINCH_SLOP = 6;

export function clampPinchZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100));
}

type Args = {
  zoom: number;
  onZoom?: (z: number) => void;
  onPan?: (dx: number, dy: number) => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
};

export function usePinchZoom({ zoom, onZoom, onPan, rootRef }: Args) {
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;
  const onPanRef = useRef(onPan);
  onPanRef.current = onPan;
  const pinch = useRef({
    pts: new Map<number, { x: number; y: number }>(),
    baseDist: 0,
    baseZoom: 1,
    lastZ: 1,
    rectLeft: 0,
    rectTop: 0,
    prevMidX: 0,
    prevMidY: 0,
    hasMid: false,
    frame: 0,
  });
  const pinchMoved = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onTouchMove = (e: TouchEvent) => {
      if (!onZoomRef.current) return;
      if (pinch.current.pts.size >= 2) e.preventDefault();
    };
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => root.removeEventListener("touchmove", onTouchMove);
  }, [rootRef]);

  const span = () => {
    const pts = [...pinch.current.pts.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onZoomRef.current) return;
    pinch.current.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.pts.size === 2) {
      const box = e.currentTarget.getBoundingClientRect();
      pinch.current.rectLeft = box.left;
      pinch.current.rectTop = box.top;
      pinch.current.baseDist = Math.max(1, span());
      pinch.current.baseZoom = zoomRef.current;
      pinch.current.lastZ = zoomRef.current;
      let mx = 0;
      let my = 0;
      for (const p of pinch.current.pts.values()) {
        mx += p.x;
        my += p.y;
      }
      mx = mx / 2 - box.left;
      my = my / 2 - box.top;
      pinch.current.prevMidX = mx;
      pinch.current.prevMidY = my;
      pinch.current.hasMid = true;
    }
  };

  const applyFrame = () => {
    const tracked = pinch.current;
    tracked.frame = 0;
    if (!onZoomRef.current || tracked.pts.size !== 2 || tracked.baseDist <= 0) return;
    const dist = span();
    if (Math.abs(dist - tracked.baseDist) > PINCH_SLOP) pinchMoved.current = true;
    const root = rootRef.current;
    const remote = onPanRef.current;
    if (root) {
      const box = root.getBoundingClientRect();
      let mmx = 0;
      let mmy = 0;
      for (const p of tracked.pts.values()) {
        mmx += p.x;
        mmy += p.y;
      }
      mmx = mmx / tracked.pts.size - box.left;
      mmy = mmy / tracked.pts.size - box.top;
      if (tracked.hasMid) {
        const pdx = mmx - tracked.prevMidX;
        const pdy = mmy - tracked.prevMidY;
        if (Math.abs(pdx) >= 1 || Math.abs(pdy) >= 1) {
          if (remote) remote(pdx, pdy);
          else {
            root.scrollLeft -= pdx;
            root.scrollTop -= pdy;
          }
        }
      }
      tracked.prevMidX = mmx;
      tracked.prevMidY = mmy;
      tracked.hasMid = true;
    }
    const z = clampPinchZoom(tracked.baseZoom * (dist / tracked.baseDist));
    if (z !== tracked.lastZ && tracked.lastZ > 0) {
      const k = z / tracked.lastZ;
      const root = rootRef.current;
      if (root && !onPanRef.current) {
        const box = root.getBoundingClientRect();
        let mx = 0;
        let my = 0;
        for (const p of tracked.pts.values()) {
          mx += p.x;
          my += p.y;
        }
        mx = mx / tracked.pts.size - box.left;
        my = my / tracked.pts.size - box.top;
        root.scrollLeft = (root.scrollLeft + mx) * k - mx;
        root.scrollTop = (root.scrollTop + my) * k - my;
      }
      tracked.lastZ = z;
    }
    onZoomRef.current(clampPinchZoom(tracked.baseZoom * (dist / tracked.baseDist)));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const tracked = pinch.current;
    if (!tracked.pts.has(e.pointerId)) return;
    tracked.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!onZoomRef.current || tracked.pts.size !== 2 || tracked.baseDist <= 0) return;
    if (tracked.frame) return;
    tracked.frame = requestAnimationFrame(applyFrame);
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinch.current.frame) {
      cancelAnimationFrame(pinch.current.frame);
      pinch.current.frame = 0;
      applyFrame();
    }
    pinch.current.pts.delete(e.pointerId);
  };

  const shouldSuppressClick = () => {
    if (pinchMoved.current) {
      pinchMoved.current = false;
      return true;
    }
    return false;
  };

  return { onPointerDown, onPointerMove, onPointerUp: endPointer, onPointerCancel: endPointer, shouldSuppressClick };
}
