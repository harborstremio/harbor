import { useEffect, useRef, type CSSProperties } from "react";
import { Check } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { pushBpBack } from "./bp-back";
import { useBpT } from "./bp-i18n";
import { bpFirstVisible } from "./bp-visible";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

const LIFT = { "--bp-focus-lift-wide": "1.012" } as CSSProperties;

export function BpSeasonMenu({
  seasons,
  counts,
  value,
  onPick,
  onClose,
}: {
  seasons: number[];
  counts: ReadonlyMap<number, number>;
  value: number;
  onPick: (season: number) => void;
  onClose: () => void;
}) {
  const t = useBpT();
  const seedRef = useRef<HTMLButtonElement | null>(null);
  const selectedAt = Math.max(0, seasons.indexOf(value));

  useEffect(() => {
    const prev = currentBpFocus(bpFirstVisible("[data-bp-root]"));
    if (seedRef.current) setBpFocus(seedRef.current, { silent: true });
    return () => {
      if (prev?.isConnected) {
        setBpFocus(prev, { silent: true });
        return;
      }
      const back = document.querySelector<HTMLElement>('[data-bp-restore-key="bp-season-trigger"]');
      if (back) setBpFocus(back, { silent: true });
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
      aria-label={t("Seasons")}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_78%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex max-h-[78vh] w-[min(72vw,520px)] flex-col gap-[clamp(16px,2.2vh,30px)] rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(26px,3vw,46px)]">
        <h2 className="font-display text-[clamp(20px,2.9vh,35px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          {t("Seasons")}
        </h2>

        <div
          data-bp-scroll-y
          data-bp-center
          className="-mx-[16px] flex flex-col gap-[clamp(7px,0.8vh,13px)] overflow-y-auto px-[16px] py-[clamp(12px,1.4vh,20px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {seasons.map((s, i) => {
            const on = s === value;
            return (
              <button
                key={s}
                ref={i === selectedAt ? seedRef : undefined}
                type="button"
                data-bp-focusable
                data-bp-tile="wide"
                style={LIFT}
                aria-pressed={on}
                onClick={() => {
                  SFX.click();
                  onPick(s);
                  onClose();
                }}
                className={`flex h-[clamp(56px,6.2vh,78px)] shrink-0 items-center gap-[clamp(11px,1vw,20px)] rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)] px-[clamp(16px,1.4vw,28px)] text-start text-[clamp(14px,1.95vh,23px)] font-bold data-[bp-focus=true]:bg-[var(--color-ink)] data-[bp-focus=true]:text-[var(--color-canvas)] ${
                  on ? "text-ink" : "text-ink-muted"
                }`}
              >
                <span className="flex-1">{t("Season {n}", { n: s })}</span>
                <span className="shrink-0 text-[clamp(12px,1.6vh,19px)] font-semibold tabular-nums text-ink-subtle">
                  {t("{n} episodes", { n: counts.get(s) ?? 0 })}
                </span>
                {on && (
                  <Check size={22} strokeWidth={2.6} className="shrink-0 text-[var(--bp-live)]" />
                )}
              </button>
            );
          })}
        </div>

        <div
          data-bp-row
          data-bp-scroll-x
          style={{ paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 100px" }}
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
            className="h-[clamp(48px,5.6vh,66px)] flex-1 rounded-[var(--bp-r-xs)] bg-[var(--bp-panel-2)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink transition-colors duration-[var(--bp-dur-fast)] motion-reduce:transition-none data-[bp-focus=true]:bg-[var(--color-ink)] data-[bp-focus=true]:text-[var(--color-canvas)]"
          >
            {t("Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
