import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const isPreset = HARBOR_COLOR_SWATCHES.includes(value.toLowerCase());
  return (
    <div className="flex flex-col gap-2 pt-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
        Your color
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {HARBOR_COLOR_SWATCHES.map((hex) => {
          const selected = value.toLowerCase() === hex;
          return (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              aria-label={hex}
              className={`relative h-7 w-7 rounded-full transition-transform ${
                selected ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-canvas" : "hover:scale-105"
              }`}
              style={{ background: hex }}
            />
          );
        })}
        <ColorPopoverTrigger
          value={value}
          onChange={onChange}
          label={!isPreset ? value.toUpperCase() : "Custom"}
          highlighted={!isPreset}
        />
      </div>
      <span className="text-[11.5px] text-ink-subtle">
        Used for your cursor in Watch Together, your draw color, and your name pill in chat.
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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !portal) return;
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = 280;
      const left =
        align === "right"
          ? Math.max(8, r.right - width)
          : Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      const top = direction === "up" ? r.top - 8 : r.bottom + 8;
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
      className="animate-nudge-in w-[280px] rounded-2xl border border-edge bg-elevated/95 p-3 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65)] backdrop-blur-md"
    >
      <CustomColorPanel value={value} onChange={onChange} />
    </div>
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
          open || highlighted
            ? "border-ink text-ink"
            : "border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
        }`}
      >
        <span
          aria-hidden
          className="h-3 w-3 rounded-full ring-1 ring-black/30"
          style={{ background: value }}
        />
        {label}
      </button>
      {open && !portal && (
        <>
          <div
            className="fixed inset-0 z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className={`absolute z-30 ${
              direction === "up" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
            } ${align === "right" ? "end-0" : "start-0"}`}
          >
            {panel}
          </div>
        </>
      )}
      {open &&
        portal &&
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
              className="fixed z-[320]"
              style={{
                top: pos.top,
                left: pos.left,
                ...(direction === "up" ? { transform: "translateY(-100%)" } : null),
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

function CustomColorPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
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
      Math.abs(prev.h - next.h) < 0.5 && Math.abs(prev.s - next.s) < 0.005 && Math.abs(prev.v - next.v) < 0.005
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

  return (
    <div className="flex flex-col gap-2.5">
      <div
        ref={slRef}
        tabIndex={0}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, Brightness ${Math.round(hsv.v * 100)}%`}
        onPointerDown={(e) => {
          slRef.current?.setPointerCapture(e.pointerId);
          onSLMove(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          onSLMove(e.clientX, e.clientY);
        }}
        onKeyDown={(e) => {
          const step = 0.01;
          const largeStep = 0.05;
          let s = hsv.s;
          let v = hsv.v;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            e.stopPropagation();
            s = Math.max(0, s - step);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            s = Math.min(1, s + step);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            v = Math.max(0, v - largeStep);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            v = Math.min(1, v + largeStep);
          }
          if (s !== hsv.s || v !== hsv.v) {
            const next = { h: hsv.h, s, v };
            setHsv(next);
            emit(next);
          }
        }}
        className="relative h-36 w-full cursor-crosshair touch-none rounded-lg ring-1 ring-edge-soft outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
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
        tabIndex={0}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={`${Math.round(hsv.h)}°`}
        onPointerDown={(e) => {
          hueRef.current?.setPointerCapture(e.pointerId);
          onHueMove(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          onHueMove(e.clientX);
        }}
        onKeyDown={(e) => {
          const step = 1;
          const largeStep = 10;
          let h = hsv.h;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            e.stopPropagation();
            h = Math.max(0, h - step);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            h = Math.min(360, h + step);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            h = Math.max(0, h - largeStep);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            h = Math.min(360, h + largeStep);
          }
          if (h !== hsv.h) {
            const next = { h, s: hsv.s, v: hsv.v };
            setHsv(next);
            emit(next);
          }
        }}
        className="relative h-3 w-full cursor-pointer touch-none rounded-full ring-1 ring-edge-soft outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
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
        <span
          className="h-7 w-7 shrink-0 rounded-md ring-1 ring-edge-soft"
          style={{ background: value }}
        />
        <input
          value={hexDraft.toUpperCase()}
          onChange={(e) => {
            const v = e.target.value;
            setHexDraft(v);
            if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase());
          }}
          className="h-8 w-24 rounded-md border border-edge-soft bg-canvas px-2 font-mono text-[12px] text-ink outline-none focus:border-ink"
        />
        <span className="text-[11px] text-ink-subtle">click swatch or drag</span>
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
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
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
