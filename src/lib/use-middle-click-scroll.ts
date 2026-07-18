import { useEffect } from "react";

function nearestScrollable(node: EventTarget | null): HTMLElement | null {
  let el = node instanceof HTMLElement ? node : null;
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 4) return el;
    el = el.parentElement;
  }
  return null;
}

export function useMiddleClickScroll() {
  useEffect(() => {
    let target: HTMLElement | null = null;
    let originY = 0;
    let cursorY = 0;
    let raf = 0;
    let marker: HTMLDivElement | null = null;

    const tick = () => {
      if (!target) return;
      const dy = cursorY - originY;
      const dead = 18;
      const mag = Math.abs(dy);
      if (mag > dead) {
        target.scrollTop += Math.sign(dy) * Math.pow((mag - dead) / 10, 1.45);
      }
      raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (!target) return;
      target = null;
      cancelAnimationFrame(raf);
      marker?.remove();
      marker = null;
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("wheel", stop, true);
      window.removeEventListener("keydown", stop, true);
      window.removeEventListener("mousedown", onGuardDown, true);
    };

    const onMove = (e: MouseEvent) => {
      cursorY = e.clientY;
    };
    const onGuardDown = () => stop();

    const onDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      if (target) {
        e.preventDefault();
        stop();
        return;
      }
      const scrollable = nearestScrollable(e.target);
      if (!scrollable) return;
      e.preventDefault();
      target = scrollable;
      originY = e.clientY;
      cursorY = e.clientY;
      marker = document.createElement("div");
      marker.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:32px;height:32px;margin:-16px 0 0 -16px;border-radius:9999px;border:2px solid rgba(255,255,255,0.55);background:rgba(0,0,0,0.4);box-shadow:0 2px 12px rgba(0,0,0,0.5);z-index:2147483647;pointer-events:none;display:flex;align-items:center;justify-content:center;`;
      const dot = document.createElement("span");
      dot.style.cssText =
        "width:5px;height:5px;border-radius:9999px;background:rgba(255,255,255,0.85);";
      marker.appendChild(dot);
      document.body.appendChild(marker);
      document.body.style.cursor = "ns-resize";
      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("wheel", stop, true);
      window.addEventListener("keydown", stop, true);
      window.addEventListener("mousedown", onGuardDown, true);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousedown", onDown, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      stop();
    };
  }, []);
}

export function MiddleClickScroll(): null {
  useMiddleClickScroll();
  return null;
}
