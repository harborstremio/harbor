import { useT } from "@/lib/i18n";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LetterboxdRowMenu({
  canMoveUp,
  canMoveDown,
  hidden,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  hidden: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={t("Edit row")}
        className="flex h-6 w-6 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
      >
        <Pencil size={13} strokeWidth={2.2} />
      </button>
      {open && (
        <div className="absolute start-0 top-7 z-50 flex flex-col gap-0.5 rounded-xl border border-edge-soft bg-canvas p-1.5 shadow-xl">
          <button
            onClick={() => {
              onMoveUp();
              setOpen(false);
            }}
            disabled={!canMoveUp}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowUp size={14} strokeWidth={2.2} />
            {t("Move up")}
          </button>
          <button
            onClick={() => {
              onMoveDown();
              setOpen(false);
            }}
            disabled={!canMoveDown}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ArrowDown size={14} strokeWidth={2.2} />
            {t("Move down")}
          </button>
          <div className="my-0.5 h-px bg-edge-soft" />
          <button
            onClick={() => {
              onToggleHidden();
              setOpen(false);
            }}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              hidden
                ? "bg-accent/10 text-accent hover:bg-accent/20"
                : "text-red-300/80 hover:bg-red-400/10 hover:text-red-300"
            }`}
          >
            {hidden ? <Eye size={14} strokeWidth={2.2} /> : <EyeOff size={14} strokeWidth={2.2} />}
            {hidden ? t("Show") : t("Hide")}
          </button>
        </div>
      )}
    </div>
  );
}
