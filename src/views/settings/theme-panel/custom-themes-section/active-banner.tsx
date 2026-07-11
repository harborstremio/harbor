import type { ThemePreset } from "@/lib/theme";
import { Check, Copy } from "lucide-react";

export function ActiveBanner({
  theme,
  onExport,
  onCustomize,
}: {
  theme: ThemePreset | null;
  onExport: () => void;
  onCustomize: () => void;
}) {
  if (!theme) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4">
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink-subtle">Now using</span>
          <h3 className="mt-1 text-[16px] font-semibold text-ink">Custom palette</h3>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Hand-tuned colors. Edit them in the section above.</p>
        </div>
        <button
          type="button"
          onClick={onCustomize}
          className="h-9 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          Edit colors
        </button>
      </div>
    );
  }
  const bg = theme.background?.image ?? `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})`;
  const canvasToken = theme.tokens?.["--color-canvas"] ?? theme.swatch[0];
  const isLight = colorLuminance(canvasToken) > 0.6;
  const fg = isLight ? "#0a0a0c" : "#ffffff";
  const fgMuted = isLight ? "rgba(10,10,12,0.72)" : "rgba(255,255,255,0.78)";
  const scrim = isLight
    ? "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.28) 60%, rgba(255,255,255,0.1) 100%)"
    : "linear-gradient(135deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.68) 45%, rgba(0,0,0,0.5) 100%)";
  const chipBg = isLight ? "rgba(10,10,12,0.06)" : "rgba(255,255,255,0.12)";
  const chipRing = isLight ? "rgba(10,10,12,0.12)" : "rgba(255,255,255,0.20)";
  const editBorder = isLight ? "rgba(10,10,12,0.18)" : "rgba(255,255,255,0.35)";
  const editBg = isLight ? "rgba(10,10,12,0.06)" : "rgba(255,255,255,0.10)";
  const exportBg = isLight ? "#0a0a0c" : "#ffffff";
  const exportFg = isLight ? "#ffffff" : "#0a0a0c";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/40 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.45)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden style={{ background: bg, zIndex: 0 }} />
      <div className="pointer-events-none absolute inset-0" aria-hidden style={{ background: scrim, zIndex: 1 }} />
      <div className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-5" style={{ zIndex: 2 }}>
        <div className="flex min-w-0 flex-col gap-1">
          <div
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.28em]"
            style={{ color: fgMuted }}
          >
            <Check size={11} strokeWidth={2.6} />
            Now using
          </div>
          <h3
            className="text-[22px] font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: fg }}
          >
            {theme.name}
          </h3>
          {theme.blurb && (
            <p className="line-clamp-2 max-w-[42rem] text-[13px]" style={{ color: fgMuted }}>
              {theme.blurb}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip bg={chipBg} ring={chipRing} fg={fg}>
              {labelForLayout(theme.layout)}
            </Chip>
            <Chip bg={chipBg} ring={chipRing} fg={fg}>
              {labelForCard(theme.cardStyle)}
            </Chip>
            {theme.bokeh && (
              <Chip bg={chipBg} ring={chipRing} fg={fg}>
                Bokeh
              </Chip>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onCustomize}
            className="flex h-10 items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-semibold backdrop-blur-md transition-all hover:-translate-y-px"
            style={{ borderColor: editBorder, background: editBg, color: fg }}
          >
            Edit colors
          </button>
          <button
            type="button"
            onClick={onExport}
            className="flex h-10 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold transition-all hover:-translate-y-px hover:opacity-90"
            style={{ background: exportBg, color: exportFg }}
          >
            <Copy size={13} strokeWidth={2.2} />
            Copy theme
          </button>
        </div>
      </div>
    </div>
  );
}

function colorLuminance(input: string): number {
  const c = input.trim();
  const rgb = parseColor(c);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseColor(c: string): [number, number, number] | null {
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)];
    }
    if (hex.length === 6 || hex.length === 8) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
    return null;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
    if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  }
  return null;
}

function labelForLayout(l?: string): string {
  switch (l) {
    case "topdock":
      return "Top dock";
    case "rail":
      return "Side rail";
    case "stremio":
      return "Stremio rail";
    case "minui":
      return "Floating dock";
    case "dracula":
      return "Dracula sidebar";
    case "nord":
      return "Nord sidebar";
    case "forest":
      return "Forest sidebar";
    case "royal":
      return "Royal top bar";
    case "custom":
      return "Custom chrome";
    default:
      return "Sidebar layout";
  }
}

function labelForCard(c?: string): string {
  switch (c) {
    case "glass":
      return "Glass cards";
    case "stremio":
      return "Stremio cards";
    case "minui":
      return "Hairline cards";
    case "crunch":
      return "Crunch cards";
    case "noir":
      return "Noir cards";
    case "custom":
      return "Custom cards";
    default:
      return "Flat cards";
  }
}

function Chip({ children, bg, ring, fg }: { children: React.ReactNode; bg?: string; ring?: string; fg?: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm"
      style={{
        background: bg ?? "rgba(255,255,255,0.12)",
        boxShadow: `inset 0 0 0 1px ${ring ?? "rgba(255,255,255,0.20)"}`,
        color: fg ?? "rgba(255,255,255,0.9)",
      }}
    >
      {children}
    </span>
  );
}
