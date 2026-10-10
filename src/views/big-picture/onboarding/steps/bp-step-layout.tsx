import { SFX } from "@/lib/sfx";
import { useSettings } from "@/lib/settings";
import { useBpT } from "../../bp-i18n";
import { BpLayoutPreview } from "../bp-layout-preview";
import { advanceBpOnboardRing } from "../bp-onboard-ring";
import {
  BP_ROW_FLUSH,
  BpDecisionScroll,
} from "../bp-step-parts";

type Mode = "harbor" | "classic";

const MODES: Mode[] = ["harbor", "classic"];
const ROW_SCOPE = { ...BP_ROW_FLUSH, containIntrinsicSize: "auto 300px" } as const;

/**
 * The current choice leads in DOM order because the frame parks the ring on the
 * first focusable and pressing OK applies instantly. Visual order is restored
 * with flex `order`; arrows are geometric so they are unaffected.
 */
export function BpStepLayout() {
  const t = useBpT();
  const { settings, update } = useSettings();
  const mode = settings.homeMode;
  const at = MODES.indexOf(mode);
  const ordered = at > 0 ? [MODES[at], ...MODES.filter((_, i) => i !== at)] : MODES;

  const copy: Record<Mode, { label: string; sub: string }> = {
    harbor: {
      label: t("Harbor"),
      sub: t("A hero up top, then Top 10, Trending, In Theaters and your service rows."),
    },
    classic: {
      label: t("Classic"),
      sub: t("Continue Watching first, then your addon catalogs in install order."),
    },
  };

  return (
    <BpDecisionScroll>
      <BpLayoutPreview mode={mode} />
      <div data-bp-row style={ROW_SCOPE}>
        <div data-bp-scroll-x className="flex gap-[clamp(12px,1.3vw,26px)]">
          {ordered.map((id) => {
            const selected = mode === id;
            return (
              <button
                key={id}
                type="button"
                data-bp-focusable
                data-bp-chip
                aria-pressed={selected}
                style={{ order: MODES.indexOf(id) }}
                onClick={() => {
                  SFX.click();
                  update({ homeMode: id });
                  // Unconditional. Guarding this on id !== mode makes OK on the
                  // already-selected card do nothing at all, which reads as a
                  // dead button on the one screen with two cells and no skip.
                  advanceBpOnboardRing();
                }}
                className={`flex min-w-0 flex-1 flex-col gap-[clamp(10px,1.3vh,18px)] rounded-[var(--bp-r-md)] border p-[clamp(14px,1.4vw,28px)] text-start transition-colors duration-[var(--bp-dur-fast)] ${
                  selected
                    ? "border-transparent bg-[var(--bp-glass)]"
                    : "border-[var(--bp-edge)] bg-[var(--bp-panel)]"
                }`}
              >
                <Sketch mode={id} />
                <span className="flex flex-col gap-[clamp(2px,0.35vh,6px)]">
                  <span className="text-[clamp(15px,2.2vh,27px)] font-semibold text-ink">
                    {copy[id].label}
                  </span>
                  <span className="text-[clamp(12px,1.65vh,19px)] leading-relaxed text-ink-subtle">
                    {copy[id].sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </BpDecisionScroll>
  );
}

/**
 * A drawn abstraction, not a screenshot. The desktop step ships two PNGs sized
 * for a 200px card, which on a 4K panel is a blurred rectangle.
 */
function Sketch({ mode }: { mode: Mode }) {
  const bar = "rounded-[3px] bg-[var(--bp-panel-2)]";
  return (
    <span
      aria-hidden
      className="flex h-[clamp(90px,14vh,180px)] w-full flex-col gap-[clamp(4px,0.6vh,9px)] overflow-hidden rounded-[var(--bp-r-sm)] bg-[var(--bp-void)] p-[clamp(7px,0.8vw,14px)]"
    >
      {mode === "harbor" ? (
        <>
          <span
            className="h-[44%] w-full rounded-[4px]"
            style={{
              background:
                "var(--bp-on)",
            }}
          />
          <Cells count={7} className="h-[26%]" bar={bar} />
          <Cells count={7} className="h-[26%]" bar={bar} />
        </>
      ) : (
        <>
          <span className={`h-[8%] w-[34%] ${bar}`} />
          <Cells count={4} className="h-[36%]" bar={bar} />
          <span className={`h-[8%] w-[26%] ${bar}`} />
          <Cells count={7} className="h-[36%]" bar={bar} />
        </>
      )}
    </span>
  );
}

function Cells({ count, className, bar }: { count: number; className: string; bar: string }) {
  return (
    <span className={`flex w-full gap-[clamp(3px,0.4vw,7px)] ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`h-full flex-1 ${bar}`} />
      ))}
    </span>
  );
}
