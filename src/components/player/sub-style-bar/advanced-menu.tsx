import { ChevronDown, Minus, Plus, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings, type Settings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const OUTLINE_MODES: Array<{ id: "shadow" | "outline" | "box"; label: string }> = [
  { id: "shadow", label: "Shadow" },
  { id: "outline", label: "Outline" },
  { id: "box", label: "Box" },
];

const ALIGNS: Array<"left" | "center" | "right"> = ["left", "center", "right"];

export function AdvancedMenu() {
  const t = useT();
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, left: Math.min(r.left, window.innerWidth - 276) });
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
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const overrideOn = settings.subAssOverride !== "no" && settings.subAssOverride !== "scale";

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("More subtitle options")}
        aria-pressed={open}
        title={t("More subtitle options")}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] transition-colors ${
          open ? "bg-raised text-ink" : "text-ink-subtle hover:bg-raised hover:text-ink"
        }`}
      >
        <Settings2 size={18} strokeWidth={2} />
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
              className="fixed z-[320] w-[260px] rounded-[16px] border border-edge bg-elevated p-2 shadow-[0_24px_60px_-14px_rgba(0,0,0,0.8)] backdrop-blur-md"
              style={{ top: pos.top, left: pos.left }}
            >
              <Row label={t("Edge")}>
                <Segmented
                  options={OUTLINE_MODES.map((m) => ({ id: m.id, label: t(m.label) }))}
                  value={settings.subStyle}
                  onChange={(v) => update({ subStyle: v as Settings["subStyle"] })}
                />
              </Row>
              {settings.subStyle === "outline" && (
                <Row label={t("Thickness")}>
                  <Stepper
                    value={settings.subBorderSize}
                    onDec={() => update({ subBorderSize: stepBorder(settings.subBorderSize, -0.5) })}
                    onInc={() => update({ subBorderSize: stepBorder(settings.subBorderSize, 0.5) })}
                  />
                </Row>
              )}
              <Row label={t("Position")}>
                <div className="flex items-center gap-1">
                  <IconBtn label={t("Raise subtitles")} onClick={() => update({ subMarginY: clamp(settings.subMarginY + 2, 0, 100) })}>
                    <ChevronDown size={15} className="rotate-180" />
                  </IconBtn>
                  <IconBtn label={t("Lower subtitles")} onClick={() => update({ subMarginY: clamp(settings.subMarginY - 2, 0, 100) })}>
                    <ChevronDown size={15} />
                  </IconBtn>
                </div>
              </Row>
              <Row label={t("Align")}>
                <Segmented
                  options={ALIGNS.map((a) => ({ id: a, label: t(a) }))}
                  value={settings.subAlignX}
                  onChange={(v) => update({ subAlignX: v as Settings["subAlignX"] })}
                />
              </Row>
              <Row label={t("Line spacing")}>
                <Stepper
                  value={settings.subLineSpacing ?? 0}
                  onDec={() => update({ subLineSpacing: clamp((settings.subLineSpacing ?? 0) - 1, 0, 12) })}
                  onInc={() => update({ subLineSpacing: clamp((settings.subLineSpacing ?? 0) + 1, 0, 12) })}
                />
              </Row>
              <div className="my-1.5 h-px bg-edge-soft" />
              <button
                onClick={() => update({ subAssOverride: overrideOn ? "no" : "force" })}
                className="flex w-full items-start gap-3 rounded-[10px] p-2 text-start transition-colors hover:bg-raised"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink">{t("Override embedded styles")}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-subtle">
                    {t("Force your look onto subtitles that carry their own styling.")}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                    overrideOn ? "bg-accent" : "bg-edge"
                  }`}
                >
                  <span className={`h-4 w-4 rounded-full bg-white transition-transform ${overrideOn ? "translate-x-4" : ""}`} />
                </span>
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5">
      <span className="text-[13.5px] font-medium text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center rounded-[9px] bg-raised p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-[7px] px-2.5 py-1 text-[12.5px] font-semibold capitalize transition-colors ${
            value === o.id ? "bg-elevated text-ink shadow-sm" : "text-ink-subtle hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function stepBorder(current: number, delta: number): number {
  const base = Number.isFinite(current) ? current : 2;
  return Math.round(clamp(base + delta, 1, 6) * 2) / 2;
}

function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return (
    <div className="flex items-center rounded-[9px] bg-raised">
      <IconBtn label="−" onClick={onDec}>
        <Minus size={14} />
      </IconBtn>
      <span className="min-w-[34px] text-center font-mono text-[13px] tabular-nums text-ink">{shown}</span>
      <IconBtn label="+" onClick={onInc}>
        <Plus size={14} />
      </IconBtn>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
    >
      {children}
    </button>
  );
}
