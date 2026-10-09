import { SFX } from "@/lib/sfx";
import { BP_ACTION_RING, BP_ACTION_SOLID } from "../bp-action-style";
import { useBpT } from "../bp-i18n";
import type { BpSportsMode } from "./bp-sports-types";

const ACTION =
  "h-[clamp(52px,6vh,68px)] shrink-0 border px-[clamp(22px,2vw,40px)] text-[calc(clamp(15px,2vh,22px)*var(--bp-up,1))]";

const QUIET =
  "rounded-[var(--bp-r-xs)] border-[var(--bp-edge-2)] bg-[var(--bp-glass)] font-semibold text-ink";

export function BpSportsEmpty({
  busy,
  personalized,
  autofocus,
  onExplore,
  onPersonalize,
  mode = "for-you",
  onToday,
}: {
  busy: boolean;
  personalized: boolean;
  autofocus?: boolean;
  onExplore: () => void;
  onPersonalize: () => void;
  mode?: BpSportsMode;
  onToday?: () => void;
}) {
  const t = useBpT();
  const pitch = !busy && !personalized;
  const title = busy
    ? mode === "live"
      ? t("Checking live scores…")
      : t("Your sports are on their way")
    : pitch
      ? t("Less searching. More of your sport.")
      : mode === "live"
        ? t("No live matches right now")
        : mode === "schedule"
          ? t("No events on this day")
          : mode === "hot"
            ? t("No highlights right now")
            : t("No events available for this selection");
  const body = busy
    ? mode === "live"
      ? t("Live scores refresh automatically.")
      : t("Browse sports or set up your favorites while schedules arrive.")
    : pitch
      ? t("Pick your sports, leagues and teams. We will bring them to the front.")
      : mode === "live"
        ? t("Live scores refresh automatically.")
        : mode === "schedule"
          ? t("Pick another day.")
          : mode === "hot"
            ? t("Browse sports or set up your favorites while schedules arrive.")
            : t(
                "Try another sport or date. Saved schedules will appear here when a feed is unavailable.",
              );
  return (
    <section
      data-bp-row
      data-bp-row-key="sports-empty"
      aria-label={t("Sports")}
      className="relative flex flex-col items-start pt-[clamp(10px,1.6vh,26px)]"
    >
      <div
        data-sports-empty-inset
        className="flex w-full flex-col items-start gap-[clamp(6px,0.9vh,14px)] px-[var(--bp-gutter)]"
      >
        <h2 className="font-display text-[calc(clamp(26px,3.6vh,40px)*var(--bp-up,1))] font-semibold leading-[1.1] tracking-[-0.015em] text-ink">
          {title}
        </h2>
        <p className="max-w-[min(46vw,52ch)] text-[calc(clamp(13px,1.8vh,21px)*var(--bp-up,1))] leading-snug text-ink-muted">
          {body}
        </p>
        <div
          data-bp-scroll-x
          className="mt-[clamp(4px,0.7vh,12px)] flex items-center gap-[clamp(10px,1vw,20px)] overflow-x-auto py-[22px] -my-[22px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {mode === "schedule" && onToday && (
            <button
              type="button"
              data-bp-focusable
              data-bp-restore-key="sports-empty:today"
              onClick={() => {
                SFX.click();
                onToday();
              }}
              className={`${ACTION} border-transparent ${BP_ACTION_SOLID} ${BP_ACTION_RING}`}
            >
              {t("Today")}
            </button>
          )}
          <button
            type="button"
            data-bp-focusable
            data-bp-autofocus={autofocus && pitch ? "true" : undefined}
            data-bp-restore-key="sports-empty:personalize"
            onClick={() => {
              SFX.click();
              onPersonalize();
            }}
            className={`${ACTION} ${pitch ? `border-transparent ${BP_ACTION_SOLID}` : `order-2 ${QUIET}`} ${BP_ACTION_RING}`}
          >
            {t("Make it yours")}
          </button>
          <button
            type="button"
            data-bp-focusable
            data-bp-autofocus={autofocus && !pitch ? "true" : undefined}
            data-bp-restore-key="sports-empty:explore"
            onClick={() => {
              SFX.click();
              onExplore();
            }}
            className={`${ACTION} ${pitch ? QUIET : `order-1 border-transparent ${BP_ACTION_SOLID}`} ${BP_ACTION_RING}`}
          >
            {t("Explore sports")}
          </button>
        </div>
      </div>
    </section>
  );
}
