import still1 from "@/assets/settings-preview/steamboat-river.webp";
import still2 from "@/assets/settings-preview/steamboat-deck.webp";
import {
  SPOILER_TEXT_CLASS,
  SPOILER_THUMB_CLASS,
  spoilerMaskFor,
  type SpoilerMask,
} from "@/lib/spoilers";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { PreviewImage } from "./preview-image";

export function SpoilerPreview() {
  const { settings } = useSettings();
  const t = useT();
  const mask = spoilerMaskFor(settings, { watched: false, isNextUp: false });
  const active = mask.thumb || mask.title || mask.desc;
  return (
    <div className="flex flex-col gap-4 rounded-[12px] bg-elevated p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="harbor-settings-label">
          {t("Unwatched episodes")}
        </span>
        {active && (
          <span className="flex items-center gap-2 text-[15.5px] leading-[22px] text-ink-subtle">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t("Hover to peek")}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <PreviewCard
          mask={mask}
          n={7}
          title={t("Down the river")}
          rating="8.9"
          runtime={48}
          img={still1}
          imgPos="object-center"
          synopsis={t(
            "A small steamboat makes its way down the river.",
          )}
        />
        <PreviewCard
          mask={mask}
          n={8}
          title={t("All hands on deck")}
          rating="9.1"
          runtime={51}
          img={still2}
          imgPos="object-center"
          synopsis={t(
            "The captain interrupts a quiet morning at the wheel.",
          )}
        />
      </div>
    </div>
  );
}

function PreviewCard({
  mask,
  n,
  title,
  rating,
  runtime,
  img,
  imgPos,
  synopsis,
}: {
  mask: SpoilerMask;
  n: number;
  title: string;
  rating: string;
  runtime: number;
  img: string;
  imgPos: string;
  synopsis: string;
}) {
  const t = useT();
  return (
    <div className="group min-w-0 flex-1 cursor-default select-none">
      <div className="relative aspect-video overflow-hidden rounded-md">
        <div className={`absolute inset-0 ${mask.thumb ? SPOILER_THUMB_CLASS : ""}`}>
          <PreviewImage src={img} className={`h-full w-full object-cover ${imgPos}`} />
        </div>
        <span className="absolute start-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
          {n}
        </span>
        <div className="absolute bottom-2 start-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 backdrop-blur-sm">
          <span className="text-[10.5px] font-bold tabular-nums text-amber-300">{rating}</span>
        </div>
        <span className="absolute bottom-2 end-2 rounded-md bg-canvas/85 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-muted">
          {t("{n}m", { n: runtime })}
        </span>
      </div>
      <div className="mt-2.5 flex flex-col gap-0.5 px-0.5">
        <span className={`text-[15px] font-semibold text-ink ${mask.title ? SPOILER_TEXT_CLASS : ""}`}>
          {title}
        </span>
        <span className="text-[13px] text-ink-subtle">
          E{n} · {t("{n} min", { n: runtime })}
        </span>
        <p
          className={`mt-0.5 line-clamp-2 text-[14px] leading-[20px] text-ink-muted ${
            mask.desc ? SPOILER_TEXT_CLASS : ""
          }`}
        >
          {synopsis}
        </p>
      </div>
    </div>
  );
}
