import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function HoverTooltip({
  label,
  sublabel,
  mark,
  side = "bottom",
  align = "start",
  arrow = false,
  delayMs = 260,
  disabled = false,
  large = false,
  className,
  children,
}: {
  label: string;
  sublabel?: string | null;
  mark?: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  arrow?: boolean;
  delayMs?: number;
  disabled?: boolean;
  large?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; anchor: number } | null>(null);
  const [placed, setPlaced] = useState<{ top: number; left: number; flipped: boolean } | null>(null);
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
        align === "center" ? r.left + r.width / 2 : align === "end" ? r.right - 8 : r.left + 8,
      anchor: r.left + r.width / 2,
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
    // A tooltip that would run off the top or bottom flips to the other side of
    // the trigger rather than being clamped on top of it.
    let top = side === "top" ? pos.top - h : pos.top;
    let flipped = false;
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (wrap) {
      if (side === "top" && top < 8) {
        top = wrap.bottom + 8;
        flipped = true;
      } else if (side === "bottom" && top + h > window.innerHeight - 8) {
        top = wrap.top - 8 - h;
        flipped = true;
      }
    }
    top = Math.min(Math.max(8, top), window.innerHeight - h - 8);
    setPlaced({ top, left, flipped });
  }, [open, pos, side, align]);

  const shown = side === "top" ? (placed?.flipped ? "bottom" : "top") : placed?.flipped ? "top" : "bottom";
  const originX = align === "center" ? "50%" : align === "end" ? "100%" : "14px";
  const arrowLeft = placed && pos ? Math.min(Math.max(12, pos.anchor - placed.left), 999) : 12;

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
              className="harbor-tip-pop"
              style={{ transformOrigin: `${originX} ${shown === "top" ? "100%" : "0%"}` }}
            >
              <div
                role="tooltip"
                className={`harbor-float relative w-max rounded-md bg-raised leading-snug font-medium text-ink ring-1 ring-edge ${
                  large
                    ? "max-w-[320px] rounded-xl px-4 py-3 text-[15px] font-semibold"
                    : "max-w-[280px] px-3 py-2 text-[12px]"
                }`}
              >
                <span className="flex items-center gap-2">
                  {mark}
                  <span className="block whitespace-normal break-words">{label}</span>
                </span>
                {sublabel &&
                  (large ? (
                    <span className="mt-1 block text-[13.5px] font-normal leading-relaxed text-ink-muted">
                      {sublabel}
                    </span>
                  ) : (
                    <span
                      className={`mt-1 block text-[11px] font-normal tabular-nums text-ink-subtle ${
                        mark ? "ps-[14px]" : ""
                      }`}
                    >
                      {sublabel}
                    </span>
                  ))}
                {arrow && (
                  <span
                    aria-hidden
                    className="absolute block h-0 w-0 border-x-[6px] border-x-transparent"
                    style={
                      shown === "top"
                        ? {
                            top: "100%",
                            left: arrowLeft - 6,
                            borderTop: "6px solid var(--color-raised)",
                          }
                        : {
                            bottom: "100%",
                            left: arrowLeft - 6,
                            borderBottom: "6px solid var(--color-raised)",
                          }
                    }
                  />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
