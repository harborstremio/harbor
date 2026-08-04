import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  BookOpenText,
  Check,
  Columns2,
  GalleryVertical,
  Maximize,
  Minus,
  MoveHorizontal,
  Plus,
  RectangleHorizontal,
  RotateCcw,
  Rows3,
  StretchHorizontal,
  StretchVertical,
  SunMedium,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import type { ReaderNavPos, ReaderPrefs } from "./reader-types";
import { READER_ICON_STROKE } from "./reader-icon-button";

type Cat = "mode" | "direction" | "fit" | "nav" | "background" | "zoom";

const BGS: Array<{ v: ReaderPrefs["bg"]; labelKey: string; color: string }> = [
  { v: "dark", labelKey: "Dark", color: "#0b0b0d" },
  { v: "gray", labelKey: "Dim", color: "#404040" },
  { v: "light", labelKey: "Light", color: "#f5f5f5" },
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
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onClose, 180);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClosing(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const visible = shown && !closing;
  const cats: Array<{ id: Cat; label: string; icon: ReactNode }> = [
    {
      id: "mode",
      label: t("Reading mode"),
      icon: <BookOpenText size={22} strokeWidth={READER_ICON_STROKE} />,
    },
    {
      id: "direction",
      label: t("Direction"),
      icon: <ArrowLeftRight size={22} strokeWidth={READER_ICON_STROKE} />,
    },
    {
      id: "fit",
      label: t("Fit"),
      icon: <Maximize size={22} strokeWidth={READER_ICON_STROKE} />,
    },
    {
      id: "nav",
      label: t("Arrows"),
      icon: <MoveHorizontal size={22} strokeWidth={READER_ICON_STROKE} />,
    },
    {
      id: "background",
      label: t("Brightness"),
      icon: <SunMedium size={22} strokeWidth={READER_ICON_STROKE} />,
    },
    {
      id: "zoom",
      label: t("Zoom"),
      icon: <Plus size={22} strokeWidth={READER_ICON_STROKE} />,
    },
  ];

  const modes: Array<{ v: ReaderPrefs["mode"]; label: string; icon: ReactNode }> = [
    {
      v: "long",
      label: t("Long strip"),
      icon: <Rows3 size={28} strokeWidth={1.7} />,
    },
    {
      v: "long-h",
      label: t("Horizontal"),
      icon: <Columns2 size={28} strokeWidth={1.7} className="rotate-90" />,
    },
    {
      v: "paged",
      label: t("Single"),
      icon: <RectangleHorizontal size={28} strokeWidth={1.7} />,
    },
    {
      v: "double",
      label: t("Double"),
      icon: <Columns2 size={28} strokeWidth={1.7} />,
    },
    {
      v: "book",
      label: t("Book"),
      icon: <BookOpen size={28} strokeWidth={1.7} />,
    },
  ];

  const directions: Array<{ v: boolean; label: string; icon: ReactNode }> = [
    {
      v: false,
      label: t("Left to right"),
      icon: <GalleryVertical size={28} strokeWidth={1.7} className="-scale-x-100" />,
    },
    {
      v: true,
      label: t("Right to left"),
      icon: <GalleryVertical size={28} strokeWidth={1.7} />,
    },
  ];

  const navPos: Array<{ v: ReaderNavPos; label: string }> = [
    { v: "stack-br", label: t("Bottom right") },
    { v: "stack-bl", label: t("Bottom left") },
    { v: "bottom", label: t("Bottom center") },
    { v: "sides", label: t("Sides") },
  ];

  return (
    <>
      <div
        aria-hidden
        onClick={() => setClosing(true)}
        className={`fixed inset-0 z-[87] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 ease-out motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Reader settings")}
        className="pointer-events-none absolute inset-x-0 bottom-24 z-[88] flex flex-col items-center px-4"
      >
        <div
          style={{ transformOrigin: "bottom center" }}
          className={`pointer-events-auto w-fit max-w-full overflow-hidden rounded-3xl border border-edge-soft bg-raised/95 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.75)] backdrop-blur-2xl transition-all duration-200 ease-out motion-reduce:transition-none ${visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.96] opacity-0"}`}
        >
          <div className="border-b border-edge-soft/70 px-6 py-4">
            <div key={cat} className="reader-tab-in">
              {cat === "mode" && (
                <div className="flex flex-col gap-4">
                  <CardRow>
                    {modes.map((m) => (
                      <OptionCard
                        key={m.v}
                        glyph={m.icon}
                        label={m.label}
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
                    {directions.map((d) => (
                      <OptionCard
                        key={String(d.v)}
                        glyph={d.icon}
                        label={d.label}
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
                  <OptionCard
                    glyph={<StretchHorizontal size={28} strokeWidth={1.7} />}
                    label={t("Fit width")}
                    selected={prefs.fit === "width"}
                    onClick={() => onChange({ fit: "width" })}
                  />
                  <OptionCard
                    glyph={<StretchVertical size={28} strokeWidth={1.7} />}
                    label={t("Fit height")}
                    selected={prefs.fit === "height"}
                    onClick={() => onChange({ fit: "height" })}
                  />
                  <OptionCard
                    glyph={<Maximize size={28} strokeWidth={1.7} />}
                    label={t("Original")}
                    selected={prefs.fit === "original"}
                    onClick={() => onChange({ fit: "original" })}
                  />
                </CardRow>
              )}
              {cat === "nav" && (
                <div className="flex flex-col gap-4">
                  <CardRow>
                    {navPos.map((n) => (
                      <OptionCard
                        key={n.v}
                        glyph={<PosGlyph pos={n.v} />}
                        label={n.label}
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
                      aria-label={t(b.labelKey)}
                      aria-pressed={prefs.bg === b.v}
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
                      <span className="text-[12px] font-medium text-ink">{t(b.labelKey)}</span>
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
                      label={t("Zoom out")}
                      onClick={() =>
                        onChange({ zoom: Math.max(0.5, +(prefs.zoom - 0.1).toFixed(2)) })
                      }
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
                      label={t("Zoom in")}
                      onClick={() =>
                        onChange({ zoom: Math.min(3, +(prefs.zoom + 0.1).toFixed(2)) })
                      }
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
                        aria-pressed={Math.abs(prefs.zoom - z) < 0.001}
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
            </div>
          </div>

          <div
            className="flex items-stretch gap-1 px-3 py-2.5"
            role="tablist"
            aria-label={t("Reader settings")}
          >
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={cat === c.id}
                onClick={() => setCat(c.id)}
                onMouseDown={(e) => e.preventDefault()}
                className={`flex min-w-[68px] flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition duration-150 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${cat === c.id ? "bg-accent/15 text-accent" : "text-ink-muted hover:bg-elevated/70 hover:text-ink"}`}
              >
                {c.icon}
                <span className={`text-[10.5px] font-medium ${cat === c.id ? "text-accent" : ""}`}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function CardRow({ children }: { children: ReactNode }) {
  return <div className="flex items-stretch gap-3">{children}</div>;
}

function OptionCard({
  glyph,
  label,
  selected,
  onClick,
}: {
  glyph: ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex w-[104px] flex-col items-center gap-2 rounded-2xl border p-3 transition duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${selected ? "border-accent bg-accent/10" : "border-edge-soft bg-elevated/40 hover:border-edge hover:bg-elevated"}`}
    >
      <span
        className={`absolute start-2.5 top-2.5 grid h-[18px] w-[18px] place-items-center rounded-md border transition ${selected ? "border-accent bg-accent" : "border-edge"}`}
      >
        {selected && <Check size={12} strokeWidth={3} className="text-canvas" />}
      </span>
      <span className="grid h-14 w-14 place-items-center text-ink">{glyph}</span>
      <span className="text-[12px] font-medium text-ink">{label}</span>
    </button>
  );
}

function ZoomStep({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-elevated text-ink-muted transition duration-150 hover:bg-raised hover:text-ink active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition duration-200 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${on ? "bg-accent" : "bg-raised"}`}
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
    <span className="relative block h-[30px] w-11 rounded-md border border-current/45" aria-hidden>
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
