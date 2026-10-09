import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function HoverPreviewCard({
  open,
  anchorRef,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchor = anchorRef.current;
    const card = cardRef.current;
    if (!anchor) return;
    const a = anchor.getBoundingClientRect();
    const cw = card?.offsetWidth ?? 320;
    const ch = card?.offsetHeight ?? 220;
    const m = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rtl = document.documentElement.dir === "rtl";
    let left = rtl ? a.left - m - cw : a.right + m;
    const fits = rtl ? left >= m : left + cw <= vw - m;
    if (!fits) left = rtl ? a.right + m : a.left - m - cw;
    left = Math.min(Math.max(m, left), vw - m - cw);
    let top = a.top + a.height / 2 - ch / 2;
    top = Math.min(Math.max(m, top), vh - m - ch);
    setPos({ left, top });
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={cardRef}
      role="tooltip"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      className={`pointer-events-none fixed z-[120] w-[320px] rounded-md border border-edge-soft/80 bg-elevated/95 p-4 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.78)] backdrop-blur-xl transition-opacity duration-150 ${
        pos ? "animate-popover-in opacity-100" : "opacity-0"
      }`}
    >
      {children}
    </div>,
    document.body,
  );
}
