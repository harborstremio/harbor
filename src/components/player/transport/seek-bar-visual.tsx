import type { Settings } from "@/lib/settings";

export const GLASS_BG =
  "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.04) 50%, rgba(0,0,0,0.18) 100%)";

export const RAINBOW_BG =
  "linear-gradient(to bottom, #ff595e 0 16.67%, #ff924c 16.67% 33.33%, #ffca3a 33.33% 50%, #8ac926 50% 66.67%, #1982c4 66.67% 83.33%, #6a4c93 83.33%)";

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function resolveAccent(settings: Settings): string {
  return (settings.seekBarColor || "").trim() || "oklch(0.78 0.13 60)";
}

export type SeekSegmentSpan = { startPct: number; endPct: number; color?: string };

export function SeekBarVisual({
  settings,
  pct,
  bufferedPct,
  scrubbing = false,
  hovered = false,
  segments,
}: {
  settings: Settings;
  pct: number;
  bufferedPct?: number;
  scrubbing?: boolean;
  hovered?: boolean;
  segments?: SeekSegmentSpan[];
}) {
  const accent = resolveAccent(settings);
  const baseHeight = clamp(settings.seekBarHeight ?? 6, 3, 14);
  const trackHeight = scrubbing ? baseHeight + 2 : hovered ? baseHeight + 2 : baseHeight;
  const shape = settings.seekDotShape ?? "circle";
  const dotMax = shape === "image" ? 200 : 64;
  const baseDot = clamp(settings.seekDotSize ?? 16, 8, dotMax);
  const dotSize = scrubbing ? baseDot + 4 : baseDot;
  const style = settings.seekBarStyle ?? "flat";
  const isRainbow = style === "rainbow";
  const isImage = style === "image" && !!settings.seekBarImage;
  const dotColor = isRainbow || isImage ? "#ffffff" : accent;

  const fillStyle: React.CSSProperties = {
    width: `${pct}%`,
    height: trackHeight,
    top: "50%",
    transform: "translateY(-50%)",
    backgroundColor: isRainbow || isImage ? undefined : accent,
    backgroundImage: isRainbow ? RAINBOW_BG : isImage ? `url(${settings.seekBarImage})` : undefined,
    backgroundRepeat: isImage ? "repeat" : undefined,
    backgroundSize: isImage ? "auto 100%" : undefined,
  };
  const glassOverlay: React.CSSProperties | null =
    style === "glass" ? { backgroundImage: GLASS_BG, mixBlendMode: "overlay" } : null;

  return (
    <>
      <div className="w-full rounded-full bg-white/15 transition-[height] duration-150" style={{ height: trackHeight }}>
        {bufferedPct != null && bufferedPct > 0 && (
          <div
            className="h-full rounded-full bg-white"
            style={{
              width: `${bufferedPct}%`,
              opacity: clamp(settings.seekBarFillOpacity ?? 0.35, 0.05, 1),
            }}
          />
        )}
      </div>
      <div className="absolute overflow-hidden rounded-full transition-[height] duration-150" style={fillStyle}>
        {style === "pinstripe" && <div className="harbor-barberpole absolute inset-0" />}
        {glassOverlay && <div className="absolute inset-0" style={glassOverlay} />}
      </div>
      {(segments ?? []).map((s, i) => (
        <div
          key={`${s.startPct}-${i}`}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${s.startPct}%`,
            width: `${Math.max(0.4, s.endPct - s.startPct)}%`,
            height: Math.max(2, trackHeight - 2),
            top: "50%",
            transform: "translateY(-50%)",
            backgroundColor: s.color ?? "rgba(255,255,255,0.45)",
          }}
        />
      ))}
      {shape !== "hidden" && (
        <SeekDot shape={shape} size={dotSize} leftPct={pct} color={dotColor} image={settings.seekDotImage} />
      )}
    </>
  );
}

function SeekDot({
  shape,
  size,
  leftPct,
  color,
  image,
}: {
  shape: "circle" | "square" | "image";
  size: number;
  leftPct: number;
  color: string;
  image: string;
}) {
  if (shape === "image" && image) {
    return (
      <img
        src={image}
        alt=""
        draggable={false}
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 select-none object-contain drop-shadow-[0_0_6px_rgba(0,0,0,0.55)] transition-[width,height,opacity] duration-200"
        style={{ left: `${leftPct}%`, width: size, height: size }}
      />
    );
  }
  const radius = shape === "square" ? "20%" : "50%";
  return (
    <div
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_4px_rgba(0,0,0,0.45)] transition-[width,height,border-radius] duration-200"
      style={{
        left: `${leftPct}%`,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: radius,
      }}
    />
  );
}
