import { useEffect, useRef, useState } from "react";
import { marqueeDurationMs } from "./marquee-motion";

export function OverflowMarquee({ text, title }: { text: string; title?: string }) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const textNode = textRef.current;
    if (!viewport || !textNode) return;

    const measure = () => {
      const overflow = Math.max(0, textNode.scrollWidth - viewport.clientWidth);
      const direction = window.getComputedStyle(textNode).direction;
      setDistance(direction === "rtl" ? overflow : -overflow);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(textNode);
    return () => observer.disconnect();
  }, [text]);

  useEffect(() => {
    const row = viewportRef.current?.closest<HTMLElement>("[data-subtitle-row]");
    if (!row) return;
    const activate = () => setHovered(true);
    const deactivate = () => setHovered(false);
    row.addEventListener("pointerenter", activate);
    row.addEventListener("pointerleave", deactivate);
    row.addEventListener("focusin", activate);
    row.addEventListener("focusout", deactivate);
    return () => {
      row.removeEventListener("pointerenter", activate);
      row.removeEventListener("pointerleave", deactivate);
      row.removeEventListener("focusin", activate);
      row.removeEventListener("focusout", deactivate);
    };
  }, []);

  const clipped = distance !== 0;
  const duration = marqueeDurationMs(Math.abs(distance));

  return (
    <span
      ref={viewportRef}
      className="block min-w-0 flex-1 overflow-hidden"
      title={clipped ? (title ?? text) : title}
    >
      <span
        ref={textRef}
        dir="auto"
        className="block w-max max-w-none whitespace-nowrap text-[12.5px] font-medium leading-snug text-ink motion-reduce:!transform-none motion-reduce:!transition-none"
        style={{
          transform: hovered && clipped ? `translateX(${distance}px)` : "translateX(0)",
          transitionDelay: hovered && clipped ? "350ms" : "0ms",
          transitionDuration: hovered && clipped ? `${duration}ms` : "180ms",
          transitionProperty: "transform",
          transitionTimingFunction: hovered && clipped ? "linear" : "cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        {text}
      </span>
    </span>
  );
}
