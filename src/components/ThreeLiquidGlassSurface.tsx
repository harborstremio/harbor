import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type LiquidGlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  radius?: CSSProperties["borderRadius"];
  shaderRadius?: number;
  interactive?: boolean;
  alwaysActive?: boolean;
  intensity?: number;
  refractionStrength?: number;
  lensStrength?: number;
  contentClassName?: string;
  surfaceClassName?: string;
  variant?: "default" | "overlay";
  backdropBlur?: boolean;
};

export function LiquidGlassSurface({
  children,
  className = "",
  contentClassName = "",
  surfaceClassName = "",
  style,
  radius = "999999px",
  shaderRadius: _shaderRadius,
  interactive = true,
  alwaysActive: _alwaysActive,
  intensity = 1,
  refractionStrength: _refractionStrength,
  lensStrength: _lensStrength,
  variant = "default",
  backdropBlur = false,
  ...wrapperProps
}: LiquidGlassSurfaceProps) {
  const strength = Math.min(1, Math.max(0, intensity));
  const wrapperStyle: CSSProperties = {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: radius,
    ...style,
  };
  const surfaceStyle: CSSProperties = {
    background:
      variant === "overlay"
        ? `linear-gradient(145deg, rgba(255,255,255,${0.09 + strength * 0.04}), rgba(255,255,255,0.028)), rgba(8,12,20,0.28)`
        : `linear-gradient(145deg, rgba(255,255,255,${0.045 + strength * 0.025}), rgba(255,255,255,0.012))`,
    boxShadow:
      variant === "overlay"
        ? "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.18), 0 8px 22px rgba(0,0,0,0.28)"
        : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.05)",
    backdropFilter:
      variant === "overlay" && backdropBlur ? "blur(2.5px) saturate(1.08)" : undefined,
  };
  const contentStyle: CSSProperties = backdropBlur ? { transform: "translateZ(0)" } : {};

  return (
    <div
      {...wrapperProps}
      style={wrapperStyle}
      data-liquid-glass={interactive ? "interactive" : "static"}
      className={className}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-0 rounded-[inherit] ${surfaceClassName}`}
        style={surfaceStyle}
      />
      <div
        className={`relative z-10 isolate h-full w-full ${contentClassName}`}
        style={contentStyle}
      >
        {children}
      </div>
    </div>
  );
}

/** Compatibility alias for existing call sites. */
export const ThreeLiquidGlassSurface = LiquidGlassSurface;
