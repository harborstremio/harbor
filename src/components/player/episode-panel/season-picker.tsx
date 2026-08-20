import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

export function SeasonPicker({
  seasons,
  active,
  onChange,
}: {
  seasons: number[];
  active: number;
  onChange: (n: number) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 items-center gap-1.5 rounded-full bg-elevated ps-3.5 pe-2.5 text-[13px] font-semibold text-ink ring-1 ring-edge-soft transition-colors hover:bg-raised"
      >
        {active === 0 ? t("Specials") : t("Season {n}", { n: active })}
        <ChevronDown
          size={15}
          strokeWidth={2.4}
          className={`text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-30 mt-2 max-h-[52vh] w-44 overflow-y-auto rounded-2xl border border-edge bg-elevated p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)] animate-in fade-in slide-in-from-top-1 duration-150">
          {seasons.map((n) => (
            <button
              key={n}
              onClick={() => {
                onChange(n);
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-xl px-3.5 py-2.5 text-start text-[13.5px] transition-colors ${
                n === active
                  ? "bg-accent font-semibold text-canvas"
                  : "text-ink-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {n === 0 ? t("Specials") : t("Season {n}", { n })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
