import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { captureFocusReturn } from "@/lib/keyboard-navigation";
import { getDirection, isBackKey, isRtl } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";

const SV_STEP = 0.02;
const HUE_STEP = 3;
const DRAG_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export const HARBOR_COLOR_SWATCHES = [
  "#7dd3fc",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fb7185",
  "#fb923c",
  "#fbbf24",
  "#a3e635",
  "#34d399",
  "#22d3ee",
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const t = useT();
  const isPreset = HARBOR_COLOR_SWATCHES.includes(value.toLowerCase());
  return (
    <div className="flex flex-col gap-2 pt-1">
      <span className="harbor-settings-label">{t("Your color")}</span>
      <div className="flex flex-wrap items-center gap-2">
        {HARBOR_COLOR_SWATCHES.map((hex) => {
          const selected = value.toLowerCase() === hex;
          return (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              aria-label={hex}
              aria-pressed={selected}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
            >
              <span
                aria-hidden
                className={`block h-7 w-7 rounded-full transition-transform ${
                  selected
                    ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-canvas"
                    : "hover:scale-105"
                }`}
                style={{ background: hex }}
              />
            </button>
          );
        })}
        <ColorPopoverTrigger
          value={value}
          onChange={onChange}
          label={!isPreset ? value.toUpperCase() : t("Custom")}
          highlighted={!isPreset}
        />
      </div>
      <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
        {t("Used for your cursor in Watch Together, your draw color, and your name pill in chat.")}
      </span>
    </div>
  );
}

