import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { AddonRef } from "./use-catalog-list";

function AddonMark({ addon, size = 20 }: { addon: AddonRef; size?: number }) {
  if (addon.logo)
    return (
      <img
        src={addon.logo}
        alt=""
        draggable={false}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-[5px] object-contain"
      />
    );
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-[5px] bg-canvas text-[10px] font-bold text-ink-subtle ring-1 ring-edge-soft"
    >
      {addon.name.charAt(0).toUpperCase()}
    </span>
  );
}

export function AddonFilterSelect({
  addons,
  value,
  onChange,
}: {
  addons: AddonRef[];
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  const selected = addons.find((a) => a.name === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-11 items-center gap-2.5 rounded-full border ps-3 pe-3.5 text-[13.5px] font-semibold transition-colors ${
          open || value !== "all"
            ? "border-edge bg-elevated text-ink"
            : "border-edge-soft bg-elevated/40 text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
      >
        {selected ? (
          <AddonMark addon={selected} size={20} />
        ) : (
          <Layers size={17} className="text-ink-subtle" />
        )}
        <span className="max-w-[180px] truncate">{selected ? selected.name : t("All addons")}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute start-0 top-[calc(100%+6px)] z-40 flex max-h-[380px] w-[280px] flex-col overflow-y-auto rounded-2xl border border-edge bg-canvas p-1.5 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <Row
            active={value === "all"}
            onClick={() => {
              onChange("all");
              setOpen(false);
            }}
          >
            <span className="flex h-5 w-5 items-center justify-center">
              <Layers size={16} className="text-ink-subtle" />
            </span>
            <span className="flex-1 truncate text-ink">{t("All addons")}</span>
          </Row>
          <div className="my-1 h-px bg-edge-soft/60" />
          {addons.map((a) => (
            <Row
              key={a.name}
              active={value === a.name}
              onClick={() => {
                onChange(a.name);
                setOpen(false);
              }}
            >
              <AddonMark addon={a} size={20} />
              <span className="flex-1 truncate text-ink">{a.name}</span>
              <span className="shrink-0 text-[11.5px] text-ink-subtle">{a.count}</span>
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-[13.5px] font-medium transition-colors ${
        active ? "bg-elevated" : "hover:bg-elevated/60"
      }`}
    >
      {children}
      {active && <Check size={15} className="shrink-0 text-accent" />}
    </button>
  );
}
