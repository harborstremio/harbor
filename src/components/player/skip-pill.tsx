import { ChevronsRight, FastForward, Play, X } from "lucide-react";
import { AdSkipIcon } from "@/components/icons/adskip-icon";
import { useEffect, useState } from "react";
import type { SkipSegment } from "@/lib/skip-intro";
import type { SpoilerMask } from "@/lib/spoilers";
import type { PlayEpisode } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";

export function SkipPill({
  engine,
  segment,
  hasNextEp,
  nextEp,
  nextEpMask,
  remainingSec,
  leadSec,
  visible,
  onSkip,
  onNextEpisode,
  onCancelAutoNext,
  onDismiss,
}: {
  engine: "html5" | "mpv";
  segment: SkipSegment | null;
  hasNextEp: boolean;
  nextEp: PlayEpisode | null;
  nextEpMask?: SpoilerMask;
  remainingSec: number;
  leadSec?: number;
  visible: boolean;
  onSkip: () => void;
  onNextEpisode: () => void;
  onCancelAutoNext?: () => void;
  onDismiss?: () => void;
}) {
  const t = useT();
  const [mounted, setMounted] = useState<SkipSegment | null>(segment);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (segment) {
      setMounted(segment);
      const id = window.requestAnimationFrame(() => setShow(true));
      return () => window.cancelAnimationFrame(id);
    }
    setShow(false);
    const timer = window.setTimeout(() => setMounted(null), 240);
    return () => window.clearTimeout(timer);
  }, [segment?.kind, segment?.startSec, segment?.endSec]);

  if (!mounted) return null;

  const isOutroNext = mounted.kind === "outro" && hasNextEp && !!nextEp;
  const finalLeadSec = typeof leadSec === "number" && leadSec > 0 ? leadSec : 15;
  const inCountdownWindow = isOutroNext && remainingSec > 0 && remainingSec <= finalLeadSec;

  if (isOutroNext && inCountdownWindow && nextEp) {
    return (
      <UpNextCard
        ep={nextEp}
        mask={nextEpMask}
        remainingSec={remainingSec}
        leadSec={finalLeadSec}
        visible={visible && show}
        onPlay={onNextEpisode}
        onCancel={onCancelAutoNext}
      />
    );
  }

  const isAd = mounted.kind === "ad";
  const label = isAd
    ? t("Skip injected ad?")
    : mounted.kind === "intro"
      ? t("Skip Intro")
      : mounted.kind === "recap"
        ? t("Skip Recap")
        : isOutroNext
          ? t("Next Episode")
          : t("Skip Credits");
  const action = isOutroNext ? onNextEpisode : onSkip;
  const Icon = isOutroNext ? ChevronsRight : FastForward;
  const isMpv = engine === "mpv";
  return (
    <div
      className={`pointer-events-none absolute end-7 z-30 flex items-center gap-2 transition-all duration-200 ease-out ${
        visible && show
          ? "bottom-44 translate-y-0 opacity-100"
          : "bottom-40 translate-y-2 opacity-0"
      }`}
    >
      <ThreeLiquidGlassSurface
        radius="9999px"
        shaderRadius={0.48}
        intensity={0.3}
        refractionStrength={0.08}
        interactive={false}
        alwaysActive
        experimentalStyle={{
          background: isMpv ? "rgba(8,12,18,0.35)" : "transparent",
          backdropFilter: "blur(18px) saturate(1.25)",
          WebkitBackdropFilter: "blur(18px) saturate(1.25)",
        }}
        style={{
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.05)",
        }}
        className="pointer-events-auto inline-flex h-[42px] w-fit shrink-0"
        surfaceClassName={`border ${isAd ? "border-rose-400/50" : "border-white/[0.08]"}`}
        contentClassName="flex h-full w-full"
      >
        <button
          type="button"
          onClick={action}
          className="
            inline-flex
            h-full
            w-full
            items-center
            gap-2
            rounded-full
            bg-transparent
            px-5
            text-[14px]
            font-semibold
            text-white
            transition-transform
            active:scale-[0.97]
          "
        >
          {isAd ? (
            <AdSkipIcon className="h-[18px] w-[18px]" />
          ) : (
            <Icon size={18} strokeWidth={2.2} />
          )}

          {label}
        </button>
      </ThreeLiquidGlassSurface>

      {onDismiss && !isOutroNext && (
        <ThreeLiquidGlassSurface
          radius="9999px"
          shaderRadius={0.48}
          intensity={0.3}
          refractionStrength={0.08}
          interactive={false}
          alwaysActive
          experimentalStyle={{
            background: isMpv ? "rgba(8,12,18,0.35)" : "transparent",
            backdropFilter: "blur(18px) saturate(1.25)",
            WebkitBackdropFilter: "blur(18px) saturate(1.25)",
          }}
          style={{
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.05)",
          }}
          className="pointer-events-auto h-9 w-9 shrink-0"
          surfaceClassName="border border-white/[0.08]"
          contentClassName="flex h-full w-full"
        >
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("Hide this Skip button")}
            title={t("Hide this Skip button")}
            className="
              flex
              h-full
              w-full
              items-center
              justify-center
              rounded-full
              bg-transparent
              text-white/70
              transition-[color,transform]
              hover:text-white
              active:scale-[0.97]
            "
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </ThreeLiquidGlassSurface>
      )}
    </div>
  );
}

function UpNextCard({
  ep,
  mask,
  remainingSec,
  leadSec,
  visible,
  onPlay,
  onCancel,
}: {
  ep: PlayEpisode;
  mask?: SpoilerMask;
  remainingSec: number;
  leadSec: number;
  visible: boolean;
  onPlay: () => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const seconds = Math.max(0, Math.ceil(remainingSec));
  const progress = Math.min(1, Math.max(0, 1 - seconds / leadSec));
  const epLabel =
    typeof ep.season === "number" && typeof ep.episode === "number"
      ? `S${ep.imdbSeason ?? ep.season} · E${ep.imdbEpisode ?? ep.episode}`
      : t("Up Next");
  const title = mask?.title ? epLabel : ep.name?.trim() || epLabel;
  const hideStill = mask?.thumb === true;

  return (
    <div
      className={`pointer-events-none absolute end-7 z-30 transition-all duration-200 ease-out ${
        visible ? "bottom-44 opacity-100 translate-y-0" : "bottom-40 opacity-0 translate-y-2"
      }`}
    >
      <div
        className={`pointer-events-auto relative flex w-[360px] overflow-hidden rounded-2xl border border-white/15 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-md ${
          settings.experimentalLiquidGlassEnabled ? "bg-[#080c12]/35" : "bg-black/80"
        }`}
      >
        <div className="relative aspect-[16/10] w-[148px] shrink-0 overflow-hidden bg-white/5">
          {ep.still && !hideStill ? (
            <img
              src={ep.still}
              alt=""
              draggable={false}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-[11px] uppercase tracking-[0.18em] text-white/45">
              {epLabel}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/60" />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
                {t("Up next in {s}s", { s: seconds })}
              </div>
              <div className="mt-0.5 truncate text-[13.5px] font-semibold text-white">{title}</div>
              {title !== epLabel && (
                <div className="truncate text-[11.5px] text-white/55">{epLabel}</div>
              )}
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                aria-label={t("Cancel autoplay")}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={13} strokeWidth={2.2} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onPlay}
            className="mt-auto inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-full bg-white px-4 text-[12.5px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            <Play size={12} strokeWidth={2.4} className="fill-current" />
            {t("Play now")}
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
          <div
            className="h-full bg-white transition-[width] duration-200 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
