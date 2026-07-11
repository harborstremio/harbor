import { useActiveKid } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  startSec: number;
  scale?: number;
};

export function SubtitleOverlay({ text, startSec, scale = 1 }: Props) {
  const { settings } = useSettings();
  const kid = useActiveKid();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [boxH, setBoxH] = useState(0);
  useEffect(() => {
    const measure = () => {
      const host = wrapRef.current?.offsetParent as HTMLElement | null;
      if (host && host.clientHeight > 0) setBoxH(host.clientHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);
  if (!text) return null;

  const responsive = boxH > 0 ? Math.max(0.3, Math.min(2.5, boxH / 1080)) : scale;
  const baseFont = kid ? Math.max(54, clamp(settings.subFontSize, 16, 120)) : clamp(settings.subFontSize, 16, 120);
  const fontSize = Math.round(baseFont * responsive);
  const marginY = clamp(settings.subMarginY, 0, 100);
  const fontColor = settings.subFontColor || "#FFFFFF";
  const align = settings.subAlignX || "center";
  const family = fontFamilyFor(settings.subFontFamily);
  const style = kid ? "shadow" : (settings.subStyle ?? "shadow");
  const lines = text.split("\n");

  const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";

  const baseTextStyle: React.CSSProperties = {
    color: fontColor,
    fontFamily: family,
    fontWeight: kid || settings.subBold ? 700 : 400,
    fontSize: `${fontSize}px`,
    lineHeight: 1.2,
    letterSpacing: `${(-0.005 + (settings.subLineSpacing ?? 0) * 0.06).toFixed(3)}em`,
    whiteSpace: "pre-wrap",
    textAlign: align as "left" | "center" | "right",
  };

  if (style === "outline") {
    const borderSize = Math.max(1, Math.round((clamp(settings.subBorderSize, 1, 6) || 2) * responsive));
    const borderColor = settings.subBorderColor || "#000000";
    baseTextStyle.textShadow = buildOutline(borderColor, borderSize);
  } else if (style === "shadow") {
    baseTextStyle.textShadow = "0 1px 2px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.85), 0 0 18px rgba(0,0,0,0.55)";
  }

  const boxOpacity = clamp(settings.subBoxOpacity, 0, 1);
  const boxRgb = hexToRgb(settings.subBoxColor || "#000000");
  const boxStyle: React.CSSProperties | undefined =
    style === "box"
      ? {
          backgroundColor: `rgba(${boxRgb.r}, ${boxRgb.g}, ${boxRgb.b}, ${boxOpacity})`,
          padding: `${Math.round(fontSize * 0.18)}px ${Math.round(fontSize * 0.5)}px`,
          borderRadius: `${Math.round(fontSize * 0.25)}px`,
          backdropFilter: "blur(2px)",
        }
      : undefined;

  const opacity = clamp(settings.subOpacity ?? 1, 0.1, 1);

  return (
    <div
      key={startSec}
      ref={wrapRef}
      className={`pointer-events-none absolute inset-x-0 z-10 flex ${justify} px-[6%]`}
      style={{ bottom: `${marginY}%`, opacity }}
    >
      <div className="max-w-[80%]" style={boxStyle}>
        <div style={baseTextStyle}>
          {lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fontFamilyFor(family: string | undefined): string {
  if (family?.startsWith("custom:")) {
    return `"harbor-font-${family.slice("custom:".length)}", "Inter", system-ui, sans-serif`;
  }
  switch (family) {
    case "system":
      return '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
    case "serif":
      return '"Fraunces", Georgia, "Times New Roman", serif';
    case "rounded":
      return '"SF Pro Rounded", "Nunito", "Quicksand", system-ui, sans-serif';
    case "inter":
    default:
      return '"Inter", -apple-system, system-ui, sans-serif';
  }
}

function buildOutline(color: string, size: number): string {
  const offsets: [number, number][] = [];
  for (let dx = -size; dx <= size; dx++) {
    for (let dy = -size; dy <= size; dy++) {
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > size + 0.1 || r < 0.1) continue;
      offsets.push([dx, dy]);
    }
  }
  return offsets.map(([dx, dy]) => `${dx}px ${dy}px 0 ${color}`).join(", ");
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = (hex || "").replace(/^#/, "");
  if (m.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m.slice(0, 2), 16) || 0,
    g: parseInt(m.slice(2, 4), 16) || 0,
    b: parseInt(m.slice(4, 6), 16) || 0,
  };
}
