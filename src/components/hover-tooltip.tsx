import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function HoverTooltip({
  label,
  sublabel,
  side = "bottom",
  align = "start",
  delayMs = 260,
  disabled = false,
  large = false,
  className,
  children,
}: {
  label: string;
  sublabel?: string | null;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  delayMs?: number;
  disabled?: boolean;
  large?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [placed, setPlaced] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  const cancel = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const place = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: side === "top" ? r.top - 8 : r.bottom + 8,
      left:
        align === "center"
          ? r.left + r.width / 2
          : align === "end"
            ? r.right - 8
            : r.left + 8,
    });
  };
  const enter = () => {
    if (disabled) return;
    cancel();
    timer.current = window.setTimeout(() => {
      place();
      setOpen(true);
    }, delayMs);
  };
  const leave = () => {
    cancel();
    setOpen(false);
    setPlaced(null);
  };

  useEffect(() => () => cancel(), []);

  useEffect(() => {
    if (disabled) {
      cancel();
      setOpen(false);
      setPlaced(null);
    }
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open || !pos) return;
    const el = tipRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = align === "center" ? pos.left - w / 2 : align === "end" ? pos.left - w : pos.left;
    left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
    let top = side === "top" ? pos.top - h : pos.top;
    top = Math.min(Math.max(8, top), window.innerHeight - h - 8);
    setPlaced({ top, left });
  }, [open, pos, side, align]);


  return (
    <div
      ref={wrapRef}
      className={`relative inline-flex ${className ?? ""}`}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
    >
      {children}
      {open &&
        pos &&
        createPortal(
          <div
            ref={tipRef}
            className="pointer-events-none fixed z-[2000]"
            style={
              placed
                ? { top: placed.top, left: placed.left }
                : { top: pos.top, left: pos.left, visibility: "hidden" }
            }
          >
            <div
              role="tooltip"
              className={`w-max rounded-lg border border-edge-soft/70 bg-elevated/95 leading-snug font-medium text-ink shadow-[0_10px_28px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md animate-popover-in ${
                large
                  ? "max-w-[320px] rounded-xl px-4 py-3 text-[15px] font-semibold"
                  : "max-w-[260px] px-2.5 py-1.5 text-[12px]"
              }`}
            >
              <span className="block whitespace-normal break-words">{label}</span>
              {sublabel &&
                (large ? (
                  <span className="mt-1 block text-[13.5px] font-normal leading-relaxed text-ink-muted">
                    {sublabel}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[10.5px] font-normal tracking-[0.04em] uppercase text-ink-subtle">
                    {sublabel}
                  </span>
                ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
