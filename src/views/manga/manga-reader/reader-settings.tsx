import { useState } from "react";
import { Check, Maximize, Minus, Plus, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { ReaderNavPos, ReaderPrefs } from "./reader-types";
import { ReaderSettingsFrame } from "./reader-settings-frame";

const ICON = "/reader-icons";

type Cat = "mode" | "direction" | "fit" | "nav" | "background" | "zoom";

const CATS: Array<{ id: Cat; label: string; icon: string }> = [
  { id: "mode", label: "Reading mode", icon: "reading-mode" },
  { id: "direction", label: "Direction", icon: "flip-direction" },
  { id: "fit", label: "Fit", icon: "image-position" },
  { id: "nav", label: "Arrows", icon: "arrows" },
  { id: "background", label: "Brightness", icon: "brightness" },
  { id: "zoom", label: "Zoom", icon: "zoom" },
];

const NAV_POS: Array<{ v: ReaderNavPos; label: string }> = [
  { v: "stack-br", label: "Bottom right" },
  { v: "stack-bl", label: "Bottom left" },
  { v: "bottom", label: "Bottom center" },
  { v: "sides", label: "Sides" },
];

const MODES: Array<{ v: ReaderPrefs["mode"]; label: string; icon?: string; glyph?: ReactNode }> = [
  { v: "long", label: "Long strip", icon: "layout-long" },
  {
    v: "long-h",
    label: "Horizontal",
    glyph: (
      <img src={`${ICON}/layout-long.png`} alt="" className="h-12 w-12 rotate-90 object-contain" />
    ),
  },
  { v: "paged", label: "Single", icon: "layout-single" },
  { v: "double", label: "Double", icon: "layout-double" },
  { v: "book", label: "Book", icon: "layout-book" },
];

const DIRECTIONS: Array<{ v: boolean; label: string; icon: string }> = [
  { v: false, label: "Left to right", icon: "book-ltr" },
  { v: true, label: "Right to left", icon: "book-rtl" },
];

const BGS: Array<{ v: ReaderPrefs["bg"]; label: string; color: string }> = [
  { v: "dark", label: "Dark", color: "#0b0b0d" },
  { v: "gray", label: "Dim", color: "#404040" },
  { v: "light", label: "Light", color: "#f5f5f5" },
];

export function ReaderSettings({
  prefs,
  onChange,
  onClose,
}: {
  prefs: ReaderPrefs;
  onChange: (patch: Partial<ReaderPrefs>) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [cat, setCat] = useState<Cat>("mode");

  return (
    <ReaderSettingsFrame
      categories={CATS.map((category) => ({ ...category, label: t(category.label) }))}
      category={cat}
      onCategory={setCat}
      onClose={onClose}
    >
      {cat === "mode" && (
        <div className="flex flex-col gap-4">
          <CardRow>
            {MODES.map((m) => (
              <IconCard
                key={m.v}
                icon={m.icon}
                glyph={m.glyph}
                label={t(m.label)}
                selected={prefs.mode === m.v}
                onClick={() => onChange({ mode: m.v })}
              />
            ))}
          </CardRow>
          {prefs.mode === "double" && (
            <GapRow value={prefs.doubleGap} onChange={(g) => onChange({ doubleGap: g })} />
          )}
        </div>
      )}
      {cat === "direction" && (
        <div className="flex flex-col gap-4">
          <CardRow>
            {DIRECTIONS.map((d) => (
              <IconCard
                key={String(d.v)}
                icon={d.icon}
                label={t(d.label)}
                selected={prefs.rtl === d.v}
                onClick={() => onChange({ rtl: d.v })}
              />
            ))}
          </CardRow>
          <ToggleRow
            label={t("Auto next chapter")}
            on={prefs.autoNextChapter}
            onToggle={() => onChange({ autoNextChapter: !prefs.autoNextChapter })}
          />
          <ToggleRow
            label={t("Chapter-finished hint")}
            on={!prefs.hideChapterEndHint}
            onToggle={() => onChange({ hideChapterEndHint: !prefs.hideChapterEndHint })}
          />
        </div>
      )}
      {cat === "fit" && (
        <CardRow>
          <IconCard
            icon="fit-width"
            label={t("Fit width")}
            selected={prefs.fit === "width"}
            onClick={() => onChange({ fit: "width" })}
          />
          <IconCard
            icon="fit-height"
            label={t("Fit height")}
            selected={prefs.fit === "height"}
            onClick={() => onChange({ fit: "height" })}
          />
          <IconCard
            glyph={<Maximize size={30} strokeWidth={1.6} />}
            label={t("Original")}
            selected={prefs.fit === "original"}
            onClick={() => onChange({ fit: "original" })}
          />
        </CardRow>
      )}
      {cat === "nav" && (
        <div className="flex flex-col gap-4">
          <CardRow>
            {NAV_POS.map((n) => (
              <IconCard
                key={n.v}
                glyph={<PosGlyph pos={n.v} />}
                label={t(n.label)}
                selected={prefs.navPos === n.v}
                onClick={() => onChange({ navPos: n.v })}
              />
            ))}
          </CardRow>
          <div className="flex flex-col gap-1 border-t border-edge-soft/60 pt-3">
            <ToggleRow
              label={t("Focus mode")}
              on={prefs.focusMode}
              onToggle={() => onChange({ focusMode: !prefs.focusMode })}
            />
            <p className="max-w-[452px] text-[11.5px] leading-snug text-ink-subtle">
              {t(
                "Hide the top and bottom bars while reading. Arrows, page number, and bookmark stay; the bars return when your cursor reaches the screen edge.",
              )}
            </p>
          </div>
        </div>
      )}
      {cat === "background" && (
        <div className="flex items-center gap-3">
          {BGS.map((b) => (
            <button
              key={b.v}
              type="button"
              onClick={() => onChange({ bg: b.v })}
              aria-label={t(b.label)}
              className={`flex w-24 flex-col items-center gap-2 rounded-2xl border p-3 transition duration-150 active:scale-[0.96] ${prefs.bg === b.v ? "border-accent bg-accent/10" : "border-edge-soft bg-elevated/40 hover:border-edge hover:bg-elevated"}`}
            >
              <span
                className="grid h-12 w-12 place-items-center rounded-full ring-1 ring-black/20"
                style={{ background: b.color }}
              >
                {prefs.bg === b.v && (
                  <Check
                    size={18}
                    strokeWidth={3}
                    style={{ color: b.v === "light" ? "#0b0b0d" : "#fff" }}
                  />
                )}
              </span>
              <span className="text-[12px] font-medium text-ink">{t(b.label)}</span>
            </button>
          ))}
        </div>
      )}
      {cat === "zoom" && (
        <div className="flex w-full flex-col gap-4 py-1">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink">{t("Zoom")}</span>
            <div className="flex items-center gap-3">
              <span className="text-[16px] font-bold tabular-nums text-ink">
                {Math.round(prefs.zoom * 100)}%
              </span>
              {prefs.zoom !== 1 && (
                <button
                  type="button"
                  onClick={() => onChange({ zoom: 1 })}
                  className="flex items-center gap-1 text-[11px] font-semibold text-ink-subtle transition duration-150 hover:text-ink active:scale-95"
                >
                  <RotateCcw size={12} strokeWidth={2.4} />
                  {t("Reset")}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ZoomStep
              onClick={() => onChange({ zoom: Math.max(0.5, +(prefs.zoom - 0.1).toFixed(2)) })}
            >
              <Minus size={17} />
            </ZoomStep>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.1}
              value={prefs.zoom}
              onChange={(e) => onChange({ zoom: Number(e.target.value) })}
              aria-label={t("Zoom")}
              className="reader-slider flex-1"
            />
            <ZoomStep
              onClick={() => onChange({ zoom: Math.min(3, +(prefs.zoom + 0.1).toFixed(2)) })}
            >
              <Plus size={17} />
            </ZoomStep>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[0.5, 1, 1.5, 2, 3].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => onChange({ zoom: z })}
                className={`rounded-xl py-2 text-[12.5px] font-semibold tabular-nums transition duration-150 active:scale-95 ${
                  Math.abs(prefs.zoom - z) < 0.001
                    ? "bg-accent/15 text-accent ring-1 ring-accent/40"
                    : "bg-elevated/50 text-ink-muted ring-1 ring-edge-soft hover:bg-elevated hover:text-ink"
                }`}
              >
                {Math.round(z * 100)}%
              </button>
            ))}
          </div>
        </div>
      )}
    </ReaderSettingsFrame>
  );
}

