import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CustomColorPanel } from "@/views/settings/color-picker";

export function ColorPopover({
  value,
  onChange,
  align = "start",
  direction = "down",
  className = "",
  children,
}: {
  value: string;
  onChange: (hex: string) => void;
  align?: "start" | "end";
  direction?: "up" | "down";
  className?: string;
  children: (open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = 280;
      const raw = align === "end" ? r.right - width : r.left;
      const left = Math.min(Math.max(8, raw), window.innerWidth - width - 8);
      const top = direction === "up" ? r.top - 8 : r.bottom + 8;
      setPos({ top: Math.max(8, top), left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, direction]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative block h-full w-full text-start outline-none"
      >
        {children(open)}
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[310]"
              onMouseDown={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <div
              ref={panelRef}
              className="animate-nudge-in fixed z-[320] w-[280px] rounded-md bg-surface p-3 harbor-float"
              style={{
                top: pos.top,
                left: pos.left,
                ...(direction === "up" ? { transform: "translateY(-100%)" } : null),
              }}
            >
              <CustomColorPanel value={value} onChange={onChange} />
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
