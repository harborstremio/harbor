import { useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

const LEGACY_SPECTRUM_PROP = `spectral${"Strength"}` as const;
type LegacySpectrumProps = Partial<Record<typeof LEGACY_SPECTRUM_PROP, number>>;

export type ExperimentalLiquidGlassSurfaceProps = HTMLAttributes<HTMLDivElement> &
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
    variant?: "default" | "surface" | "overlay";
    backdropBlur?: boolean;
    rendererOpacity?: number;
  };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function alpha(value: number): string {
  return clamp(value, 0, 1).toFixed(4);
}

export function ExperimentalLiquidGlassSurface({
  children,
  className = "",
  contentClassName = "",
  surfaceClassName = "",
  variant = "surface",
  backdropBlur = true,
  rendererOpacity = 100,
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
}: ExperimentalLiquidGlassSurfaceProps) {
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [pressed, setPressed] = useState(false);

  const forwardedProps = { ...wrapperProps } as HTMLAttributes<HTMLDivElement> &
    Record<string, unknown>;

  const spectrumLevel = clamp(Number(forwardedProps[LEGACY_SPECTRUM_PROP] ?? 1.48), 0, 2.5);

  delete forwardedProps[LEGACY_SPECTRUM_PROP];

  const globalOpacity = clamp(rendererOpacity / 100, 0, 1);
  const normalizedIntensity = clamp(intensity, 0, 1.5);
  const normalizedRefraction = clamp(refractionStrength, 0, 1.8);
  const normalizedLens = clamp(lensStrength, 0, 2.5);
  const normalizedCaustics = clamp(causticsStrength, 0, 1.5);
  const normalizedMotion = clamp(motionStrength, 0, 2);
  const normalizedRadius = clamp(shaderRadius, 0, 1);
  const normalizedSpeed = clamp(motionSpeed, 0, 3);

  const active = alwaysActive || keyboardActive;
  const activeMix = active ? 1 : 0.22;
  const pressedMix = pressed ? 0.88 : 1;

  const transitionMs = normalizedSpeed <= 0 ? 0 : Math.round(260 / Math.max(0.35, normalizedSpeed));

  const resolvedVariant = variant === "default" ? "surface" : variant;

  const standardBlur = (2.7 + normalizedRefraction * 0.5) * globalOpacity;

  const topSurfaceAlpha = 0.0065 * globalOpacity * normalizedIntensity;
  const bottomSurfaceAlpha = 0.0012 * globalOpacity * normalizedIntensity;
  const topEdgeAlpha = 0.058 * globalOpacity * normalizedIntensity;
  const bottomEdgeAlpha = 0.032 * globalOpacity;

  const lensAlpha = 0.082 * globalOpacity * normalizedIntensity * normalizedLens * activeMix;

  const spectrumAlpha = 0.078 * globalOpacity * normalizedIntensity * spectrumLevel * activeMix;

  const chromaticAlpha = 0.052 * globalOpacity * normalizedIntensity * spectrumLevel * activeMix;

  const causticsAlpha =
    0.058 * globalOpacity * normalizedIntensity * normalizedCaustics * activeMix;

  const sheenAlpha =
    0.044 * globalOpacity * normalizedIntensity * (0.55 + normalizedRefraction * 0.35) * activeMix;

  const maskStart = 24 + (1 - normalizedRadius) * 18;
  const maskMiddle = 63 + (1 - normalizedRadius) * 7;

  const blurValue = `blur(${standardBlur}px) saturate(${
    1.34 + normalizedRefraction * 0.065
  }) brightness(1.012) contrast(1.035)`;

  const glassStyle: CSSProperties = {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    borderRadius: radius,
    backdropFilter:
      resolvedVariant === "surface" && backdropBlur && globalOpacity > 0 ? blurValue : undefined,
    background: [
      `linear-gradient(145deg, rgba(255,255,255,${alpha(
        topSurfaceAlpha,
      )}) 0%, rgba(255,255,255,${alpha(bottomSurfaceAlpha)}) 58%, rgba(80,145,210,${alpha(
        0.0018 * globalOpacity * normalizedRefraction,
      )}) 100%)`,
      `radial-gradient(125% 95% at 50% -12%, rgba(255,255,255,${alpha(
        0.022 * globalOpacity * normalizedIntensity,
      )}) 0%, transparent 56%)`,
    ].join(", "),
    boxShadow: [
      `inset 0 1px 0 rgba(255,255,255,${alpha(topEdgeAlpha)})`,
      `inset 0 -1px 0 rgba(0,0,0,${alpha(bottomEdgeAlpha)})`,
      `inset 1px 0 0 rgba(90,190,255,${alpha(0.011 * globalOpacity * normalizedLens)})`,
      `inset -1px 0 0 rgba(255,90,190,${alpha(0.0085 * globalOpacity * spectrumLevel)})`,
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
    backdropFilter:
      resolvedVariant === "overlay" && backdropBlur && globalOpacity > 0 ? blurValue : undefined,
    background: [
      `radial-gradient(110% 88% at 50% -9%, rgba(255,255,255,${alpha(
        0.018 * globalOpacity * normalizedIntensity,
      )}) 0%, transparent 58%)`,
      `linear-gradient(152deg, rgba(255,255,255,${alpha(
        0.0055 * globalOpacity,
      )}) 0%, transparent 34%, transparent 70%, rgba(100,180,255,${alpha(
        0.005 * globalOpacity,
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
    transformOrigin: "50% 50%",
    transition: [
      `opacity ${transitionMs}ms ease`,
      `transform ${transitionMs}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
      `filter ${transitionMs}ms ease`,
    ].join(", "),
  };

  const lensLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    background: [
      `radial-gradient(ellipse at 50% 49%, transparent 0%, transparent ${maskStart}%, rgba(105,190,255,${alpha(
        lensAlpha * 0.28,
      )}) ${maskMiddle}%, rgba(255,255,255,${alpha(lensAlpha)}) 96%, transparent 100%)`,
      `radial-gradient(ellipse at 50% 45%, rgba(255,255,255,${alpha(
        lensAlpha * 0.28,
      )}) 0%, transparent 38%, transparent 74%, rgba(85,175,255,${alpha(lensAlpha * 0.45)}) 100%)`,
      `conic-gradient(from 212deg at 50% 50%, transparent 0deg, rgba(90,210,255,${alpha(
        lensAlpha * 0.2,
      )}) 42deg, transparent 86deg, transparent 218deg, rgba(255,105,210,${alpha(
        lensAlpha * 0.16,
      )}) 266deg, transparent 315deg)`,
    ].join(", "),
    backgroundSize: "104% 104%, 108% 108%, 112% 112%",
    mixBlendMode: "screen",
    filter: `contrast(${1.04 + normalizedLens * 0.024})`,
  };

  const spectrumLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    background: [
      `linear-gradient(118deg, transparent 8%, transparent 25%, rgba(255,55,130,${alpha(
        spectrumAlpha * 0.82,
      )}) 34%, rgba(255,208,95,${alpha(spectrumAlpha * 0.58)}) 43%, rgba(65,225,255,${alpha(
        spectrumAlpha,
      )}) 55%, rgba(112,78,255,${alpha(
        spectrumAlpha * 0.88,
      )}) 67%, transparent 79%, transparent 93%)`,
      `linear-gradient(39deg, transparent 13%, rgba(55,195,255,${alpha(
        spectrumAlpha * 0.58,
      )}) 35%, transparent 51%, rgba(255,65,175,${alpha(
        spectrumAlpha * 0.55,
      )}) 68%, transparent 87%)`,
      `radial-gradient(circle at 73% 27%, rgba(100,235,255,${alpha(
        chromaticAlpha * 0.9,
      )}) 0%, transparent 25%)`,
      `radial-gradient(circle at 25% 77%, rgba(255,85,195,${alpha(
        chromaticAlpha * 0.78,
      )}) 0%, transparent 27%)`,
    ].join(", "),
    backgroundSize: "150% 150%, 142% 142%, 106% 106%, 106% 106%",
    mixBlendMode: "screen",
    filter: `saturate(${1.04 + spectrumLevel * 0.21}) contrast(${
      1.025 + normalizedRefraction * 0.035
    })`,
    maskImage: `radial-gradient(ellipse at center, transparent 0%, transparent ${
      maskStart - 7
    }%, rgba(0,0,0,0.72) ${maskMiddle}%, #000 100%)`,
  };

  const causticsLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    background: [
      `radial-gradient(ellipse 18% 33% at 18% 25%, rgba(145,220,255,${alpha(
        causticsAlpha,
      )}) 0%, rgba(145,220,255,${alpha(causticsAlpha * 0.35)}) 29%, transparent 70%)`,
      `radial-gradient(ellipse 24% 16% at 77% 70%, rgba(255,255,255,${alpha(
        causticsAlpha * 0.88,
      )}) 0%, transparent 73%)`,
      `radial-gradient(ellipse 13% 31% at 61% 30%, rgba(115,200,255,${alpha(
        causticsAlpha * 0.74,
      )}) 0%, transparent 72%)`,
      `radial-gradient(ellipse 29% 12% at 35% 80%, rgba(255,130,215,${alpha(
        causticsAlpha * 0.43,
      )}) 0%, transparent 75%)`,
      `linear-gradient(131deg, transparent 23%, rgba(145,218,255,${alpha(
        causticsAlpha * 0.32,
      )}) 45%, transparent 65%)`,
    ].join(", "),
    backgroundSize: "110% 110%, 114% 114%, 108% 108%, 112% 112%, 100% 100%",
    mixBlendMode: "screen",
    filter: `blur(${Math.max(
      0.65,
      1.5 - normalizedCaustics * 0.38,
    )}px) contrast(${1.08 + normalizedCaustics * 0.24})`,
    maskImage:
      "radial-gradient(ellipse at center, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.7) 57%, #000 100%)",
  };

  const chromaticEdgeStyle: CSSProperties = {
    ...sharedLayerStyle,
    inset: "1px",
    background: [
      `linear-gradient(90deg, rgba(255,55,135,${alpha(
        chromaticAlpha * 0.78,
      )}) 0%, transparent 7%, transparent 93%, rgba(55,205,255,${alpha(chromaticAlpha)}) 100%)`,
      `linear-gradient(180deg, rgba(100,225,255,${alpha(
        chromaticAlpha * 0.4,
      )}) 0%, transparent 8%, transparent 92%, rgba(255,75,180,${alpha(
        chromaticAlpha * 0.34,
      )}) 100%)`,
    ].join(", "),
    boxShadow: [
      `inset 0 0 0 1px rgba(255,255,255,${alpha(0.016 * globalOpacity * normalizedIntensity)})`,
      `inset 0 0 ${4 + normalizedLens * 2}px rgba(85,185,255,${alpha(chromaticAlpha * 0.34)})`,
    ].join(", "),
    mixBlendMode: "screen",
  };

  const sheenLayerStyle: CSSProperties = {
    ...sharedLayerStyle,
    inset: "-8%",
    background: [
      `linear-gradient(132deg, transparent 17%, rgba(255,255,255,${alpha(
        sheenAlpha,
      )}) 35%, transparent 49%, transparent 100%)`,
      `linear-gradient(315deg, transparent 44%, rgba(95,190,255,${alpha(
        sheenAlpha * 0.65,
      )}) 60%, transparent 74%)`,
    ].join(", "),
    backgroundSize: "150% 150%, 145% 145%",
    mixBlendMode: "screen",
    maskImage: `radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.32) ${
      maskStart - 5
    }%, #000 100%)`,
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
      <div aria-hidden="true" data-liquid-layer="lens" style={lensLayerStyle} />
      <div aria-hidden="true" data-liquid-layer="spectrum" style={spectrumLayerStyle} />
      <div aria-hidden="true" data-liquid-layer="caustics" style={causticsLayerStyle} />
      <div aria-hidden="true" data-liquid-layer="chromatic-edge" style={chromaticEdgeStyle} />
      <div aria-hidden="true" data-liquid-layer="sheen" style={sheenLayerStyle} />

      <div className={`relative z-10 h-full w-full ${contentClassName}`}>{children}</div>
    </div>
  );
}
