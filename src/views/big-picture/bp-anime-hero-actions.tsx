import { RotateCcw } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { pushBigPicture } from "@/lib/big-picture";
import type { Meta } from "@/lib/cinemeta";
import { SFX } from "@/lib/sfx";
import { BP_ACTION_RING } from "./bp-action-style";
import type { BpPagePhase } from "./bp-catalog-page";
import { forceBpMeta, lockBpMeta, unlockBpMeta } from "./bp-focus-meta";
import { useBpT } from "./bp-i18n";
import { requestBpPlay } from "./bp-play-request";

const PRIMARY_BOX = { height: "var(--bp-action-h)", borderRadius: "var(--bp-r-xs)" };
const SECONDARY_BOX = { height: "var(--bp-action-box)", borderRadius: "var(--bp-r-xs)" };

const SHAPE =
  "relative flex shrink-0 items-center justify-center gap-[calc(7px*var(--bp-up,1))] border px-[calc(17px*var(--bp-up,1))] text-[calc(13.4px*var(--bp-up,1))] font-semibold tracking-[0.01em]";

const REST_FILL = "border-transparent bg-[var(--bp-on)] text-ink";

const REST_HAIRLINE = "border-[var(--bp-edge-2)] text-ink";

const ICON = "h-[calc(12px*var(--bp-up,1))] w-[calc(12px*var(--bp-up,1))]";

export function BpAnimeHeroActions({
  phase,
  subject,
  lead,
  resume,
  onSelect,
}: {
  phase: BpPagePhase;
  subject: Meta | null;
  lead: Meta | null;
  resume: boolean;
  onSelect: (m: Meta) => void;
}) {
  const t = useBpT();
  const play = resume ? t("Resume") : t("Start Watching");
  const grown = phase === "hero";

  return (
    <div data-bp-row style={{ contentVisibility: "visible" }} className="mt-[14px]">
      <div
        data-bp-scroll-x
        className="flex items-center gap-[8px] overflow-x-auto py-[12px] ps-[12px] pe-[12px] -my-[12px] -ms-[12px] -me-[12px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          data-bp-focusable
          data-bp-autofocus="true"
          data-bp-restore-key="anime-hero-play"
          aria-label={subject ? t("Play {title}", { title: subject.name }) : play}
          onFocus={() => lockBpMeta(lead)}
          onBlur={() => unlockBpMeta()}
          onClick={() => {
            if (!subject) return;
            SFX.click();
            const metaId = `${subject.type}:${subject.id}`;
            forceBpMeta(subject);
            requestBpPlay(metaId, null);
            pushBigPicture({ kind: "detail", metaId });
          }}
          style={PRIMARY_BOX}
          className={`${SHAPE} ${grown ? REST_HAIRLINE : REST_FILL} ${BP_ACTION_RING}`}
        >
          {resume ? (
            <RotateCcw size={12} strokeWidth={2.8} className={ICON} />
          ) : (
            <Play size={12} strokeWidth={0} className={`fill-current ${ICON}`} />
          )}
          {play}
        </button>

        {grown && (
          <button
            type="button"
            data-bp-focusable
            data-bp-restore-key="anime-hero-info"
            onFocus={() => lockBpMeta(lead)}
            onBlur={() => unlockBpMeta()}
            onClick={() => {
              if (!subject) return;
              SFX.click();
              onSelect(subject);
            }}
            style={SECONDARY_BOX}
            className={`${SHAPE} ${REST_HAIRLINE} ${BP_ACTION_RING}`}
          >
            {t("More Info")}
          </button>
        )}
      </div>
    </div>
  );
}
