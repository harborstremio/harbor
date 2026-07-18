import { useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { useSettings } from "@/lib/settings";

const LEGACY_SPECTRUM_PROP = `spectral${"Strength"}` as const;

type LegacySpectrumProps = Partial<Record<typeof LEGACY_SPECTRUM_PROP, number>>;

export type LiquidGlassSurfaceProps = HTMLAttributes<HTMLDivElement> &
  LegacySpectrumProps & {
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
    motionStrength?: number;
    contentClassName?: string;
    surfaceClassName?: string;
    variant?: "surface" | "overlay";
    backdropBlur?: boolean;
  };

export type ThreeLiquidGlassSurfaceProps = LiquidGlassSurfaceProps;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function alpha(value: number): string {
  return clamp(value, 0, 1).toFixed(4);
}

export function LiquidGlassSurface({
  children,
  className = "",
  contentClassName = "",
  surfaceClassName = "",
  variant = "surface",
  backdropBlur = true,
  style,
  radius = "999999px",
  shaderRadius = 1,
  interactive = true,
  alwaysActive = false,
  intensity = 1.08,
  refractionStrength = 1.42,
  lensStrength = 1.2,
  causticsStrength = 1,
  motionSpeed = 1,
  motionStrength = 1,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onFocus,
  onBlur,
  ...wrapperProps
}: LiquidGlassSurfaceProps) {
  const { settings } = useSettings();
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [pressed, setPressed] = useState(false);

  const forwardedProps = { ...wrapperProps } as HTMLAttributes<HTMLDivElement> &
    Record<string, unknown>;

  const spectrumLevel = clamp(Number(forwardedProps[LEGACY_SPECTRUM_PROP] ?? 1.48), 0, 2.5);

  delete forwardedProps[LEGACY_SPECTRUM_PROP];

  const globalOpacity = clamp((settings.liquidGlassOpacity ?? 100) / 100, 0, 1);
  const normalizedIntensity = clamp(intensity, 0, 1.5);
  const normalizedRefraction = clamp(refractionStrength, 0, 1.8);
  const normalizedLens = clamp(lensStrength, 0, 2.5);
  const normalizedCaustics = clamp(causticsStrength, 0, 1.5);
  const normalizedMotion = clamp(motionStrength, 0, 2);
  const normalizedShaderRadius = clamp(shaderRadius, 0, 1);
  const normalizedSpeed = clamp(motionSpeed, 0, 3);

  const active = alwaysActive || keyboardActive || pressed;
  const activeMix = active ? 1 : 0.22;
  const pressedMix = pressed ? 0.9 : 1;
  const transitionMs = normalizedSpeed <= 0 ? 0 : Math.round(250 / Math.max(0.35, normalizedSpeed));
  const motionDistance = normalizedMotion * 2.4;

  const webkitBlur = 0.25 * globalOpacity;
  const standardBlur = 3.25 * globalOpacity;

  const topSurfaceAlpha = 0.007 * globalOpacity * normalizedIntensity;
  const bottomSurfaceAlpha = 0.0015 * globalOpacity * normalizedIntensity;
  const topEdgeAlpha = 0.06 * globalOpacity * normalizedIntensity;
  const bottomEdgeAlpha = 0.034 * globalOpacity;

  const edgeMaskStart = 46 - normalizedShaderRadius * 13;
  const edgeMaskMiddle = 72 - normalizedShaderRadius * 8;

  const lensAlpha = 0.075 * globalOpacity * normalizedIntensity * normalizedLens * activeMix;
  const prismAlpha = 0.068 * globalOpacity * normalizedIntensity * spectrumLevel * activeMix;
  const chromaAlpha = 0.045 * globalOpacity * normalizedIntensity * spectrumLevel * activeMix;
  const causticsAlpha = 0.05 * globalOpacity * normalizedIntensity * normalizedCaustics * activeMix;

  const blurValue = `blur(${standardBlur}px) saturate(1.42) brightness(1.014) contrast(1.04)`;
  const webkitBlurValue = `blur(${webkitBlur}px) saturate(1.42) brightness(1.014) contrast(1.04)`;

  const glassStyle: CSSProperties = {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: radius,
    WebkitBackdropFilter: variant === "surface" && backdropBlur ? webkitBlurValue : undefined,
    backdropFilter: variant === "surface" && backdropBlur ? blurValue : undefined,
    background: `linear-gradient(145deg, rgba(255,255,255,${alpha(
      topSurfaceAlpha,
    )}), rgba(255,255,255,${alpha(bottomSurfaceAlpha)}))`,
    boxShadow: [
      `inset 0 1px 0 rgba(255,255,255,${alpha(topEdgeAlpha)})`,
      `inset 0 -1px 0 rgba(0,0,0,${alpha(bottomEdgeAlpha)})`,
      `inset 1px 0 0 rgba(128,205,255,${alpha(0.012 * globalOpacity * normalizedLens)})`,
      `inset -1px 0 0 rgba(255,120,205,${alpha(0.009 * globalOpacity * spectrumLevel)})`,
    ].join(", "),
    transform: pressed ? `scale(${1 - 0.007 * normalizedMotion}) translateZ(0)` : "translateZ(0)",
    transition: [
      `transform ${transitionMs}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
      `background ${transitionMs}ms ease`,
      `box-shadow ${transitionMs}ms ease`,
    ].join(", "),
    ...style,
  };

  const surfaceStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    WebkitBackdropFilter: variant === "overlay" && backdropBlur ? webkitBlurValue : undefined,
    backdropFilter: variant === "overlay" && backdropBlur ? blurValue : undefined,
    background: [
      `radial-gradient(120% 92% at 50% -14%, rgba(255,255,255,${alpha(
        0.025 * globalOpacity * normalizedIntensity,
      )}) 0%, transparent 57%)`,
      `linear-gradient(150deg, rgba(255,255,255,${alpha(
        0.007 * globalOpacity,
      )}) 0%, transparent 34%, transparent 70%, rgba(120,185,255,${alpha(
        0.006 * globalOpacity,
      )}) 100%)`,
    ].join(", "),
  };

  const sharedLayerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    borderRadius: "inherit",
    pointerEvents: "none",
    opacity: pressedMix,
    transition: [
      `opacity ${transitionMs}ms ease`,
      `transform ${transitionMs}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
      `background-position ${transitionMs}ms ease`,
      `filter ${transitionMs}ms ease`,
    ].join(", "),
  };

  const lensLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    background: [
      `radial-gradient(ellipse at 50% 48%, transparent 0%, transparent ${edgeMaskStart}%, rgba(95,175,255,${alpha(
        lensAlpha * 0.28,
      )}) ${edgeMaskMiddle}%, rgba(255,255,255,${alpha(lensAlpha)}) 96%, transparent 100%)`,
      `radial-gradient(ellipse at 50% 44%, rgba(255,255,255,${alpha(
        lensAlpha * 0.3,
      )}) 0%, transparent 38%, transparent 76%, rgba(105,190,255,${alpha(lensAlpha * 0.42)}) 100%)`,
    ].join(", "),
    mixBlendMode: "screen",
    filter: `contrast(${1.04 + normalizedLens * 0.025})`,
    transform: active
      ? `scale(${1 + 0.009 * normalizedLens})`
      : `scale(${1 + 0.002 * normalizedLens})`,
  };

  const prismLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    background: [
      `linear-gradient(121deg, transparent 7%, transparent 25%, rgba(255,75,145,${alpha(
        prismAlpha * 0.82,
      )}) 35%, rgba(255,215,105,${alpha(prismAlpha * 0.56)}) 44%, rgba(80,220,255,${alpha(
        prismAlpha,
      )}) 55%, rgba(110,92,255,${alpha(prismAlpha * 0.86)}) 67%, transparent 78%, transparent 93%)`,
      `linear-gradient(37deg, transparent 12%, rgba(60,195,255,${alpha(
        prismAlpha * 0.55,
      )}) 35%, transparent 51%, rgba(255,75,180,${alpha(prismAlpha * 0.52)}) 67%, transparent 86%)`,
      `conic-gradient(from 214deg at 50% 52%, transparent 0deg, rgba(80,220,255,${alpha(
        prismAlpha * 0.32,
      )}) 28deg, transparent 67deg, transparent 210deg, rgba(255,80,180,${alpha(
        prismAlpha * 0.28,
      )}) 247deg, transparent 292deg)`,
    ].join(", "),
    backgroundSize: "148% 148%, 138% 138%, 112% 112%",
    backgroundPosition: active ? "46% 54%, 54% 46%, 51% 49%" : "53% 47%, 47% 53%, 49% 51%",
    mixBlendMode: "screen",
    filter: `saturate(${1.02 + spectrumLevel * 0.2}) contrast(${
      1.03 + normalizedRefraction * 0.025
    })`,
    transform: active
      ? `translate3d(${motionDistance}px, ${-motionDistance * 0.5}px, 0) scale(${
          1 + 0.009 * normalizedMotion
        })`
      : "translate3d(0, 0, 0) scale(1)",
    WebkitMaskImage: `radial-gradient(ellipse at center, transparent 0%, transparent ${
      edgeMaskStart - 7
    }%, rgba(0,0,0,0.72) ${edgeMaskMiddle}%, #000 100%)`,
    maskImage: `radial-gradient(ellipse at center, transparent 0%, transparent ${
      edgeMaskStart - 7
    }%, rgba(0,0,0,0.72) ${edgeMaskMiddle}%, #000 100%)`,
  };

  const causticsLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    background: [
      `radial-gradient(ellipse 19% 33% at 18% 25%, rgba(155,225,255,${alpha(
        causticsAlpha,
      )}) 0%, rgba(155,225,255,${alpha(causticsAlpha * 0.35)}) 28%, transparent 68%)`,
      `radial-gradient(ellipse 23% 17% at 76% 69%, rgba(255,255,255,${alpha(
        causticsAlpha * 0.86,
      )}) 0%, transparent 72%)`,
      `radial-gradient(ellipse 14% 31% at 61% 31%, rgba(130,205,255,${alpha(
        causticsAlpha * 0.72,
      )}) 0%, transparent 70%)`,
      `radial-gradient(ellipse 28% 12% at 36% 79%, rgba(255,150,220,${alpha(
        causticsAlpha * 0.42,
      )}) 0%, transparent 74%)`,
      `linear-gradient(132deg, transparent 24%, rgba(160,225,255,${alpha(
        causticsAlpha * 0.34,
      )}) 45%, transparent 63%)`,
    ].join(", "),
    backgroundSize: "108% 108%, 112% 112%, 106% 106%, 110% 110%, 100% 100%",
    backgroundPosition: active
      ? "3% -2%, 97% 102%, 52% 48%, 46% 55%, center"
      : "0 0, 100% 100%, 50% 50%, 50% 50%, center",
    mixBlendMode: "screen",
    filter: `blur(${Math.max(0.7, 1.45 - normalizedCaustics * 0.35)}px) contrast(${
      1.08 + normalizedCaustics * 0.22
    })`,
    transform: active
      ? `translate3d(${-motionDistance * 0.55}px, ${
          motionDistance * 0.38
        }px, 0) scale(${1 + 0.008 * normalizedMotion})`
      : "translate3d(0, 0, 0) scale(1)",
    WebkitMaskImage: `radial-gradient(ellipse at center, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.72) 58%, #000 100%)`,
    maskImage: `radial-gradient(ellipse at center, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.72) 58%, #000 100%)`,
  };

  const chromaticEdgeStyle: CSSProperties = {
    ...sharedLayerStyle,
    inset: "1px",
    background: [
      `linear-gradient(90deg, rgba(255,70,145,${alpha(
        chromaAlpha * 0.76,
      )}) 0%, transparent 7%, transparent 93%, rgba(70,200,255,${alpha(chromaAlpha)}) 100%)`,
      `linear-gradient(180deg, rgba(125,225,255,${alpha(
        chromaAlpha * 0.42,
      )}) 0%, transparent 8%, transparent 91%, rgba(255,95,185,${alpha(chromaAlpha * 0.36)}) 100%)`,
    ].join(", "),
    boxShadow: [
      `inset 0 0 0 1px rgba(255,255,255,${alpha(0.018 * globalOpacity * normalizedIntensity)})`,
      `inset 0 0 ${4 + normalizedLens * 2}px rgba(110,195,255,${alpha(chromaAlpha * 0.36)})`,
    ].join(", "),
    mixBlendMode: "screen",
    transform: active ? `scale(${1 + 0.0035 * normalizedLens})` : "scale(1)",
  };

  const sheenLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    inset: "1px",
    background: `linear-gradient(134deg, rgba(255,255,255,${alpha(
      0.04 * globalOpacity * normalizedIntensity * activeMix,
    )}) 0%, transparent 18%, transparent 70%, rgba(100,185,255,${alpha(
      0.027 * globalOpacity * normalizedRefraction * activeMix,
    )}) 100%)`,
    mixBlendMode: "screen",
    transform: active
      ? `translate3d(${motionDistance * 0.34}px, ${-motionDistance * 0.22}px, 0)`
      : "translate3d(0, 0, 0)",
  };

  return (
    <div
      {...forwardedProps}
      className={className}
      style={glassStyle}
      data-liquid-glass={interactive ? "interactive" : "static"}
      data-liquid-active={active ? "true" : "false"}
      data-liquid-pressed={pressed ? "true" : "false"}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        if (interactive) {
          setPressed(false);
        }

        onPointerLeave?.(event);
      }}
      onPointerDown={(event) => {
        if (interactive) {
          setPressed(true);
          setKeyboardActive(false);
        }

        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        if (interactive) {
          setPressed(false);
          setKeyboardActive(false);
        }

        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        if (interactive) {
          setPressed(false);
          setKeyboardActive(false);
        }

        onPointerCancel?.(event);
      }}
      onFocus={(event) => {
        if (interactive) {
          setKeyboardActive(event.currentTarget.matches(":focus-visible"));
        }

        onFocus?.(event);
      }}
      onBlur={(event) => {
        if (interactive) {
          setKeyboardActive(false);
          setPressed(false);
        }

        onBlur?.(event);
      }}
    >
      <div aria-hidden="true" className={surfaceClassName} style={surfaceStyle} />
      <div aria-hidden="true" style={lensLayerStyle} />
      <div aria-hidden="true" style={prismLayerStyle} />
      <div aria-hidden="true" style={causticsLayerStyle} />
      <div aria-hidden="true" style={chromaticEdgeStyle} />
      <div aria-hidden="true" style={sheenLayerStyle} />

      <div className={`relative z-10 h-full w-full ${contentClassName}`}>{children}</div>
    </div>
  );
}

/** Compatibility alias for existing call sites. */
export const ThreeLiquidGlassSurface = LiquidGlassSurface;
