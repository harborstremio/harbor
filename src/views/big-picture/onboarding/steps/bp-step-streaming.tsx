import { ServiceLogo } from "@/components/service-logo";
import { SERVICES } from "@/lib/providers/streaming";
import { SFX } from "@/lib/sfx";
import { useSettings, type StreamingService } from "@/lib/settings";
import { useBpT } from "../../bp-i18n";
import {
  BP_ROW_FLUSH,
  BpDecisionNote,
  BpDecisionScroll,
} from "../bp-step-parts";

const PER_ROW = 4;
const ROW_SCOPE = { ...BP_ROW_FLUSH, containIntrinsicSize: "auto 120px" } as const;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function BpStepStreaming() {
  const t = useBpT();
  const { settings, toggleStreaming } = useSettings();
  const all = Object.keys(SERVICES) as StreamingService[];
  const on = all.filter((s) => settings.streaming[s]).length;

  return (
    <BpDecisionScroll>
      {chunk(all, PER_ROW).map((row, ri) => (
        <div key={ri} data-bp-row style={ROW_SCOPE}>
          <div data-bp-scroll-x className="flex gap-[clamp(9px,0.9vw,18px)]">
            {row.map((svc) => {
              const enabled = settings.streaming[svc];
              return (
                <button
                  key={svc}
                  type="button"
                  data-bp-focusable
                  data-bp-chip
                  aria-pressed={enabled}
                  aria-label={SERVICES[svc].name}
                  onClick={() => {
                    SFX.click();
                    toggleStreaming(svc);
                  }}
                  className={`relative flex h-[clamp(70px,8.6vh,120px)] min-w-[44px] flex-1 items-center justify-center overflow-hidden rounded-[var(--bp-r-md)] border px-[clamp(9px,0.9vw,18px)] transition-colors duration-[var(--bp-dur-fast)] ${
                    enabled
                      ? "border-[var(--bp-edge-2)] bg-[var(--bp-panel-2)]"
                      : "border-[var(--bp-edge)] bg-[var(--bp-panel)] opacity-45"
                  }`}
                >
                  <ServiceLogo service={svc} height={28} />
                  {!enabled && (
                    <span className="absolute bottom-[6px] end-[8px] rounded-full bg-[var(--bp-void)] px-[clamp(6px,0.55vw,11px)] py-[2px] text-[clamp(9.5px,1.2vh,14px)] font-bold uppercase tracking-[0.12em] text-ink-subtle">
                      {t("Off")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <BpDecisionNote
        text={
          settings.tmdbKey.trim()
            ? t("{n} on", { n: on })
            : t("These rows need a TMDB key before they show anything.")
        }
      />
    </BpDecisionScroll>
  );
}
