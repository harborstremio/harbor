import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ColorPopoverTrigger } from "@/views/settings/color-picker";
import { previewFamily } from "@/views/settings/player-panel/internals";
import { type Settings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

export const SWATCHES = ["#FFFFFF", "#FFE45E", "#9AE6B4", "#93C5FD", "#FCA5A5", "#C4B5FD"];

const BUILT_IN_FONTS: Array<{ id: string; label: string }> = [
  { id: "inter", label: "Inter" },
  { id: "system", label: "System" },
  { id: "rounded", label: "Rounded" },
  { id: "serif", label: "Serif" },
  { id: "arabic", label: "Arabic" },
];

export function FontMenu({
  value,
  fonts,
  onChange,
}: {
  value: string;
  fonts: Settings["customFonts"];
  onChange: (f: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const items = [
    ...BUILT_IN_FONTS,
    ...(fonts ?? []).map((f) => ({ id: `custom:${f.id}`, label: f.name })),
  ];
  const current = items.find((i) => i.id === value) ?? items[0];

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, left: r.left });
    };
    place();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 min-w-[120px] shrink-0 items-center justify-between gap-2 px-3 text-[14px] font-semibold text-ink transition-colors hover:bg-elevated"
        style={{ fontFamily: previewFamily(value) }}
      >
        <span className="truncate">
          {current.id.startsWith("custom:") ? current.label : t(current.label)}
        </span>
        <ChevronDown size={15} className="shrink-0 text-ink-subtle" />
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[310]"
              onMouseDown={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <div
              ref={menuRef}
              className="fixed z-[320] max-h-[min(60vh,380px)] w-[208px] overflow-y-auto rounded-[14px] border border-edge bg-elevated p-1.5 shadow-[0_24px_60px_-14px_rgba(0,0,0,0.8)] backdrop-blur-md [scrollbar-width:thin]"
              style={{ top: pos.top, left: pos.left }}
            >
              {items.map((it) => {
                const active = it.id === value;
                return (
                  <button
                    key={it.id}
                    onClick={() => {
                      onChange(it.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-[9px] px-3 py-2.5 text-start text-[15px] transition-colors ${
                      active
                        ? "bg-raised text-ink"
                        : "text-ink-muted hover:bg-raised/60 hover:text-ink"
                    }`}
                    style={{ fontFamily: previewFamily(it.id) }}
                  >
                    <span className="truncate">
                      {it.id.startsWith("custom:") ? it.label : t(it.label)}
                    </span>
                    {active && <Check size={15} className="shrink-0 text-ink" />}
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

export function SizeStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useT();
  const drag = useRef({ active: false, startX: 0, startVal: 0 });
  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { active: true, startX: e.clientX, startVal: value };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    onChange(Math.round(drag.current.startVal + (e.clientX - drag.current.startX) / 6));
  };
  const onUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current.active = false;
  };
  return (
    <div className="flex h-11 shrink-0 items-stretch">
      <button
        aria-label={t("Smaller")}
        onClick={() => onChange(value - 1)}
        className="flex w-9 items-center justify-center text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <span className="text-[13px] font-bold">A</span>
      </button>
      <button
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="flex min-w-[48px] cursor-ew-resize touch-none items-center justify-center px-1 font-mono text-[14px] tabular-nums text-ink"
      >
        {value}
      </button>
      <button
        aria-label={t("Larger")}
        onClick={() => onChange(value + 1)}
        className="flex w-9 items-center justify-center text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <span className="text-[17px] font-bold">A</span>
      </button>
    </div>
  );
}

export function BoldToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={t("Bold")}
      title={t("Bold")}
      className={`m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[16px] font-bold transition-colors ${
        on ? "bg-elevated text-ink ring-1 ring-edge" : "text-ink-subtle hover:text-ink"
      }`}
    >
      B
    </button>
  );
}

export function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const t = useT();
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 px-2">
      {SWATCHES.map((c) => (
        <button
          key={c}
          aria-label={t("Subtitle color {color}", { color: c })}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
            value.toUpperCase() === c ? "ring-2 ring-ink" : "ring-1 ring-edge-soft"
          }`}
          style={{ background: c }}
        />
      ))}
      <ColorPopoverTrigger value={value} onChange={onChange} label="" direction="down" portal />
    </div>
  );
}
