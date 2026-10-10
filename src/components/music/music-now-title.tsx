import { useEffect, useRef, useState, type CSSProperties } from "react";

export function MusicNowTitle({ title }: { title: string }) {
  const viewport = useRef<HTMLHeadingElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const box = viewport.current, line = text.current;
    if (!box || !line) return;
    const measure = () => {
      const distance = Math.max(0, line.scrollWidth - box.clientWidth);
      setShift(getComputedStyle(box).direction === "rtl" ? distance : -distance);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(line);
    return () => observer.disconnect();
  }, [title]);
  return <h1 ref={viewport} className="music-now-title" dir="auto" tabIndex={shift ? 0 : undefined}
    title={shift ? title : undefined} data-overflow={!!shift || undefined}
    style={{ "--music-title-shift": `${shift}px`, "--music-title-duration": `${Math.max(1600, Math.abs(shift) / 28 * 1000)}ms` } as CSSProperties}>
    <span className="music-now-title-still">{title}</span>
    <span ref={text} className="music-now-title-moving" aria-hidden="true">{title}</span>
  </h1>;
}