export function ColorPopoverTrigger({
  value,
  onChange,
  label,
  highlighted,
  align = "left",
  direction = "down",
  portal = false,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  highlighted?: boolean;
  align?: "left" | "right";
  direction?: "up" | "down";
  portal?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.setAttribute("data-color-popover", "");
    const restore = captureFocusReturn();
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.removeAttribute("data-color-popover");
      restore();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const items = Array.from(panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
        )).filter((el) => el.getClientRects().length > 0);
        const first = items[0];
        const last = items.at(-1);
        if (!first || !last) return;
        if (!panel.contains(document.activeElement) || document.activeElement === panel ||
            (e.shiftKey && document.activeElement === first) ||
            (!e.shiftKey && document.activeElement === last)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          (e.shiftKey ? last : first).focus();
        }
        return;
      }
      if (!isBackKey(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const panel = panelRef.current;
      const width = panel?.offsetWidth ?? 280;
      const height = panel?.offsetHeight ?? 260;
      const left = Math.max(8, Math.min(
        align === "right" ? r.right - width : r.left,
        window.innerWidth - width - 8,
      ));
      const below = r.bottom + 8;
      const above = r.top - height - 8;
      const preferred = direction === "up" ? above : below;
      const alternate = direction === "up" ? below : above;
      const fits = (y: number) => y >= 8 && y + height <= window.innerHeight - 8;
      const top = Math.max(8, Math.min(
        fits(preferred) ? preferred : fits(alternate) ? alternate : preferred,
        window.innerHeight - height - 8,
      ));
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, portal, align, direction]);

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("Custom color")}
      tabIndex={-1}
      className="animate-nudge-in max-h-[calc(100vh-16px)] w-[280px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-md bg-surface p-3 harbor-float"
    >
      <CustomColorPanel value={value} onChange={onChange} />
    </div>
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex h-11 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold transition-colors ${
          open || highlighted
            ? "border-ink text-ink"
            : "border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
        }`}
      >
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 rounded-full ring-1 ring-edge"
          style={{ background: value }}
        />
        {label}
      </button>
      {open &&
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
              className="fixed z-[320]"
              style={{
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                visibility: pos ? "visible" : "hidden",
              }}
            >
              {panel}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export function CustomColorPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const t = useT();
  const [hsv, setHsv] = useState(() => {
    const { r, g, b } = hexToRgb(value);
    return rgbToHsv(r, g, b);
  });
  const [hexDraft, setHexDraft] = useState(value);

  useEffect(() => {
    setHexDraft(value);
    const { r, g, b } = hexToRgb(value);
    const next = rgbToHsv(r, g, b);
    setHsv((prev) =>
      Math.abs(prev.h - next.h) < 0.5 &&
      Math.abs(prev.s - next.s) < 0.005 &&
      Math.abs(prev.v - next.v) < 0.005
        ? prev
        : next,
    );
  }, [value]);

  const slRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const baseHue = useMemo(() => {
    const [r, g, b] = hsvToRgb(hsv.h, 1, 1);
    return `rgb(${r}, ${g}, ${b})`;
  }, [hsv.h]);

  const emit = (next: { h: number; s: number; v: number }) => {
    const [r, g, b] = hsvToRgb(next.h, next.s, next.v);
    onChange(rgbToHex(r, g, b));
  };

  const onSLMove = (clientX: number, clientY: number) => {
    const el = slRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const next = { h: hsv.h, s, v };
    setHsv(next);
    emit(next);
  };

  const onHueMove = (clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 360;
    const next = { h, s: hsv.s, v: hsv.v };
    setHsv(next);
    emit(next);
  };

  const onSlKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = getDirection(e.nativeEvent);
    if (!dir) return;
    const horizontal = dir === "left" || dir === "right";
    const forward = horizontal ? (dir === "right") !== isRtl(e.currentTarget) : dir === "up";
    const step = forward ? SV_STEP : -SV_STEP;
    const s = horizontal ? clamp01(hsv.s + step) : hsv.s;
    const v = horizontal ? hsv.v : clamp01(hsv.v + step);
    if (s === hsv.s && v === hsv.v) return;
    e.preventDefault();
    const next = { h: hsv.h, s, v };
    setHsv(next);
    emit(next);
  };

  const onHueKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = getDirection(e.nativeEvent);
    if (dir !== "left" && dir !== "right") return;
    const forward = (dir === "right") !== isRtl(e.currentTarget);
    const h = Math.max(0, Math.min(360, hsv.h + (forward ? HUE_STEP : -HUE_STEP)));
    if (h === hsv.h) return;
    e.preventDefault();
    const next = { h, s: hsv.s, v: hsv.v };
    setHsv(next);
    emit(next);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div
        ref={slRef}
        role="slider"
        tabIndex={0}
        aria-label={t("Saturation and brightness")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={t("Saturation {s}%, brightness {v}%", {
          s: Math.round(hsv.s * 100), v: Math.round(hsv.v * 100),
        })}
        onKeyDown={onSlKey}
        onPointerDown={(e) => {
          slRef.current?.setPointerCapture(e.pointerId);
          onSLMove(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          onSLMove(e.clientX, e.clientY);
        }}
        className={`relative h-36 w-full cursor-crosshair touch-none rounded-md ${DRAG_FOCUS}`}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${baseHue})`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: value }}
        />
      </div>
      <div
        ref={hueRef}
        role="slider"
        tabIndex={0}
        aria-label={t("Hue")}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onKeyDown={onHueKey}
        onPointerDown={(e) => {
          hueRef.current?.setPointerCapture(e.pointerId);
          onHueMove(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          onHueMove(e.clientX);
        }}
        className={`relative my-1.5 h-5 w-full cursor-pointer touch-none rounded-full before:absolute before:inset-x-0 before:-inset-y-3 ${DRAG_FOCUS}`}
        style={{
          background:
            "linear-gradient(to right, #ff0000 0%, #ffff00 16.67%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.67%, #ff00ff 83.33%, #ff0000 100%)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
          style={{ left: `${(hsv.h / 360) * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="h-11 w-11 shrink-0 rounded-md" style={{ background: value }} />
        <input
          aria-label={t("Hex color")}
          aria-invalid={!/^#[0-9a-f]{6}$/i.test(hexDraft)}
          value={hexDraft.toUpperCase()}
          onBlur={() => setHexDraft(value)}
          onChange={(e) => {
            const v = e.target.value;
            setHexDraft(v);
            if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase());
          }}
          className="h-11 min-w-0 flex-1 rounded-md bg-canvas px-3 font-mono text-[15.5px] uppercase text-ink outline-none transition-colors focus:bg-elevated"
        />
      </div>
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace(/^#/, "");
  if (m.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m.slice(0, 2), 16) || 0,
    g: parseInt(m.slice(2, 4), 16) || 0,
    b: parseInt(m.slice(4, 6), 16) || 0,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d === 0) h = 0;
  else if (max === rn) h = 60 * ((((gn - bn) / d) % 6) + (gn < bn ? 6 : 0));
  else if (max === gn) h = 60 * ((bn - rn) / d + 2);
  else h = 60 * ((rn - gn) / d + 4);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
