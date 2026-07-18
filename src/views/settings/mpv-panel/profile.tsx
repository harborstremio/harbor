import { useSettings, type Settings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

const PROFILES: Array<{ id: Settings["mpvQuality"]; label: string; who: string; sub: string }> = [
  {
    id: "performance",
    label: "Smooth on weak PCs",
    who: "Older laptops · low-end · battery · anything that stutters",
    sub: "Turns off the fancy scaling and effects so video just plays. The lightest on your machine. Pick this if anything ever stutters or your fan screams.",
  },
  {
    id: "balanced",
    label: "Balanced",
    who: "Most computers · the default",
    sub: "Good-looking video without working your machine hard. Leave it here unless you have a reason to change.",
  },
  {
    id: "quality",
    label: "Maximum quality",
    who: "Strong desktops with a dedicated graphics card",
    sub: "Sharper upscaling and smoother gradients in dark scenes, at the cost of more graphics-card load. Skip it on laptops and integrated graphics.",
  },
];

export function QualityProfile() {
  const { settings, update } = useSettings();
  const t = useT();
  const value = settings.mpvQuality ?? "balanced";
  return (
    <div className="flex flex-col gap-2.5">
      {PROFILES.map((p) => {
        const selected = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => update({ mpvQuality: p.id })}
            className={`flex items-start gap-3.5 rounded-2xl border px-5 py-4 text-start transition-colors ${
              selected
                ? "border-ink bg-elevated"
                : "border-edge-soft bg-canvas/40 hover:border-edge hover:bg-canvas/60"
            }`}
          >
            <span
              className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                selected ? "border-ink" : "border-edge"
              }`}
            >
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[15px] font-semibold text-ink">{t(p.label)}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent/90">
                {t(p.who)}
              </span>
              <span className="text-[12.5px] leading-snug text-ink-muted">{t(p.sub)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
