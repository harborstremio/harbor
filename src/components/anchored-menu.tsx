import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function AnchoredMenu({
  anchorRef,
  open,
  onClose,
  width,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.max(r.width, width ?? 0);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      const menuH = menuRef.current?.offsetHeight ?? 240;
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const openUp = menuH + 6 > spaceBelow && r.top - 8 > spaceBelow;
      const top = openUp ? Math.max(8, r.top - 6 - menuH) : r.bottom + 6;
      setPos({ top, left, width: w });
    };
    place();
    const raf = requestAnimationFrame(place);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, anchorRef, width, onClose]);

  if (!open || !pos) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[300]" onMouseDown={onClose} />
      <div
        ref={menuRef}
        className="fixed z-[310]"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
