import { Check, Feather, Gauge, Sparkles, type LucideIcon } from "lucide-react";
import { useSettings, type Settings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SRow } from "../ui";

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
    <>
      {PROFILES.map(({ id, label, who, sub, Icon }) => {
        const selected = value === id;
        return (
          <SRow
            key={id}
            title={t(label)}
            description={
              <span className="flex flex-col gap-1">
                <span className="block">{t(sub)}</span>
                <span className="block text-ink-subtle">{t(who)}</span>
              </span>
            }
            leading={<Icon size={18} strokeWidth={2} />}
            trailing={
              <span className="grid h-11 w-6 shrink-0 place-items-center">
                {selected && <Check size={18} strokeWidth={2.6} className="text-accent" />}
              </span>
            }
            onClick={() => update({ mpvQuality: id })}
          />
        );
      })}
    </>
  );
}
