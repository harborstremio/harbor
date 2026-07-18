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
};

export function LiquidGlassSurface({
  children,
  className = "",
  contentClassName = "",
  style,
  radius = "999999px",
  shaderRadius: _shaderRadius,
  interactive = true,
  alwaysActive: _alwaysActive,
  intensity = 1,
  refractionStrength: _refractionStrength,
  lensStrength: _lensStrength,
  ...wrapperProps
}: LiquidGlassSurfaceProps) {
  const strength = Math.min(1, Math.max(0, intensity));
  const glassStyle: CSSProperties = {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: radius,
    background: `linear-gradient(145deg, rgba(255,255,255,${0.025 + strength * 0.015}), rgba(255,255,255,0.006))`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.05)",
    ...style,
  };

  return (
    <div
      {...wrapperProps}
      style={glassStyle}
      data-liquid-glass={interactive ? "interactive" : "static"}
      className={className}
    >
      <div className={`relative z-10 h-full w-full ${contentClassName}`}>{children}</div>
    </div>
  );
}

/** Compatibility alias for existing call sites. */
export const ThreeLiquidGlassSurface = LiquidGlassSurface;
