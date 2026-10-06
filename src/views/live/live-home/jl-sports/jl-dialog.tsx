import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

/** Centered dialog: Escape or the backdrop closes it; focus starts on its first button for remotes. */
export function JlDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Runs once per open: parents re-render on every scoreboard poll and must not steal focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus], [data-dialog-body] button")?.focus();
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-canvas/80 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        className={`relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-2xl ${
          wide ? "max-w-[640px]" : "max-w-[440px]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-edge-soft px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle hover:bg-raised hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-4" data-dialog-body>
          {children}
        </div>
      </div>
    </div>
  );
}
