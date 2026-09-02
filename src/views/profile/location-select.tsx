import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { countryFlagSrc } from "@/components/flag";
import { useT } from "@/lib/i18n";
import { COUNTRIES } from "./flags";

function FlagBadge({ code, size = 16 }: { code?: string; size?: number }) {
  const src = code ? countryFlagSrc(code) : null;
  if (!src) return <Globe size={size} className="shrink-0 text-ink-subtle" />;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="shrink-0"
      style={{ height: size, width: size * 1.5, borderRadius: 2, objectFit: "cover", boxShadow: "0 0 0 1px rgba(255,255,255,0.06)" }}
    />
  );
}

export function LocationSelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = COUNTRIES.find((c) => c.code === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-md bg-elevated px-3 text-start text-[14px] text-ink ring-1 ring-edge-soft transition-colors hover:ring-edge"
      >
        <FlagBadge code={current?.code} />
        <span className="flex-1 truncate">{current ? current.name : t("No location")}</span>
        <ChevronDown size={16} className={`shrink-0 text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-edge bg-elevated py-1 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)]">
          <Option label={t("No location")} selected={!value} onClick={() => { onChange(""); setOpen(false); }} />
          {COUNTRIES.map((c) => (
            <Option
              key={c.code}
              code={c.code}
              label={c.name}
              selected={c.code === value}
              onClick={() => {
                onChange(c.code);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Option({ code, label, selected, onClick }: { code?: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-[13.5px] transition-colors hover:bg-raised ${selected ? "bg-raised/60 text-ink" : "text-ink-muted"}`}
    >
      <FlagBadge code={code} size={14} />
      <span className="truncate">{label}</span>
    </button>
  );
}
