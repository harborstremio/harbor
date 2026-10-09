import { useEffect, useRef } from "react";
import { Check, Trash2 } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { pushBpBack } from "./bp-back";
import type { BpTracker } from "./use-bp-trackers";
import { useBpT } from "./bp-i18n";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

const CHOICE_SCOPE = {
  paddingInline: 0,
  marginInline: 0,
  containIntrinsicSize: "auto 78px",
} as const;

export function BpStatusDialog({
  tracker,
  onClose,
}: {
  tracker: BpTracker;
  onClose: () => void;
}) {
  const t = useBpT();
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

  const selectedAt = Math.max(
    0,
    tracker.choices.findIndex((c) => c.id === tracker.status),
  );

  return (
    <div
      role="dialog"
      aria-label={tracker.name}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_78%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]"
    >
      <div className="flex max-h-[80vh] w-[min(88vw,760px)] flex-col gap-[clamp(16px,2.2vh,30px)] rounded-[var(--bp-r-lg)] border border-[var(--bp-edge-2)] bg-[var(--bp-panel)] p-[clamp(26px,3vw,46px)]">
        <h2 className="flex items-center gap-[clamp(10px,0.9vw,18px)] font-display text-[clamp(20px,2.9vh,35px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          <img
            src={tracker.logo}
            alt=""
            className="h-[clamp(26px,3vh,38px)] w-[clamp(26px,3vh,38px)] rounded-[var(--bp-r-xs)] object-contain"
          />
          {tracker.name}
        </h2>

        <div
          data-bp-scroll-y
          className="flex flex-col gap-[clamp(7px,0.8vh,13px)] overflow-y-auto pt-[6px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tracker.choices.map((c, i) => {
            const on = c.id === tracker.status;
            return (
              <div
                key={c.id}
                data-bp-row
                data-bp-scroll-x
                className="shrink-0"
                style={CHOICE_SCOPE}
              >
                <button
                  ref={i === selectedAt ? seedRef : undefined}
                  type="button"
                  data-bp-focusable
                  data-bp-chip
                  aria-pressed={on}
                  onClick={() => {
                    SFX.click();
                    tracker.set(c.id);
                    onClose();
                  }}
                  className={`flex h-[clamp(56px,6.2vh,78px)] w-full items-center justify-between gap-4 rounded-[var(--bp-r-sm)] px-[clamp(16px,1.4vw,28px)] text-start text-[clamp(14px,1.95vh,23px)] font-bold transition-colors duration-[var(--bp-dur-fast)] ${
                    on
                      ? "bg-[var(--bp-on)] text-ink"
                      : "border border-[var(--bp-edge-2)] text-ink"
                  }`}
                >
                  <span className="line-clamp-1">{t(c.label)}</span>
                  {on && <Check size={22} strokeWidth={2.6} className="shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>

        <div
          data-bp-row
          data-bp-scroll-x
          style={{ paddingInline: 0, marginInline: 0 }}
          className="flex shrink-0 gap-[clamp(9px,0.9vw,16px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
          {tracker.remove && (
            <button
              type="button"
              data-bp-focusable
              data-bp-chip
              onClick={() => {
                SFX.click();
                tracker.remove?.();
                onClose();
              }}
              className="flex h-[clamp(48px,5.6vh,66px)] flex-1 items-center justify-center gap-[clamp(7px,0.7vw,13px)] rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
            >
              <Trash2 size={19} strokeWidth={2.2} />
              {t("Remove from list")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
