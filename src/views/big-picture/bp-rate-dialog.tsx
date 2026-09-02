import { useEffect, useRef } from "react";
import { SFX } from "@/lib/sfx";
import { rate, unrate } from "@/lib/ratings/actions";
import { useRating } from "@/lib/ratings/store";
import type { RatingTarget } from "@/lib/ratings/types";
import { pushBpBack } from "./bp-back";
import { useBpT } from "./bp-i18n";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function BpRateDialog({ target, onClose }: { target: RatingTarget; onClose: () => void }) {
  const t = useBpT();
  const existing = useRating(target.itemKey);
  const score = existing?.score ?? 0;
  const seedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const prev = currentBpFocus(document.querySelector<HTMLElement>("[data-bp-root]"));
    if (seedRef.current) setBpFocus(seedRef.current, { silent: true });
    return () => {
      if (prev?.isConnected) setBpFocus(prev, { silent: true });
    };
  }, []);

  useEffect(
    () =>
      pushBpBack(() => {
        onClose();
        return true;
      }),
    [onClose],
  );

  return (
    <div
      role="dialog"
      aria-label={t("Rate this")}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_78%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex w-[min(90vw,1080px)] flex-col gap-[clamp(18px,2.4vh,32px)] rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(26px,3vw,46px)]">
        <div className="flex flex-col gap-[clamp(5px,0.8vh,11px)]">
          <h2 className="font-display text-[clamp(20px,2.9vh,35px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {t("Rate this")}
          </h2>
          <p className="line-clamp-1 text-[clamp(13px,1.8vh,20px)] text-ink-subtle">{target.title}</p>
        </div>

        <div data-bp-row style={{ paddingInline: 0, marginInline: 0 }}>
          <div
            data-bp-scroll-x
            className="flex items-center gap-[clamp(8px,0.8vw,15px)] overflow-x-auto py-[24px] ps-[18px] pe-[18px] -my-[24px] -ms-[18px] -me-[18px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SCORES.map((n) => (
              <button
                key={n}
                ref={n === (score || 8) ? seedRef : undefined}
                type="button"
                data-bp-focusable
                data-bp-chip
                aria-pressed={score === n}
                onClick={() => {
                  SFX.click();
                  void rate(target, n).catch(() => {});
                  onClose();
                }}
                className={`flex h-[clamp(56px,6.4vh,80px)] w-[clamp(56px,6.4vh,80px)] shrink-0 items-center justify-center rounded-full text-[clamp(17px,2.3vh,28px)] font-bold tabular-nums transition-colors duration-[var(--bp-dur-fast)] ${
                  score === n
                    ? "bg-[var(--bp-on)] text-ink"
                    : "border border-[var(--bp-edge-2)] text-ink"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div
          data-bp-row
          data-bp-scroll-x
          style={{ paddingInline: 0, marginInline: 0 }}
          className="flex gap-[clamp(9px,0.9vw,16px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.close();
              onClose();
            }}
            className="h-[clamp(48px,5.6vh,66px)] flex-1 rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
          >
            {t("Close")}
          </button>
          {score > 0 && (
            <button
              type="button"
              data-bp-focusable
              data-bp-chip
              onClick={() => {
                SFX.click();
                void unrate(target.itemKey).catch(() => {});
                onClose();
              }}
              className="h-[clamp(48px,5.6vh,66px)] flex-1 rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
            >
              {t("Remove rating")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
