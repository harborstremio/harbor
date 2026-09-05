import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";

export type MoreItem = { key: string; label: string };

export function SportsMoreMenu({
  items,
  selected,
  onSelect,
}: {
  items: MoreItem[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const holdsSelection = items.some((it) => it.key === selected);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (items.length === 0) setOpen(false);
  }, [items.length]);

  if (items.length === 0) return null;

  const shell = holdsSelection
    ? "border-transparent bg-ink text-canvas"
    : open
      ? "border-transparent bg-raised text-ink"
      : "border-edge-soft/60 bg-elevated text-ink-muted hover:border-edge hover:text-ink";

  return (
    <div ref={wrapRef} className="relative flex shrink-0 items-center">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors ${shell}`}
      >
        <span>{t("More")}</span>
        <ChevronDown
          size={11}
          strokeWidth={2.4}
          className={`-me-0.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="animate-menu-pop absolute end-0 top-[calc(100%+6px)] z-50 max-h-[320px] w-[240px] overflow-y-auto overflow-x-hidden rounded-lg border border-edge bg-elevated py-1 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.6)]">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => {
                onSelect(it.key);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <span className="flex-1 truncate">{it.label}</span>
              {it.key === selected && <Check size={13} className="shrink-0 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
