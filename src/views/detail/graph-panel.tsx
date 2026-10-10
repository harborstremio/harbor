import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Poster } from "@/components/poster";
import { ratingPosterSrc } from "@/lib/ratings/poster";

const PANEL_WIDTH = 360;
const PANEL_MAX_HEIGHT = 420;
const GAP = 10;

export function GraphPanel({
  title,
  subtitle,
  action,
  anchor,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  anchor: DOMRect | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (!anchor) return;
    const spaceBelow = window.innerHeight - anchor.bottom;
    const spaceAbove = anchor.top;
    const below = spaceBelow >= 240 || spaceBelow >= spaceAbove;
    const height = Math.min(
      PANEL_MAX_HEIGHT,
      (below ? spaceBelow : spaceAbove) - GAP - 12,
    );
    const top = below ? anchor.bottom + GAP : anchor.top - GAP - height;
    const start = document.dir === "rtl" ? anchor.right - PANEL_WIDTH : anchor.left;
    const left = Math.max(12, Math.min(start, window.innerWidth - PANEL_WIDTH - 12));
    setPos({ top, left });
  }, [anchor]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH, maxHeight: PANEL_MAX_HEIGHT }}
      className="fixed z-[135] flex flex-col overflow-hidden rounded-2xl border border-edge bg-elevated/97 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
    >
      <header className="flex items-start gap-2.5 border-b border-edge-soft px-3.5 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-[13.5px] font-semibold leading-tight text-ink">{title}</h3>
          {subtitle && <p className="truncate text-[10.5px] text-ink-muted">{subtitle}</p>}
          {action}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-canvas/60 hover:text-ink"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      </header>
      <ul className="flex-1 overflow-y-auto px-2 py-1.5 [scrollbar-width:thin]">{children}</ul>
    </div>,
    document.body,
  );
}

export function GraphPanelRow({
  lead,
  name,
  note,
  posterId,
  onClick,
}: {
  lead?: string;
  name: string;
  note?: string;
  posterId?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start transition-colors hover:bg-canvas/60"
    >
      {lead !== undefined && (
        <span className="w-9 shrink-0 font-mono text-[10px] tabular-nums text-ink-subtle">
          {lead}
        </span>
      )}
      <span className="w-[34px] shrink-0 overflow-hidden rounded-[5px] ring-1 ring-edge-soft">
        <Poster
          src={ratingPosterSrc(posterId ?? "")}
          seed={posterId || name}
          ratio="portrait"
          lazy
          className="w-full [--poster-radius:0px]"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[12px] font-semibold text-ink">{name}</span>
        {note && (
          <span className="line-clamp-2 text-[10.5px] leading-snug text-ink-muted">{note}</span>
        )}
      </span>
    </button>
  );
}

export function useAnchor(): {
  anchor: DOMRect | null;
  open: (e: { currentTarget: HTMLElement }) => void;
  close: () => void;
} {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const open = useCallback(
    (e: { currentTarget: HTMLElement }) => setAnchor(e.currentTarget.getBoundingClientRect()),
    [],
  );
  const close = useCallback(() => setAnchor(null), []);
  return { anchor, open, close };
}
