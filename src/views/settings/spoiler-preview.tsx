import still1 from "@/assets/preview/blur1.png";
import still2 from "@/assets/preview/blur2.png";
import {
  SPOILER_TEXT_CLASS,
  SPOILER_THUMB_CLASS,
  spoilerMaskFor,
  type SpoilerMask,
} from "@/lib/spoilers";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

export function SpoilerPreview() {
  const { settings } = useSettings();
  const t = useT();
  const mask = spoilerMaskFor(settings, { watched: false, isNextUp: false });
  const active = mask.thumb || mask.title || mask.desc;
  return (
    <div className="mt-1 flex flex-col gap-3 rounded-2xl border border-edge-soft bg-canvas/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          {t("Preview")}
        </span>
        {active && (
          <span className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t("Hover to peek")}
          </span>
        )}
      </div>
      <div className="flex gap-4">
        <PreviewCard
          mask={mask}
          n={7}
          title={t("The Last Stand")}
          rating="8.9"
          runtime={48}
          img={still1}
          imgPos="object-center"
          synopsis={t(
            "With the city surrounded, an unlikely alliance forms as a long-buried secret finally comes to light.",
          )}
        />
        <PreviewCard
          mask={mask}
          n={8}
          title={t("No Way Out")}
          rating="9.1"
          runtime={51}
          img={still2}
          imgPos="object-center"
          synopsis={t(
            "Loyalties shatter as the survivors realize the enemy has been among them all along.",
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
      <div className="relative aspect-video overflow-hidden rounded-xl">
        <div className={`absolute inset-0 ${mask.thumb ? SPOILER_THUMB_CLASS : ""}`}>
          <img
            src={img}
            alt=""
            draggable={false}
            className={`h-full w-full object-cover ${imgPos}`}
          />
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
        <span
          className={`text-[13.5px] font-semibold text-ink ${mask.title ? SPOILER_TEXT_CLASS : ""}`}
        >
          {title}
        </span>
        <span className="text-[11.5px] text-ink-subtle">
          E{n} · {t("{n} min", { n: runtime })}
        </span>
        <p
          className={`mt-0.5 line-clamp-2 min-h-[40px] text-[12px] leading-relaxed text-ink-muted ${
            mask.desc ? SPOILER_TEXT_CLASS : ""
          }`}
        >
          {synopsis}
        </p>
      </div>
    </div>
  );
}
