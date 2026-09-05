import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import { useSettingsPreviewArt } from "@/lib/settings-preview-art";
import { PreviewImage } from "../preview-image";

const SHOWS = [
  { title: "Slow Burn", sub: "S2 E4", progress: 62, caughtUp: false },
  { title: "No Way Out", sub: "S1 E9", progress: 28, caughtUp: false },
  { title: "The Last Stand", sub: "S3 E10", progress: 100, caughtUp: true },
];

export function CwEndPreview({ mode }: { mode: "hide" | "timer" }) {
  const t = useT();
  const art = useSettingsPreviewArt();
  const stills = art?.stills ?? [];
  const hiding = mode === "hide";

  return (
    <div className="flex flex-col gap-3 rounded-md border border-edge-soft bg-canvas/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="harbor-settings-label">{t("Live preview")}</span>
        <span className="text-[15.5px] leading-[22px] text-ink-subtle">
          {t("Continue Watching on Home")}
        </span>
      </div>

      <div className="flex gap-3 overflow-hidden">
        {SHOWS.map((s, i) =>
          s.caughtUp && hiding ? (
            <div
              key={s.title}
              className="grid aspect-video w-[168px] shrink-0 place-items-center rounded-md border border-dashed border-edge px-3 text-center"
            >
              <span className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-ink-subtle">{s.title}</span>
                <span className="text-[11px] text-ink-subtle/70">{t("Off the row")}</span>
              </span>
            </div>
          ) : (
          <div
            key={s.title}
            className="relative aspect-video w-[168px] shrink-0 overflow-hidden rounded-md bg-elevated ring-1 ring-edge-soft/60"
          >
            {stills[i] ? (
              <PreviewImage
                src={stills[i]}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-elevated to-canvas" />
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-canvas/80 to-transparent" />
            <span className="absolute bottom-2 start-2 flex max-w-[calc(100%-16px)] items-center gap-1.5 rounded-md bg-canvas/95 px-2 py-1 text-[11px]">
              <Play size={11} className="shrink-0 text-ink" />
              <span className="shrink-0 font-medium text-ink">{s.sub}</span>
              {s.caughtUp ? (
                <span className="shrink-0 font-medium text-amber-500">{t("in 4d 6h")}</span>
              ) : (
                <>
                  <span className="shrink-0 text-ink-subtle">·</span>
                  <span className="shrink-0 text-ink-muted">
                    {t("{n}m left", { n: Math.round((100 - s.progress) * 0.48) })}
                  </span>
                </>
              )}
            </span>
            <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
              <span className="block h-full bg-accent" style={{ width: `${s.progress}%` }} />
            </span>
          </div>
          ),
        )}
      </div>

      <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
        {mode === "hide"
          ? t("The Last Stand has aired its last episode, so it drops off the row and comes back when a new one lands.")
          : t("The Last Stand stays on the row with an amber countdown to the next episode.")}
      </p>
    </div>
  );
}
