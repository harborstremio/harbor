import { useEffect, useRef, type CSSProperties } from "react";
import { Check } from "lucide-react";
import { AddonLogo } from "@/components/addon-logo";
import { SFX } from "@/lib/sfx";
import { pushBpBack } from "./bp-back";
import { useBpT } from "./bp-i18n";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

const LIFT = { "--bp-focus-lift-wide": "1.012" } as CSSProperties;

export type BpMenuOption = {
  id: string;
  label: string;
  count?: number;
  addonId?: string;
  logo?: string | null;
};

export function BpStreamMenu({
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  title: string;
  options: BpMenuOption[];
  value: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const t = useBpT();
  const seedRef = useRef<HTMLButtonElement | null>(null);
  const selectedAt = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );

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
      aria-label={title}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_78%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex max-h-[78vh] w-[min(88vw,780px)] flex-col gap-[clamp(16px,2.2vh,30px)] rounded-[var(--bp-r-lg)] border border-[var(--bp-edge-2)] bg-[var(--bp-panel)] p-[clamp(26px,3vw,46px)]">
        <h2 className="font-display text-[clamp(20px,2.9vh,35px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          {title}
        </h2>

        <div
          data-bp-scroll-y
          className="-mx-[16px] flex flex-col gap-[clamp(7px,0.8vh,13px)] overflow-y-auto px-[16px] py-[clamp(12px,1.4vh,20px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map((o, i) => {
            const on = o.id === value;
            return (
              <button
                key={o.id}
                ref={i === selectedAt ? seedRef : undefined}
                type="button"
                data-bp-focusable
                data-bp-tile="wide"
                style={LIFT}
                aria-pressed={on}
                onClick={() => {
                  SFX.click();
                  onPick(o.id);
                }}
                className={`flex h-[clamp(56px,6.2vh,78px)] shrink-0 items-center gap-[clamp(11px,1vw,20px)] rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)] px-[clamp(16px,1.4vw,28px)] text-start text-[clamp(14px,1.95vh,23px)] font-bold data-[bp-focus=true]:bg-[var(--color-ink)] data-[bp-focus=true]:text-[var(--color-canvas)] ${
                  on ? "text-ink" : "text-ink-muted"
                }`}
              >
                {o.addonId && (
                  <span className="flex h-[clamp(32px,3.6vh,46px)] w-[clamp(32px,3.6vh,46px)] shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-xs)]">
                    <AddonLogo
                      addonId={o.addonId}
                      addonName={o.label}
                      manifestLogo={o.logo ?? null}
                      size="xl"
                    />
                  </span>
                )}
                <span className="line-clamp-1 flex-1">{o.label}</span>
                {o.count != null && (
                  <span className="shrink-0 text-[clamp(12px,1.6vh,19px)] font-semibold text-ink-subtle">
                    {o.count}
                  </span>
                )}
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
            className="h-[clamp(48px,5.6vh,66px)] flex-1 rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
          >
            {t("Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
