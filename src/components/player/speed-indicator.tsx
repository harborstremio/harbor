import { Gauge } from "lucide-react";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
import { useT } from "@/lib/i18n";
import { HUD_POSITION_CLASS, JAKARTA, type VolumeHudPosition } from "./volume-indicator";

export type SpeedIndicatorState = {
  visible: boolean;
  rate: number;
};

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 3;

const fraction = (rate: number) =>
  (Math.max(SPEED_MIN, Math.min(SPEED_MAX, rate)) - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);

export function formatRate(rate: number): string {
  return `${Number(rate.toFixed(2))}×`;
}

export function SpeedIndicator({
  state,
  position,
}: {
  state: SpeedIndicatorState;
  position: VolumeHudPosition;
}) {
  const t = useT();
  const normal = Math.abs(state.rate - 1) < 0.01;
  return (
    <div className={`pointer-events-none absolute z-30 w-64 ${HUD_POSITION_CLASS[position]}`}>
      <ThreeLiquidGlassSurface
        radius="20px"
        shaderRadius={0.28}
        intensity={0.1}
        causticsStrength={0.8}
        refractionStrength={1.42}
        lensStrength={1.05}
        motionSpeed={0.5}
        interactive={false}
        alwaysActive
        backdropBlur
        defaultStyle={{ backgroundColor: "rgba(8,12,18,0.35)" }}
        style={{
          overflow: "hidden",
          transition: "opacity 200ms ease-out",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(80,150,225,0.07), 0 22px 58px -22px rgba(0,0,0,0.90)",
        }}
        className={`harbor-together-surface relative w-full rounded-xl border border-white/[0.15] transition-opacity duration-200 ease-out ${
          state.visible ? "opacity-100" : "opacity-0"
        }`}
        contentClassName="flex w-full items-center gap-3.5 py-3 ps-3 pe-4 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.68)]"
      >
        <span className="flex shrink-0 items-center justify-center text-white/95">
          <Gauge size={26} strokeWidth={2.1} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-2.5">
          <span className="flex items-baseline justify-between gap-4">
            <span
              className="text-[14px] font-semibold uppercase tracking-[0.18em]"
              style={{ fontFamily: JAKARTA }}
            >
              {t("Speed")}
            </span>
            <span
              className="text-[17px] font-semibold tabular-nums leading-none text-white/92"
              style={{ fontFamily: JAKARTA }}
            >
              {normal ? t("Normal") : formatRate(state.rate)}
            </span>
          </span>
          <span className="relative h-2.5 overflow-hidden rounded-full border border-white/[0.08] bg-black/[0.20] shadow-[inset_0_1px_3px_rgba(0,0,0,0.55)]">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-white/92 transition-[width] duration-200 ease-out"
              style={{ width: `${fraction(state.rate) * 100}%` }}
            />
            <span
              className="absolute inset-y-[-2px] w-px bg-white/[0.38]"
              style={{ left: `${fraction(1) * 100}%` }}
            />
          </span>
        </span>
      </ThreeLiquidGlassSurface>
    </div>
  );
}
