import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";

export type NavEntry = {
  key: string;
  node: React.ReactNode;
  label: string;
  active: boolean;
  onSelect: () => void;
};

export function OverflowNav({
  entries,
  gapPx = 2,
  className = "",
  moreClassName,
}: {
  entries: NavEntry[];
  gapPx?: number;
  className?: string;
  moreClassName: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(entries.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const ghost = ghostRef.current;
    if (!container || !ghost) return;

    const measure = () => {
      const items = Array.from(ghost.querySelectorAll<HTMLElement>("[data-ghost-item]"));
      const moreEl = ghost.querySelector<HTMLElement>("[data-ghost-more]");
      const widths = items.map((el) => el.offsetWidth);
      const moreW = moreEl?.offsetWidth ?? 0;
      const avail = container.clientWidth;

      const totalAll = widths.reduce((a, b) => a + b, 0) + gapPx * Math.max(0, widths.length - 1);
      if (totalAll <= avail) {
        setVisible(widths.length);
        return;
      }
      let used = moreW + gapPx;
      let count = 0;
      for (const w of widths) {
        const add = w + gapPx;
        if (used + add > avail) break;
        used += add;
        count++;
      }
      setVisible(count);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [entries, gapPx]);

  const shown = entries.slice(0, visible);
  const hidden = entries.slice(visible);

  return (
    <div
      ref={containerRef}
      data-tauri-drag-region
      className={`relative flex min-w-0 items-center ${className}`}
      style={{ gap: gapPx }}
    >
      {shown.map((e) => (
        <span key={e.key} className="shrink-0">
          {e.node}
        </span>
      ))}
      {hidden.length > 0 && <MoreMenu entries={hidden} buttonClassName={moreClassName} />}

      <div
        ref={ghostRef}
        inert
        data-tv-skip="true"
        aria-hidden
        className="pointer-events-none invisible absolute start-0 top-0 flex w-0 items-center overflow-hidden"
        style={{ gap: gapPx }}
      >
        {entries.map((e) => (
          <span key={e.key} data-ghost-item className="shrink-0">
            {e.node}
          </span>
        ))}
        <span data-ghost-more className="shrink-0">
          <MoreButton className={moreClassName} open={false} active={false} />
        </span>
      </div>
    </div>
  );
}

function MoreMenu({ entries, buttonClassName }: { entries: NavEntry[]; buttonClassName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const anyActive = entries.some((e) => e.active);

  return (
    <div ref={ref} className="relative shrink-0">
      <MoreButton
        className={buttonClassName}
        open={open}
        active={anyActive}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="absolute start-0 top-[calc(100%+8px)] z-50 flex min-w-[184px] flex-col overflow-hidden rounded-xl border border-edge bg-canvas/95 p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
          {entries.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => {
                e.onSelect();
                setOpen(false);
              }}
              className={`flex h-9 items-center rounded-lg px-3 text-start text-[13px] font-medium transition-colors hover:bg-raised ${
                e.active ? "text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MoreButton({
  className,
  open,
  active,
  onClick,
}: {
  className: string;
  open: boolean;
  active: boolean;
  onClick?: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={open}
      className={`${className} ${active || open ? "text-ink" : ""}`}
    >
      {t("common.more")}
      <ChevronDown
        size={14}
        strokeWidth={2.2}
        className={`transition-transform ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}
