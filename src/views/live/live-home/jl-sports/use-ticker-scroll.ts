import { useEffect, type RefObject } from "react";

const SPEED_PX_S = 40;
const REDUCED_SPEED_PX_S = 12;
const RESUME_MS = 4000;
const RESUME_AFTER_LEAVE_MS = 1500;
const RESUME_AFTER_TOUCH_MS = 6000;
const DRAG_SLOP_PX = 4;

/**
 * The score ticker's crawl. It moves the track itself in a loop (the track holds the games
 * twice) and can be moved by hand with the wheel, a mouse or touch drag, or focus. Hover, focus
 * or any manual move pauses it; it picks up again a few seconds after you let go.
 *
 * The track is moved with a transform rather than by scrolling: Harbor closes tooltips and menus
 * on any scroll event, and a crawl would send one every frame.
 */
export function useTickerScroll(
  viewportRef: RefObject<HTMLDivElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  running: boolean,
) {
  useEffect(() => {
    const view = viewportRef.current;
    const track = trackRef.current;
    if (!view || !track || !running) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = reduce ? REDUCED_SPEED_PX_S : SPEED_PX_S;
    let x = 0;
    let last = performance.now();
    let raf = 0;
    let hover = false;
    let focus = false;
    let drag: { id: number; x: number; from: number; moved: boolean; touch: boolean } | null = null;
    let resumeAt = 0;

    const half = () => track.scrollWidth / 2;
    const wrap = (v: number) => {
      const h = half();
      return h > 0 ? ((v % h) + h) % h : 0;
    };
    const place = (v: number) => {
      x = v;
      track.style.transform = `translate3d(${-x}px, 0, 0)`;
    };
    const pause = (ms = RESUME_MS) => {
      resumeAt = performance.now() + ms;
    };

    const frame = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!hover && !focus && !drag && t >= resumeAt && !document.hidden)
        place(wrap(x + speed * dt));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d) return;
      e.preventDefault();
      place(wrap(x + d));
      pause();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag = {
        id: e.pointerId,
        x: e.clientX,
        from: x,
        moved: false,
        touch: e.pointerType !== "mouse",
      };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > DRAG_SLOP_PX) {
        drag.moved = true;
        view.style.cursor = "grabbing";
      }
      if (drag.moved) place(wrap(drag.from - dx));
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { moved, touch } = drag;
      drag = null;
      view.style.cursor = "";
      pause(touch ? RESUME_AFTER_TOUCH_MS : RESUME_MS);
      // A drag is not a click: releasing over a game must not open it.
      if (moved) {
        view.addEventListener(
          "click",
          (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          },
          { capture: true, once: true },
        );
      }
    };
    // Remote, gamepad and keyboard move focus cell to cell; centring the focused game keeps its
    // neighbours on screen so the next arrow press reaches them. No wrap here, or the focused
    // cell would jump out of view behind its duplicate.
    const onFocusIn = (e: FocusEvent) => {
      focus = true;
      const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-ticker-cell]");
      if (!cell) return;
      const box = view.getBoundingClientRect();
      const r = cell.getBoundingClientRect();
      const max = Math.max(0, track.scrollWidth - box.width);
      place(Math.min(max, Math.max(0, x + r.left + r.width / 2 - (box.left + box.width / 2))));
    };
    const onFocusOut = () => {
      requestAnimationFrame(() => {
        focus = view.contains(document.activeElement);
      });
      pause(RESUME_AFTER_LEAVE_MS);
    };
    const onEnter = () => {
      hover = true;
    };
    const onLeave = () => {
      hover = false;
      pause(RESUME_AFTER_LEAVE_MS);
    };

    view.addEventListener("wheel", onWheel, { passive: false });
    view.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    view.addEventListener("focusin", onFocusIn);
    view.addEventListener("focusout", onFocusOut);
    view.addEventListener("mouseenter", onEnter);
    view.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      view.removeEventListener("wheel", onWheel);
      view.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      view.removeEventListener("focusin", onFocusIn);
      view.removeEventListener("focusout", onFocusOut);
      view.removeEventListener("mouseenter", onEnter);
      view.removeEventListener("mouseleave", onLeave);
    };
  }, [viewportRef, trackRef, running]);
}
