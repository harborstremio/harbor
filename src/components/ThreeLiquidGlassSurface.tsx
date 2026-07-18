import {
  useEffect,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useSettings } from "@/lib/settings";

const LEGACY_SPECTRUM_PROP = `spectral${"Strength"}` as const;
const STYLE_ELEMENT_ID = "harbor-liquid-glass-css";

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

const LIQUID_GLASS_CSS = `
@keyframes harbor-liquid-lens {
  0% {
    transform: translate3d(-0.35%, 0.15%, 0) scale(1.002);
    background-position: 48% 48%, 52% 52%, center;
  }
  50% {
    transform: translate3d(0.4%, -0.25%, 0) scale(1.012);
    background-position: 52% 46%, 47% 55%, center;
  }
  100% {
    transform: translate3d(-0.15%, 0.35%, 0) scale(1.006);
    background-position: 49% 53%, 54% 47%, center;
  }
}

@keyframes harbor-liquid-spectrum {
  0% {
    transform: translate3d(-1.1%, 0.45%, 0) rotate(-0.35deg) scale(1.018);
    background-position: 43% 54%, 57% 44%, 50% 50%, 50% 50%;
  }
  50% {
    transform: translate3d(1.2%, -0.7%, 0) rotate(0.42deg) scale(1.028);
    background-position: 57% 44%, 43% 56%, 54% 46%, 46% 54%;
  }
  100% {
    transform: translate3d(-0.45%, 0.8%, 0) rotate(-0.18deg) scale(1.021);
    background-position: 48% 58%, 53% 42%, 47% 53%, 55% 45%;
  }
}

@keyframes harbor-liquid-caustics {
  0% {
    transform: translate3d(-1.2%, -0.4%, 0) scale(1.02) rotate(-0.25deg);
    background-position: 2% 4%, 98% 96%, 52% 48%, 46% 54%, center;
  }
  50% {
    transform: translate3d(1.1%, 0.9%, 0) scale(1.035) rotate(0.35deg);
    background-position: 8% -3%, 91% 103%, 47% 55%, 55% 45%, center;
  }
  100% {
    transform: translate3d(-0.3%, 1.1%, 0) scale(1.026) rotate(-0.12deg);
    background-position: -2% 8%, 103% 90%, 55% 45%, 42% 58%, center;
  }
}

@keyframes harbor-liquid-sheen {
  0% {
    transform: translate3d(-2.5%, 0, 0) scale(1.04);
    opacity: 0.7;
  }
  50% {
    transform: translate3d(2.2%, -0.6%, 0) scale(1.055);
    opacity: 1;
  }
  100% {
    transform: translate3d(-0.7%, 0.8%, 0) scale(1.045);
    opacity: 0.82;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-liquid-layer] {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}
`;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function alpha(value: number): string {
  return clamp(value, 0, 1).toFixed(4);
}

function useLiquidGlassStyles(): void {
  useEffect(() => {
    if (document.getElementById(STYLE_ELEMENT_ID)) return;

    const element = document.createElement("style");
    element.id = STYLE_ELEMENT_ID;
    element.textContent = LIQUID_GLASS_CSS;
    document.head.appendChild(element);
  }, []);
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
  useLiquidGlassStyles();

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
  const normalizedRadius = clamp(shaderRadius, 0, 1);
  const normalizedSpeed = clamp(motionSpeed, 0, 3);

  const active = alwaysActive || keyboardActive || pressed;
  const activeMix = active ? 1 : 0.22;
  const pressedMix = pressed ? 0.88 : 1;

  const transitionMs = normalizedSpeed <= 0 ? 0 : Math.round(260 / Math.max(0.35, normalizedSpeed));

  const animationEnabled =
    active && normalizedSpeed > 0 && normalizedMotion > 0 && globalOpacity > 0;

  const baseDuration = 7.4 / Math.max(0.3, normalizedSpeed);
  const lensDuration = `${baseDuration * 1.08}s`;
  const spectrumDuration = `${baseDuration * 0.92}s`;
  const causticsDuration = `${baseDuration * 1.2}s`;
  const sheenDuration = `${baseDuration * 0.72}s`;

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
    backdropFilter: variant === "surface" && backdropBlur ? blurValue : undefined,
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
    backdropFilter: variant === "overlay" && backdropBlur ? blurValue : undefined,
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
    willChange: animationEnabled ? "transform, background-position, opacity" : undefined,
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
    animationName: animationEnabled ? "harbor-liquid-lens" : undefined,
    animationDuration: lensDuration,
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    animationDirection: "alternate",
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
    animationName: animationEnabled ? "harbor-liquid-spectrum" : undefined,
    animationDuration: spectrumDuration,
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    animationDirection: "alternate",
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
    animationName: animationEnabled ? "harbor-liquid-caustics" : undefined,
    animationDuration: causticsDuration,
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    animationDirection: "alternate",
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
    animationName: animationEnabled ? "harbor-liquid-sheen" : undefined,
    animationDuration: sheenDuration,
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    animationDirection: "alternate",
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

/** Compatibility alias for existing call sites. */
export const ThreeLiquidGlassSurface = LiquidGlassSurface;
