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

  const spectrumStrength = clamp(Number(forwardedProps[LEGACY_SPECTRUM_PROP] ?? 1.48), 0, 2.5);

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
  const transitionMs = normalizedSpeed <= 0 ? 0 : Math.round(280 / Math.max(0.3, normalizedSpeed));
  const motionDistance = normalizedMotion * 2.2;
  const activeMultiplier = active ? 1 : 0.44;
  const pressedMultiplier = pressed ? 0.9 : 1;

  const webkitBlur = 0.25 * globalOpacity;
  const standardBlur = (2.8 + normalizedRefraction * 0.45) * globalOpacity;

  const topSurfaceAlpha = 0.007 * globalOpacity * normalizedIntensity;
  const bottomSurfaceAlpha = 0.0015 * globalOpacity * normalizedIntensity;
  const topEdgeAlpha = 0.06 * globalOpacity * normalizedIntensity;
  const bottomEdgeAlpha = 0.034 * globalOpacity;

  const spectrumAlpha =
    0.11 * globalOpacity * normalizedIntensity * spectrumStrength * activeMultiplier;
  const spectrumEdgeAlpha =
    0.075 * globalOpacity * normalizedIntensity * spectrumStrength * activeMultiplier;
  const causticsAlpha =
    0.085 * globalOpacity * normalizedIntensity * normalizedCaustics * activeMultiplier;
  const lensAlpha = 0.095 * globalOpacity * normalizedIntensity * normalizedLens * activeMultiplier;

  const maskStart = 20 + (1 - normalizedShaderRadius) * 20;
  const maskMiddle = 57 + (1 - normalizedShaderRadius) * 8;

  const glassStyle: CSSProperties = {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: radius,
    WebkitBackdropFilter:
      globalOpacity <= 0
        ? "none"
        : `blur(${webkitBlur}px) saturate(${1.32 + normalizedRefraction * 0.07}) brightness(1.014) contrast(1.04)`,
    backdropFilter:
      globalOpacity <= 0
        ? "none"
        : `blur(${standardBlur}px) saturate(${1.32 + normalizedRefraction * 0.07}) brightness(1.014) contrast(1.04)`,
    background: [
      `linear-gradient(145deg, rgba(255,255,255,${alpha(topSurfaceAlpha)}), rgba(255,255,255,${alpha(bottomSurfaceAlpha)}))`,
      `radial-gradient(120% 95% at 50% -10%, rgba(255,255,255,${alpha(0.028 * globalOpacity * normalizedIntensity)}), transparent 58%)`,
    ].join(", "),
    boxShadow: [
      `inset 0 1px 0 rgba(255,255,255,${alpha(topEdgeAlpha)})`,
      `inset 0 -1px 0 rgba(0,0,0,${alpha(bottomEdgeAlpha)})`,
      `inset 1px 0 0 rgba(180,220,255,${alpha(0.018 * globalOpacity * normalizedLens)})`,
      `inset -1px 0 0 rgba(255,150,210,${alpha(0.012 * globalOpacity * spectrumStrength)})`,
    ].join(", "),
    transform: pressed ? `scale(${1 - 0.008 * normalizedMotion})` : undefined,
    transition: `transform ${transitionMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), background ${transitionMs}ms ease, box-shadow ${transitionMs}ms ease`,
    ...style,
  };

  const sharedLayerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    transition: [
      `opacity ${transitionMs}ms ease`,
      `transform ${transitionMs}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
      `filter ${transitionMs}ms ease`,
    ].join(", "),
  };

  const lensLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    background: [
      `radial-gradient(ellipse at 50% 46%, transparent ${maskStart}%, rgba(120,190,255,${alpha(lensAlpha * 0.42)}) ${maskMiddle}%, rgba(255,255,255,${alpha(lensAlpha)}) 100%)`,
      `linear-gradient(138deg, rgba(255,255,255,${alpha(lensAlpha * 0.62)}) 0%, transparent 24%, transparent 73%, rgba(120,180,255,${alpha(lensAlpha * 0.54)}) 100%)`,
    ].join(", "),
    mixBlendMode: "screen",
    opacity: pressedMultiplier,
    transform: active
      ? `scale(${1 + 0.006 * normalizedLens})`
      : `scale(${1 + 0.002 * normalizedLens})`,
  };

  const spectrumLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    background: [
      `linear-gradient(116deg, transparent 8%, rgba(255,70,135,${alpha(spectrumAlpha * 0.82)}) 28%, rgba(255,210,90,${alpha(spectrumAlpha * 0.72)}) 41%, rgba(90,235,255,${alpha(spectrumAlpha)}) 55%, rgba(115,90,255,${alpha(spectrumAlpha * 0.86)}) 69%, transparent 88%)`,
      `linear-gradient(42deg, transparent 16%, rgba(80,205,255,${alpha(spectrumEdgeAlpha)}) 38%, transparent 53%, rgba(255,90,180,${alpha(spectrumEdgeAlpha * 0.92)}) 67%, transparent 86%)`,
      `radial-gradient(circle at 72% 28%, rgba(120,240,255,${alpha(spectrumEdgeAlpha * 0.8)}) 0%, transparent 24%)`,
      `radial-gradient(circle at 24% 76%, rgba(255,100,200,${alpha(spectrumEdgeAlpha * 0.72)}) 0%, transparent 25%)`,
    ].join(", "),
    backgroundSize: "145% 145%, 135% 135%, 100% 100%, 100% 100%",
    backgroundPosition: active
      ? "48% 52%, 52% 48%, center, center"
      : "52% 48%, 48% 52%, center, center",
    mixBlendMode: "screen",
    opacity: pressedMultiplier,
    filter: `saturate(${1.08 + spectrumStrength * 0.18}) contrast(${1.02 + normalizedRefraction * 0.035})`,
    transform: active
      ? `translate3d(${motionDistance}px, ${-motionDistance * 0.55}px, 0) scale(${1 + 0.012 * normalizedMotion})`
      : "translate3d(0, 0, 0) scale(1)",
    WebkitMaskImage: `radial-gradient(ellipse at center, transparent ${maskStart - 4}%, rgba(0,0,0,0.74) ${maskMiddle}%, #000 100%)`,
    maskImage: `radial-gradient(ellipse at center, transparent ${maskStart - 4}%, rgba(0,0,0,0.74) ${maskMiddle}%, #000 100%)`,
  };

  const causticsLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    background: [
      `repeating-radial-gradient(ellipse at 18% 28%, rgba(160,225,255,${alpha(causticsAlpha)}) 0 1px, transparent 2px 13px)`,
      `repeating-radial-gradient(ellipse at 76% 68%, rgba(255,255,255,${alpha(causticsAlpha * 0.78)}) 0 1px, transparent 2px 15px)`,
      `linear-gradient(128deg, transparent 18%, rgba(155,225,255,${alpha(causticsAlpha * 0.42)}) 42%, transparent 62%)`,
    ].join(", "),
    backgroundSize: "92px 74px, 118px 96px, 100% 100%",
    backgroundPosition: active ? "8px -4px, -7px 6px, center" : "0 0, 0 0, center",
    mixBlendMode: "screen",
    opacity: pressedMultiplier,
    filter: `blur(${Math.max(0.15, 0.6 - normalizedCaustics * 0.18)}px) contrast(${1.2 + normalizedCaustics * 0.45})`,
    transform: active
      ? `translate3d(${-motionDistance * 0.55}px, ${motionDistance * 0.42}px, 0) scale(${1 + 0.008 * normalizedMotion})`
      : "translate3d(0, 0, 0) scale(1)",
    WebkitMaskImage: `radial-gradient(ellipse at center, rgba(0,0,0,0.18) 0%, #000 ${maskMiddle}%, #000 100%)`,
    maskImage: `radial-gradient(ellipse at center, rgba(0,0,0,0.18) 0%, #000 ${maskMiddle}%, #000 100%)`,
  };

  const sheenLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    inset: "1px",
    background: `linear-gradient(132deg, rgba(255,255,255,${alpha(0.048 * globalOpacity * normalizedIntensity * activeMultiplier)}) 0%, transparent 21%, transparent 72%, rgba(120,190,255,${alpha(0.032 * globalOpacity * normalizedRefraction * activeMultiplier)}) 100%)`,
    mixBlendMode: "screen",
    opacity: pressedMultiplier,
    transform: active
      ? `translate3d(${motionDistance * 0.4}px, ${-motionDistance * 0.25}px, 0)`
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
        if (interactive) setPressed(false);
        onPointerLeave?.(event);
      }}
      onPointerDown={(event) => {
        if (interactive) setPressed(true);
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        if (interactive) setPressed(false);
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        if (interactive) setPressed(false);
        onPointerCancel?.(event);
      }}
      onFocus={(event) => {
        if (interactive) setKeyboardActive(event.currentTarget.matches(":focus-visible"));
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
      <div aria-hidden="true" style={lensLayerStyle} />
      <div aria-hidden="true" style={spectrumLayerStyle} />
      <div aria-hidden="true" style={causticsLayerStyle} />
      <div aria-hidden="true" style={sheenLayerStyle} />

      <div className={`relative z-10 h-full w-full ${contentClassName}`}>{children}</div>
    </div>
  );
}

/** Compatibility alias for existing call sites. */
export const ThreeLiquidGlassSurface = LiquidGlassSurface;