function CardRow({ children }: { children: ReactNode }) {
  return <div className="flex items-stretch gap-3">{children}</div>;
}

function IconCard({
  icon,
  glyph,
  label,
  selected,
  onClick,
}: {
  icon?: string;
  glyph?: ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex w-[104px] flex-col items-center gap-2 rounded-2xl border p-3 transition duration-150 active:scale-[0.96] ${selected ? "border-accent bg-accent/10" : "border-edge-soft bg-elevated/40 hover:border-edge hover:bg-elevated"}`}
    >
      <span
        className={`absolute start-2.5 top-2.5 grid h-[18px] w-[18px] place-items-center rounded-md border transition ${selected ? "border-accent bg-accent" : "border-edge"}`}
      >
        {selected && <Check size={12} strokeWidth={3} className="text-canvas" />}
      </span>
      <span className="grid h-14 w-14 place-items-center text-ink">
        {glyph ?? <img src={`${ICON}/${icon}.png`} alt="" className="h-12 w-12 object-contain" />}
      </span>
      <span className="text-[12px] font-medium text-ink">{label}</span>
    </button>
  );
}

function ZoomStep({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-elevated text-ink-muted transition duration-150 hover:bg-raised hover:text-ink active:scale-90"
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition duration-200 active:scale-[0.95] ${on ? "bg-accent" : "bg-raised"}`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-canvas shadow-sm transition-transform duration-[280ms] ${on ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0"}`}
          style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.5, 1)" }}
        />
      </button>
    </div>
  );
}

