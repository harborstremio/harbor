import { useState, type CSSProperties } from "react";
import { monogram } from "@/lib/jl/sports/team-look";
import type { VisionTemplate, VisionTheme, VisionZone } from "@/lib/jl/sports/vision-branding";

/**
 * Draws a JL Vision design template (design_templates.layout_json) for one team: each zone is
 * placed by its percentage rect and filled from the team's data. The logo is always the real
 * image file, never redrawn; with no approved logo the main logo zones show the team's name and
 * watermark zones stay empty. With no verified palette the template keeps the neutral JL glass
 * look rather than guessing colours.
 */

export type TemplateBindings = Record<string, string | null | undefined>;

const NEUTRAL = {
  start: "var(--color-elevated, #1c1f26)",
  end: "var(--color-canvas, #0b0d12)",
  text: "var(--color-ink, #f4f6fb)",
  accent: "var(--color-accent, #7aa2ff)",
};

const rectStyle = (zone: VisionZone): CSSProperties => ({
  position: "absolute",
  left: `${zone.rect.x}%`,
  top: `${zone.rect.y}%`,
  width: `${zone.rect.w}%`,
  height: `${zone.rect.h}%`,
});

function ZoneImage({ src, zone, alt }: { src: string; zone: VisionZone; alt: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return null;
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => setFailed(src)}
      style={{
        ...rectStyle(zone),
        opacity: zone.opacity ?? 1,
        objectFit: zone.fit === "cover" ? "cover" : "contain",
      }}
    />
  );
}

export function VisionTemplateCanvas({
  template,
  theme,
  logo,
  art,
  bindings,
  className = "",
}: {
  template: VisionTemplate;
  theme: VisionTheme | null;
  logo: string | null;
  /** Approved artwork for the background zone; the palette gradient when there is none. */
  art: string | null;
  bindings: TemplateBindings;
  className?: string;
}) {
  const [artFailed, setArtFailed] = useState<string | null>(null);
  const start = theme ? `#${theme.gradientStart}` : NEUTRAL.start;
  const end = theme ? `#${theme.gradientEnd}` : NEUTRAL.end;
  const ink = theme ? `#${theme.textLight}` : NEUTRAL.text;
  const accent = theme ? `#${theme.accent}` : NEUTRAL.accent;
  const glow = theme ? `#${theme.glow}` : null;
  const blur = theme?.glassBlurPx ?? template.glass.blurPx;
  const glassAlpha = theme?.glassOpacity ?? template.glass.backgroundAlpha;
  // Sizes in the layout are percentages of the canvas height; the canvas is a width container.
  const heightCqw = (pct: number) => `${(pct * template.height) / template.width}cqw`;
  const radius = `${(template.glass.radiusPx / template.width) * 100}cqw`;
  const name = bindings.team_name ?? "";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl ring-1 ring-edge-soft/60 ${className}`}
      style={{
        aspectRatio: `${template.width} / ${template.height}`,
        containerType: "inline-size",
      }}
    >
      {template.zones.map((zone) => {
        switch (zone.kind) {
          case "generated_background":
            return (
              <div key={zone.id} aria-hidden style={rectStyle(zone)}>
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(135deg, ${start} 0%, ${end} 100%)` }}
                />
                {glow && (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(60% 70% at 75% 45%, ${glow}55 0%, transparent 70%)`,
                    }}
                  />
                )}
                {art && artFailed !== art && (
                  <img
                    src={art}
                    alt=""
                    draggable={false}
                    onError={() => setArtFailed(art)}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
              </div>
            );
          case "team_logo":
          case "conference_logo": {
            if (logo)
              return (
                <ZoneImage key={zone.id} src={logo} zone={zone} alt={zone.opacity ? "" : name} />
              );
            // Watermarks need the real logo; the main mark falls back to a clean name plate.
            if (zone.opacity !== undefined || !name) return null;
            return (
              <div
                key={zone.id}
                style={{ ...rectStyle(zone), color: ink }}
                className="flex items-center justify-center"
              >
                <span
                  className="font-black tracking-[0.06em]"
                  style={{ fontSize: heightCqw(Math.min(zone.rect.h * 0.45, 18)) }}
                >
                  {monogram(name)}
                </span>
              </div>
            );
          }
          case "glass_panel":
            return (
              <div
                key={zone.id}
                aria-hidden
                style={{
                  ...rectStyle(zone),
                  borderRadius: radius,
                  background: `rgba(255,255,255,${Math.min(0.5, glassAlpha * 0.45)})`,
                  border: `1px solid rgba(255,255,255,${template.glass.borderAlpha * 0.5})`,
                  backdropFilter: `blur(${blur}px)`,
                  WebkitBackdropFilter: `blur(${blur}px)`,
                }}
              />
            );
          case "frame":
            return (
              <div
                key={zone.id}
                aria-hidden
                style={{ ...rectStyle(zone), borderRadius: radius, border: `2px solid ${accent}` }}
              />
            );
          case "glow":
            return glow ? (
              <div
                key={zone.id}
                aria-hidden
                style={{
                  ...rectStyle(zone),
                  opacity: zone.opacity ?? 0.3,
                  background: `radial-gradient(closest-side, ${glow} 0%, transparent 100%)`,
                }}
              />
            ) : null;
          case "text": {
            const key = zone.binding ?? "";
            // Upper-case bindings with no data key are literal labels ("VS", "GAME DAY").
            const value = key in bindings ? bindings[key] : /^[A-Z0-9 ]+$/.test(key) ? key : null;
            if (!value) return null;
            return (
              <div
                key={zone.id}
                style={{
                  ...rectStyle(zone),
                  color: ink,
                  textAlign: (zone.align as CSSProperties["textAlign"]) ?? "start",
                  fontSize: heightCqw(zone.sizePct ?? 3),
                  lineHeight: 1.05,
                  textTransform: zone.case === "uppercase" ? "uppercase" : undefined,
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: zone.maxLines ?? 2,
                  overflow: "hidden",
                  textShadow: "0 2px 18px rgba(0,0,0,0.45)",
                }}
                className={
                  zone.font === "display" ? "font-black tracking-tight" : "font-medium opacity-85"
                }
              >
                {value}
              </div>
            );
          }
          default:
            // Player photos, opponent marks and decorative glass shapes need data a team
            // template preview doesn't have; they are left empty.
            return null;
        }
      })}
    </div>
  );
}
