import { Check, Feather, Gauge, Sparkles, type LucideIcon } from "../icons";
import { useSettings, type Settings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SRow } from "../ui";

const PROFILES: Array<{
  id: Settings["mpvQuality"];
  label: string;
  sub: string;
  Icon: LucideIcon;
}> = [
  {
    id: "performance",
    label: "Smooth on weak PCs",
    sub: "Reduces video processing to help older computers play smoothly and use less power.",
    Icon: Feather,
  },
  {
    id: "balanced",
    label: "Balanced",
    sub: "Good picture quality with moderate graphics use. Recommended for most computers.",
    Icon: Gauge,
  },
  {
    id: "quality",
    label: "Maximum quality",
    sub: "Sharper upscaling and smoother color gradients. Best with a powerful graphics card.",
    Icon: Sparkles,
  },
];

export function QualityProfile() {
  const { settings, update } = useSettings();
  const t = useT();
  const value = settings.mpvQuality ?? "balanced";
  return (
    <>
      {PROFILES.map(({ id, label, sub, Icon }) => {
        const selected = value === id;
        return (
          <SRow
            key={id}
            title={t(label)}
            description={t(sub)}
            selected={selected}
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