function PosGlyph({ pos }: { pos: ReaderNavPos }) {
  const dot = "absolute h-1.5 w-1.5 rounded-full bg-current";
  return (
    <span className="relative block h-[30px] w-11 rounded-md border border-current/45">
      {pos === "stack-br" && (
        <>
          <i className={`${dot} bottom-3 end-1.5`} />
          <i className={`${dot} bottom-1 end-1.5`} />
        </>
      )}
      {pos === "stack-bl" && (
        <>
          <i className={`${dot} bottom-3 start-1.5`} />
          <i className={`${dot} bottom-1 start-1.5`} />
        </>
      )}
      {pos === "bottom" && (
        <>
          <i className={`${dot} bottom-1.5 left-1/2 -translate-x-2.5`} />
          <i className={`${dot} bottom-1.5 left-1/2 translate-x-1`} />
        </>
      )}
      {pos === "sides" && (
        <>
          <i className={`${dot} start-1 top-1/2 -translate-y-1/2`} />
          <i className={`${dot} end-1 top-1/2 -translate-y-1/2`} />
        </>
      )}
    </span>
  );
}

function GapRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 border-t border-edge-soft/60 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">{t("Page gap")}</span>
        <span className="text-[12px] font-semibold tabular-nums text-ink-muted">{value}px</span>
      </div>
      <input
        type="range"
        min={0}
        max={48}
        step={2}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={t("Double page gap")}
        className="reader-slider w-full"
      />
    </div>
  );
}
