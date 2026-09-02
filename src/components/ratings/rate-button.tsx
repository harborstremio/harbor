import { useState } from "react";
import { UiIcon } from "@/components/ui-icon";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { useRating } from "@/lib/ratings/store";
import type { RatingTarget } from "@/lib/ratings/types";
import { RatingModal } from "./rating-modal";

const TONE = {
  scrim: {
    idle: "bg-canvas/80 text-ink hover:bg-canvas/95",
    active: "bg-ink/15 text-ink hover:bg-ink/20",
  },
  lift: {
    idle: "bg-white/[0.06] text-ink hover:bg-white/[0.10]",
    active: "bg-white/[0.12] text-ink hover:bg-white/[0.16]",
  },
};

export function RateButton({
  target,
  tone = "scrim",
}: {
  target: RatingTarget;
  tone?: keyof typeof TONE;
}) {
  const t = useT();
  const existing = useRating(target.itemKey);
  const [open, setOpen] = useState(false);
  const score = existing?.score ?? 0;

  return (
    <>
      <HoverTooltip
        label={score ? t("Your rating {n}/10", { n: score }) : t("Rate this")}
        align="center"
        className="shrink-0"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={score ? t("Your rating {n}/10", { n: score }) : t("Rate this")}
          className={`group flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-200 active:scale-[0.94] ${
            score ? TONE[tone].active : TONE[tone].idle
          }`}
        >
          {score ? (
            <span className="text-[16px] font-bold leading-none tabular-nums">{score}</span>
          ) : (
            <UiIcon name="rate" className="h-5 w-5" />
          )}
        </button>
      </HoverTooltip>
      {open && <RatingModal target={target} onClose={() => setOpen(false)} />}
    </>
  );
}
