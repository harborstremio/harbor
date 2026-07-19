import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { ExperimentalLiquidGlassSurface } from "@/components/ExperimentalLiquidGlassSurface";
import { useSettings } from "@/lib/settings";

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

function clampSetting(value: number, fallback: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(0, value)) : fallback;
}

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
  backdropBlur = true,
  blurRadius = 2.5,
  tintOpacity = 40,
  ...wrapperProps
}: LiquidGlassSurfaceProps & { blurRadius?: number; tintOpacity?: number }) {
  const strength = Math.min(1, Math.max(0, intensity));
  const normalizedBlur = clampSetting(blurRadius, 2, 12);
  const normalizedTint = clampSetting(tintOpacity, 40, 100);
  const blurEnabled = backdropBlur && normalizedBlur > 0;
  const wrapperStyle: CSSProperties = {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: radius,
    ...style,
  };
  const surfaceStyle: CSSProperties = {
    backgroundImage:
      variant === "overlay"
        ? `linear-gradient(145deg, rgba(255,255,255,${0.09 + strength * 0.04}), rgba(255,255,255,0.028))`
        : `linear-gradient(145deg, rgba(255,255,255,${0.045 + strength * 0.025}), rgba(255,255,255,0.012))`,
    backgroundColor: blurEnabled
      ? `color-mix(in srgb, var(--color-canvas) ${normalizedTint}%, transparent)`
      : variant === "overlay"
        ? "rgba(8,12,20,0.28)"
        : "transparent",
    boxShadow:
      variant === "overlay"
        ? "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.18), 0 8px 22px rgba(0,0,0,0.28)"
        : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.05)",
    backdropFilter: blurEnabled ? `blur(${normalizedBlur}px) saturate(1.08)` : undefined,
  };
  const contentStyle: CSSProperties = blurEnabled ? { transform: "translateZ(0)" } : {};

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

/**
 * Keeps the established renderer as the default. The newer treatment is
 * deliberately opt-in while its visual and performance characteristics mature.
 */
export function ThreeLiquidGlassSurface(props: LiquidGlassSurfaceProps) {
  const { settings } = useSettings();

  if (settings.experimentalLiquidGlassEnabled) {
    return (
      <ExperimentalLiquidGlassSurface
        {...props}
        rendererOpacity={settings.experimentalLiquidGlassOpacity}
      />
    );
  }

  return (
    <LiquidGlassSurface
      {...props}
      blurRadius={settings.defaultLiquidGlassBlur}
      tintOpacity={settings.defaultLiquidGlassTint}
    />
  );
}
