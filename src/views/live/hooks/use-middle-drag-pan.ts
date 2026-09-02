import { useEffect, type RefObject } from "react";

export function useMiddleDragPan(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let panning = false;
    let startX = 0;
    let startY = 0;
    let fromLeft = 0;
    let fromTop = 0;
    let prevCursor = "";

    const stop = () => {
      if (!panning) return;
      panning = false;
      el.style.cursor = prevCursor;
      el.style.userSelect = "";
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 1) return;
      panning = true;
      startX = e.clientX;
      startY = e.clientY;
      fromLeft = el.scrollLeft;
      fromTop = el.scrollTop;
      prevCursor = el.style.cursor;
      el.style.cursor = "grabbing";
      el.style.userSelect = "none";
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety, panning still works without it */
      }
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!panning) return;
      el.scrollLeft = fromLeft - (e.clientX - startX);
      el.scrollTop = fromTop - (e.clientY - startY);
      e.preventDefault();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!panning) return;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      stop();
    };

    // middle press otherwise arms Chromium's own autoscroll, which fights ours
    const swallowMiddle = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("lostpointercapture", stop);
    el.addEventListener("mousedown", swallowMiddle);
    el.addEventListener("auxclick", swallowMiddle);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("lostpointercapture", stop);
      el.removeEventListener("mousedown", swallowMiddle);
      el.removeEventListener("auxclick", swallowMiddle);
      stop();
    };
  }, [ref]);
}
