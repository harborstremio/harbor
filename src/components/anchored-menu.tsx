import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const GAP = 6;
const EDGE = 8;
const MIN_HEIGHT = 120;

export function AnchoredMenu({
  anchorRef,
  open,
  onClose,
  width,
  backdrop = true,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  width?: number;
  backdrop?: boolean;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    up: boolean;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.max(r.width, width ?? 0);
      const left = Math.min(Math.max(EDGE, r.left), window.innerWidth - w - EDGE);
      const menuH = menuRef.current?.offsetHeight ?? 0;
      const above = r.top - GAP - EDGE;
      const below = window.innerHeight - r.bottom - GAP - EDGE;
      const up = menuH > below && above > below;
      const maxHeight = Math.max(MIN_HEIGHT, up ? above : below);
      const top = up ? Math.max(EDGE, r.top - GAP - Math.min(menuH, maxHeight)) : r.bottom + GAP;
      setPos({ top, left, width: w, maxHeight, up });
    };
    place();
    let raf: number | null = requestAnimationFrame(() => {
      raf = null;
      place();
    });
    const onScroll = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        place();
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) onClose();
    };
    if (!backdrop) document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKey);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, anchorRef, width, onClose, backdrop]);

  if (!open) return null;

  return createPortal(
    <>
      {backdrop && <div className="fixed inset-0 z-[300]" onMouseDown={onClose} />}
      <div
        ref={menuRef}
        data-anchored-up={pos?.up || undefined}
        className="fixed z-[310] flex flex-col"
        style={{
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          width: pos?.width,
          maxHeight: pos?.maxHeight,
          visibility: pos ? undefined : "hidden",
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
