import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ProxiedImg } from "./proxied-img";
import { usePinchZoom } from "./hooks/use-pinch-zoom";

export function ModePaged({
  pages,
  anchor,
  total,
  rtl,
  double,
  onTurn,
  onToggleChrome,
  zoom = 1,
  onZoom,
}: {
  pages: string[];
  anchor: number;
  total: number;
  rtl: boolean;
  double: boolean;
  onTurn: (dir: "next" | "prev") => void;
  onToggleChrome: () => void;
  zoom?: number;
  onZoom?: (z: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pinch = usePinchZoom({ zoom, onZoom, rootRef });
  const pair = [anchor, anchor + 1].filter((i) => i < total);
  const ordered = double ? (rtl ? pair.slice().reverse() : pair) : [anchor];
  const solo = ordered.length <= 1;

  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pinch.shouldSuppressClick()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(1, rect.width);
    if (x < 0.33) onTurn(rtl ? "next" : "prev");
    else if (x > 0.67) onTurn(rtl ? "prev" : "next");
    else onToggleChrome();
  };

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => {
      const w = Math.max(1, Math.round(root.clientWidth));
      const h = Math.max(1, Math.round(root.clientHeight));
      setViewport((v) => (v.w === w && v.h === h ? v : { w, h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const zoomed = zoom > 1 && viewport.w > 0 && viewport.h > 0;
  const imgStyle: CSSProperties = zoomed
    ? {
        width: `${Math.round((solo ? viewport.w : viewport.w / 2) * zoom)}px`,
        height: "auto",
        maxWidth: "none",
        maxHeight: "none",
      }
    : { maxWidth: solo ? "100%" : "50%", maxHeight: "100%" };

  return (
    <div
      ref={rootRef}
      className={`flex h-full w-full touch-none select-none gap-1 px-1 ${
        zoomed ? "overflow-auto" : ""
      }`}
      style={zoomed ? { touchAction: "pan-x pan-y" } : undefined}
      onClick={onTap}
      onPointerDown={pinch.onPointerDown}
      onPointerMove={pinch.onPointerMove}
      onPointerUp={pinch.onPointerUp}
      onPointerCancel={pinch.onPointerCancel}
    >
      <div className="m-auto flex items-center justify-center gap-1">
        {ordered.map((i) => (
          <ProxiedImg key={i} url={pages[i] ?? ""} className="block shrink-0 object-contain" style={imgStyle} />
        ))}
      </div>
    </div>
  );
}
