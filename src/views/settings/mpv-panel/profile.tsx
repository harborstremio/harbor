import { Feather, Gauge, Sparkles, type LucideIcon } from "lucide-react";
import { useSettings, type Settings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

const PROFILES: Array<{
  id: Settings["mpvQuality"];
  label: string;
  who: string;
  sub: string;
  Icon: LucideIcon;
}> = [
  {
    id: "performance",
    label: "Smooth on weak PCs",
    who: "Older laptops · low-end · battery · anything that stutters",
    sub: "Turns off the fancy scaling and effects so video just plays. The lightest on your machine. Pick this if anything ever stutters or your fan screams.",
    Icon: Feather,
  },
  {
    id: "balanced",
    label: "Balanced",
    who: "Most computers · the default",
    sub: "Good-looking video without working your machine hard. Leave it here unless you have a reason to change.",
    Icon: Gauge,
  },
  {
    id: "quality",
    label: "Maximum quality",
    who: "Strong desktops with a dedicated graphics card",
    sub: "Sharper upscaling and smoother gradients in dark scenes, at the cost of more graphics-card load. Skip it on laptops and integrated graphics.",
    Icon: Sparkles,
  },
];

export function QualityProfile() {
  const { settings, update } = useSettings();
  const t = useT();
  const value = settings.mpvQuality ?? "balanced";
  return (
    <div className="flex flex-col gap-1.5">
      {PROFILES.map(({ id, label, who, sub, Icon }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => update({ mpvQuality: id })}
            className={`flex items-start gap-3.5 rounded-md px-4 py-3.5 text-start transition-colors ${
              selected ? "bg-ink text-canvas" : "bg-elevated text-ink hover:bg-raised"
            }`}
          >
            <Icon
              size={18}
              strokeWidth={2}
              className={`mt-[3px] shrink-0 ${selected ? "text-canvas" : "text-ink-muted"}`}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[13.5px] font-semibold leading-snug">{t(label)}</span>
                <span
                  className={`text-[10.5px] font-bold uppercase tracking-[0.14em] leading-snug ${
                    selected ? "text-canvas/60" : "text-ink-subtle"
                  }`}
                >
                  {t(who)}
                </span>
              </span>
              <span
                className={`text-[12.5px] leading-relaxed ${
                  selected ? "text-canvas/75" : "text-ink-subtle"
                }`}
              >
                {t(sub)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
