import { ChevronDown } from "./icons";
import { useRef, useState, type ReactNode } from "react";

export function Disclosure({
  title,
  summary,
  art,
  defaultOpen,
  children,
}: {
  title: string;
  summary?: string;
  art?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const chevRef = useRef<HTMLSpanElement | null>(null);

  const toggle = () => {
    setOpen((v) => !v);
    const chev = chevRef.current;
    if (!chev) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const to = open ? 0 : 180;
    const from = open ? 180 : 0;
    chev.animate(
      [
        { transform: `rotate(${from}deg) scale(1, 1)` },
        { transform: `rotate(${(from + to) / 2}deg) scale(1.18, 0.82)`, offset: 0.42 },
        { transform: `rotate(${to + (open ? -14 : 14)}deg) scale(0.94, 1.08)`, offset: 0.72 },
        { transform: `rotate(${to}deg) scale(1, 1)` },
      ],
      { duration: 420, easing: "ease-in-out" },
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`group flex items-center gap-4 rounded-md px-4 py-3.5 text-start transition-colors ${
          open ? "bg-raised" : "bg-elevated hover:bg-raised"
        }`}
      >
        {art && <span className="shrink-0 text-ink-muted">{art}</span>}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-ink">{title}</span>
          {summary && (
            <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
              {summary}
            </span>
          )}
        </span>
        <span
          ref={chevRef}
          aria-hidden
          className="shrink-0 text-ink-subtle transition-colors group-hover:text-ink"
          style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <ChevronDown size={16} strokeWidth={2.2} />
        </span>
      </button>
      {open && <div className="harbor-cascade flex flex-col gap-1.5">{children}</div>}
    </div>
  );
}
