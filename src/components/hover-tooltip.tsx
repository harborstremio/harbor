import { useEffect, useRef, useState, type ReactNode } from "react";

export function HoverTooltip({
  label,
  sublabel,
  side = "bottom",
  align = "start",
  delayMs = 260,
  className,
  large: _large = false,
  children,
}: {
  label: string;
  sublabel?: string | null;
  side?: "top" | "bottom";
  align?: "start" | "center";
  delayMs?: number;
  className?: string;
  /** Accepted for manga collection badges; sizing stays compact on main. */
  large?: boolean;
  children: ReactNode;
}) {
  void _large;
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const cancel = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const enter = () => {
    cancel();
    timer.current = window.setTimeout(() => setOpen(true), delayMs);
  };
  const leave = () => {
    cancel();
    setOpen(false);
  };

  useEffect(() => () => cancel(), []);

  const vCls = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  const hCls = align === "center" ? "left-1/2 -translate-x-1/2" : "start-2";

  return (
    <div
      className={`relative ${className ?? ""}`}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
    >
      {children}
      {open && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-max max-w-[260px] rounded-lg border border-edge-soft/70 bg-elevated/95 px-2.5 py-1.5 text-[12px] leading-snug font-medium text-ink shadow-[0_10px_28px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md animate-popover-in ${vCls} ${hCls}`}
        >
          <span className="block whitespace-normal break-words">{label}</span>
          {sublabel && (
            <span className="mt-0.5 block text-[10.5px] font-normal tracking-[0.04em] uppercase text-ink-subtle">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
