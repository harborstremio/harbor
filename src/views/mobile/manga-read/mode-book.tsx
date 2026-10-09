import { useEffect, useMemo, useRef } from "react";
import { BookFlip, type BookApi } from "@/views/manga/manga-reader/book-view";
import { proxied, READER_BG_HEX } from "./local-reader-types";
import { usePinchZoom } from "./hooks/use-pinch-zoom";

export function ModeBook({
  pages,
  rtl,
  resumePage,
  onProgress,
  zoom = 1,
  onZoom,
  onToggleChrome,
  onPan,
  onTurn,
  onReady,
}: {
  pages: string[];
  rtl: boolean;
  resumePage: number;
  onProgress: (page: number, spread: string) => void;
  zoom?: number;
  onZoom?: (z: number) => void;
  onToggleChrome: () => void;
  onPan?: (dx: number, dy: number) => void;
  onTurn?: (dir: "next" | "prev") => void;
  onReady?: (api: BookApi) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pinch = usePinchZoom({ zoom, onZoom, onPan, rootRef: wrapRef });
  const proxiedPages = useMemo(() => pages.map(proxied), [pages]);
  const turnRef = useRef(onTurn);
  turnRef.current = onTurn;
  const chromeRef = useRef(onToggleChrome);
  chromeRef.current = onToggleChrome;

  useEffect(() => {
    const root = wrapRef.current;
    if (!root || !rtl) return;
    let tracking: { x: number; y: number; t: number; id: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || tracking) return;
      if (zoom > 1.001) return;
      const t = e.touches[0];
      tracking = { x: t.clientX, y: t.clientY, t: performance.now(), id: t.identifier };
      e.stopPropagation();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      if (e.touches.length !== 1) {
        tracking = null;
        return;
      }
      e.stopPropagation();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const tr = tracking;
      tracking = null;
      e.stopPropagation();
      e.preventDefault();
      const touch = e.changedTouches[0];
      if (!touch || touch.identifier !== tr.id) return;
      const dx = touch.clientX - tr.x;
      const dy = touch.clientY - tr.y;
      if (Math.hypot(dx, dy) < 12 && performance.now() - tr.t < 300) {
        chromeRef.current();
        return;
      }
      const threshold = Math.max(48, (root.clientWidth || 1) * 0.18);
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;
      turnRef.current?.(dx > 0 ? "next" : "prev");
    };
    const onTouchCancel = () => {
      tracking = null;
    };
    root.addEventListener("touchstart", onTouchStart, { capture: true });
    root.addEventListener("touchmove", onTouchMove, { capture: true });
    root.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    root.addEventListener("touchcancel", onTouchCancel, { capture: true });
    return () => {
      root.removeEventListener("touchstart", onTouchStart, { capture: true });
      root.removeEventListener("touchmove", onTouchMove, { capture: true });
      root.removeEventListener("touchend", onTouchEnd, { capture: true });
      root.removeEventListener("touchcancel", onTouchCancel, { capture: true });
    };
  }, [rtl, zoom]);

  return (
    <div
      ref={wrapRef}
      className="h-full w-full"
      style={{ touchAction: "none" }}
      onClickCapture={() => {
        if (pinch.shouldSuppressClick()) return;
        onToggleChrome();
      }}
      onPointerDown={pinch.onPointerDown}
      onPointerMove={pinch.onPointerMove}
      onPointerUp={pinch.onPointerUp}
      onPointerCancel={pinch.onPointerCancel}
    >
      <BookFlip
        pages={proxiedPages}
        rtl={false}
        instantTurns={rtl}
        bg={READER_BG_HEX}
        resumePage={resumePage}
        soundEnabled={true}
        zoom={zoom}
        onProgress={onProgress}
        onReady={onReady}
      />
    </div>
  );
}
