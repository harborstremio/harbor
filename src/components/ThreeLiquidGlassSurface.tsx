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
  causticsStrength?: number;
  motionSpeed?: number;
  contentClassName?: string;
  surfaceClassName?: string;
  variant?: "default" | "overlay";
  backdropBlur?: boolean;
  defaultStyle?: CSSProperties;
  experimentalStyle?: CSSProperties;
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
  causticsStrength: _causticsStrength,
  motionSpeed: _motionSpeed,
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
  const surfaceStyle: CSSProperties = {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: radius,
    backgroundImage: [
      variant === "overlay"
        ? `linear-gradient(145deg, rgba(255,255,255,${0.09 + strength * 0.04}), rgba(255,255,255,0.028))`
        : `linear-gradient(145deg, rgba(255,255,255,${0.045 + strength * 0.025}), rgba(255,255,255,0.012))`,
      `linear-gradient(118deg, rgba(255,255,255,${0.022 + strength * 0.018}) 0%, rgba(255,255,255,${0.008 + strength * 0.006}) 24%, transparent 48%)`,
      `radial-gradient(78% 110% at -20% 50%, rgba(95,190,255,${0.012 + strength * 0.015}) 0%, transparent 62%), radial-gradient(78% 110% at 120% 50%, rgba(255,120,205,${0.01 + strength * 0.013}) 0%, transparent 62%)`,
    ].join(", "),
    backgroundColor:
      variant === "overlay"
        ? "rgba(8,12,20,0.28)"
        : `color-mix(in srgb, var(--color-canvas) ${normalizedTint}%, transparent)`,
    boxShadow:
      variant === "overlay"
        ? "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.18), 0 8px 22px rgba(0,0,0,0.28)"
        : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.05)",
    backdropFilter: blurEnabled ? `blur(${normalizedBlur}px) saturate(1.08)` : undefined,
    ...style,
  };

  return (
    <div
      {...wrapperProps}
      style={surfaceStyle}
      data-liquid-glass={interactive ? "interactive" : "static"}
      className={`${className} ${surfaceClassName}`}
    >
      <div className={`relative z-10 isolate h-full w-full ${contentClassName}`}>{children}</div>
    </div>
  );
}

function PlainSurface({
  children,
  className = "",
  contentClassName = "",
  surfaceClassName = "",
  style,
  radius = "999999px",
  shaderRadius: _shaderRadius,
  interactive: _interactive,
  alwaysActive: _alwaysActive,
  intensity: _intensity,
  refractionStrength: _refractionStrength,
  lensStrength: _lensStrength,
  causticsStrength: _causticsStrength,
  motionSpeed: _motionSpeed,
  variant: _variant,
  backdropBlur: _backdropBlur,
  ...wrapperProps
}: LiquidGlassSurfaceProps & { blurRadius?: number; tintOpacity?: number }) {
  const plain: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    borderRadius: radius,
    ...style,
    backgroundImage: "none",
    backdropFilter: "none",
    border: "none",
    backgroundColor: variantBg(_variant),
    boxShadow: "0 10px 28px -8px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.15)",
  };
  return (
    <div {...wrapperProps} style={plain} className={`${className} ${surfaceClassName}`}>
      <div className={`relative z-10 h-full w-full ${contentClassName}`}>{children}</div>
    </div>
  );
}

function variantBg(variant: LiquidGlassSurfaceProps["variant"]): string {
  return variant === "overlay" ? "rgba(8,12,20,0.92)" : "var(--color-canvas)";
}

export function ThreeLiquidGlassSurface({
  defaultStyle,
  experimentalStyle,
  style,
  ...props
}: LiquidGlassSurfaceProps) {
  const { settings } = useSettings();

  if (!settings.liquidGlass) {
    return <PlainSurface {...props} style={style} />;
  }

  if (settings.experimentalLiquidGlassEnabled) {
    return (
      <ExperimentalLiquidGlassSurface
        {...props}
        style={{ ...style, ...experimentalStyle }}
        rendererOpacity={settings.experimentalLiquidGlassOpacity}
      />
    );
  }

  return (
    <LiquidGlassSurface
      {...props}
      style={{ ...style, ...defaultStyle }}
      blurRadius={settings.defaultLiquidGlassBlur}
      tintOpacity={settings.defaultLiquidGlassTint}
    />
  );
}
