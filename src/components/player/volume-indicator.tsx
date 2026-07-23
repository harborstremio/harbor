import { Volume1, Volume2, VolumeX } from "lucide-react";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
import { useT } from "@/lib/i18n";
import {
  NORMAL_FRACTION,
  VOL_MAX,
  boostColor,
  fractionFromValue,
} from "./transport/transport-utils";

export type VolumeIndicatorState = {
  visible: boolean;
  volume: number;
  muted: boolean;
};

export type VolumeHudPosition = "center" | "top" | "top-left" | "top-right";

const POS: Record<VolumeHudPosition, string> = {
  center: "left-[calc(50%-8rem)] top-[calc(50%-2.25rem)]",
  top: "left-[calc(50%-8rem)] top-9",
  "top-left": "left-6 top-9",
  "top-right": "right-6 top-9",
};

export function VolumeIndicator({
  state,
  allowBoost,
  position,
}: {
  state: VolumeIndicatorState;
  allowBoost: boolean;
  position: VolumeHudPosition;
}) {
  const t = useT();
  const max = allowBoost ? VOL_MAX : 1;
  const volume = Math.max(0, Math.min(max, state.volume));
  const muted = state.muted || volume <= 0;

  const fillPct = (muted ? 0 : allowBoost ? fractionFromValue(volume) : volume) * 100;

  const pct = Math.round((muted ? 0 : volume) * 100);
  const boosting = allowBoost && !muted && volume > 1.001;
  const color = boostColor(volume);

  const Icon = muted ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      className={`
        pointer-events-none
        absolute z-30
        w-64
        ${POS[position]}
      `}
    >
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
        defaultStyle={{
          // mpv video is composited outside WebKit, so use a subtle tint instead
          // of the opaque canvas fallback.
          backgroundColor: "rgba(8,12,18,0.35)",
        }}
        experimentalStyle={{
          background:
            "linear-gradient(145deg, rgba(8,12,18,0.36), rgba(8,12,18,0.30) 48%, rgba(8,12,18,0.34))",
        }}
        style={{
          overflow: "hidden",
          transition: "opacity 200ms ease-out",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(80,150,225,0.07), 0 22px 58px -22px rgba(0,0,0,0.90)",
        }}
        className={`
          harbor-together-surface
          relative w-full
          rounded-[20px]
          border border-white/[0.15]
          transition-opacity duration-200 ease-out
          ${state.visible ? "opacity-100" : "opacity-0"}
        `}
        surfaceClassName="
          border border-white/[0.07]
        "
        contentClassName="
          flex w-full items-center gap-3.5
          py-3 ps-3 pe-4
          text-white
          [text-shadow:0_1px_2px_rgba(0,0,0,0.68)]
        "
      >
        <span
          className="
            flex h-11 w-11 shrink-0
            items-center justify-center
            rounded-[15px]
            border border-white/[0.12]
            bg-white/[0.09]
            shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]
          "
          style={{
            color: boosting ? color : "rgba(255,255,255,0.95)",
          }}
        >
          <Icon size={24} strokeWidth={2.1} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-2.5">
          <span className="flex items-baseline justify-between gap-4">
            <span className="text-[14px] font-semibold uppercase tracking-[0.18em]">
              {t("Volume")}
            </span>

            <span
              className="font-sans text-[17px] font-normal tabular-nums leading-none"
              style={{
                color: boosting ? color : "rgba(255,255,255,0.94)",
              }}
            >
              {muted ? t("Muted") : `${pct}%`}
            </span>
          </span>

          <span
            className="
              relative h-2.5
              overflow-hidden rounded-full
              border border-white/[0.08]
              bg-black/[0.20]
              shadow-[inset_0_1px_3px_rgba(0,0,0,0.55)]
            "
          >
            <span
              className="
                absolute inset-y-0 left-0
                rounded-full
                transition-[width]
                duration-150 ease-out
              "
              style={{
                width: `${fillPct}%`,
                background: boosting ? color : "rgba(255,255,255,0.92)",
              }}
            />

            {allowBoost && (
              <span
                className="absolute inset-y-[-2px] w-px bg-white/[0.38]"
                style={{
                  left: `${NORMAL_FRACTION * 100}%`,
                }}
              />
            )}
          </span>
        </span>
      </ThreeLiquidGlassSurface>
    </div>
  );
}
