import { ArrowUp, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

export function RankModalShell({
  open,
  onClose,
  ariaLabel,
  header,
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  header: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setShowTop(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowTop(el.scrollTop > 500);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);

  if (!open) return null;

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return createPortal(
    <div
      className="fixed inset-0 z-[175] flex items-stretch justify-center bg-canvas/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative m-6 flex max-h-[calc(100vh-3rem)] w-full max-w-[1240px] flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_30px_120px_-30px_rgba(0,0,0,0.85)] ring-1 ring-edge-soft animate-popover-in motion-reduce:animate-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-edge-soft px-7 py-5">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted ring-1 ring-edge transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-6">
          {children}
        </div>

        <button
          onClick={() =>
            scrollRef.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
          }
          aria-label={t("Back to top")}
          className={`absolute bottom-5 end-5 z-10 flex h-11 w-11 items-center justify-center rounded-md bg-canvas/90 text-ink-muted ring-1 ring-edge-soft/40 transition-[transform,opacity,background-color,color] duration-300 hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none ${
            showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          <ArrowUp size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
