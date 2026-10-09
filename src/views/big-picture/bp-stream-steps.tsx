import { useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { SFX } from "@/lib/sfx";
import type { PlayEpisode } from "@/lib/view";
import { bpCardArt } from "./bp-art";
import { pushBpBack } from "./bp-back";
import { useBpT } from "./bp-i18n";
import { setBpFocus } from "./use-bp-focus";

const BLUR_BED_WIDTH = 140;

export function BpAutoStep({
  meta,
  episode,
  attemptIdx,
  onCancel,
}: {
  meta: Meta;
  episode?: PlayEpisode;
  attemptIdx: number;
  onCancel: () => void;
}) {
  const t = useBpT();
  const seedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (seedRef.current) setBpFocus(seedRef.current, { silent: true });
  }, []);

  useEffect(
    () =>
      pushBpBack(() => {
        onCancel();
        return true;
      }),
    [onCancel],
  );

  const backdrop = bpCardArt(episode?.still || meta.background || meta.poster, BLUR_BED_WIDTH);
  const caption = attemptIdx > 0 ? t("Trying source {n}", { n: attemptIdx + 1 }) : t("Connecting");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      data-bp-dialog
      className="absolute inset-0 flex flex-col items-center justify-center gap-[clamp(20px,2.6vh,40px)] overflow-hidden bg-[var(--bp-void)] px-[var(--bp-gutter)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 blur-[28px]"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklab,var(--bp-void)_72%,transparent)]" />

      <div className="relative flex flex-col items-center gap-[clamp(14px,1.8vh,28px)] text-center">
        {meta.logo ? (
          <img
            src={meta.logo}
            alt={meta.name}
            className="max-h-[clamp(80px,14vh,200px)] w-auto max-w-[min(56vw,860px)] object-contain drop-shadow-[0_8px_34px_rgba(0,0,0,0.75)]"
          />
        ) : (
          <h2 className="max-w-[min(66vw,1000px)] font-display text-[clamp(30px,5.2vh,72px)] font-semibold leading-[1.04] tracking-[-0.025em] text-ink">
            {meta.name}
          </h2>
        )}
        {episode && (
          <p className="text-[clamp(12.5px,1.7vh,19px)] font-bold uppercase tracking-[0.28em] text-ink-subtle">
            {`S${episode.imdbSeason ?? episode.season} · E${String(episode.imdbEpisode ?? episode.episode).padStart(2, "0")}`}
            {episode.name ? ` · ${episode.name}` : ""}
          </p>
        )}
        <p className="flex items-center gap-[clamp(9px,0.9vw,16px)] text-[clamp(14px,1.95vh,22px)] font-semibold text-ink-subtle">
          <Loader2 size={22} className="animate-spin motion-reduce:[animation-duration:2.4s]" strokeWidth={2.4} />
          {caption}
        </p>
      </div>

      <div
        data-bp-row
        data-bp-scroll-x
        style={{ paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 100px" }}
        className="relative flex gap-[clamp(9px,0.9vw,16px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          ref={seedRef}
          type="button"
          data-bp-focusable
          data-bp-chip
          data-bp-autofocus="true"
          onClick={() => {
            SFX.close();
            onCancel();
          }}
          className="flex h-[clamp(48px,5.6vh,66px)] shrink-0 items-center gap-[clamp(7px,0.7vw,13px)] rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] px-[clamp(18px,1.6vw,32px)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
        >
          <X size={19} strokeWidth={2.6} />
          {t("Choose a source instead")}
        </button>
      </div>
    </div>
  );
}
