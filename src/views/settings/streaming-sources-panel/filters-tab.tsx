import { useId } from "react";
import { useSettings } from "@/lib/settings";
import { tvHover } from "@/lib/keyboard-navigation";
import { Section } from "../shared";
import { AddonTimeoutSetting } from "../addon-timeout-setting";
import { useT } from "@/lib/i18n";

export function FiltersTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <>
      <Section
        title={t("Stream safety filter")}
        subtitle={t("Choose which addon results appear when you pick a stream.")}
      >
        <StreamFilterPicker
          value={settings.streamFilterLevel}
          onChange={(value) => update({ streamFilterLevel: value })}
        />
      </Section>
      <AddonTimeoutSetting />
    </>
  );
}

function StreamFilterPicker({ value, onChange }: {
  value: "strict" | "balanced" | "off";
  onChange: (value: "strict" | "balanced" | "off") => void;
}) {
  const t = useT();
  const name = useId();
  const options = [
    {
      id: "strict",
      label: t("Strict"),
      description: t("Hide suspicious files, mismatched releases, likely camera recordings and trailers. Also check file sizes and season packs."),
    },
    {
      id: "balanced",
      label: t("Balanced"),
      description: t("Keep the suspicious-file and release checks, but allow more results, including larger files and season packs."),
    },
    {
      id: "off",
      label: t("Off"),
      description: t("Show all results returned by addons, including releases that do not match or may be suspicious."),
    },
  ] as const;

  return (
    <div className="hset-source-options" role="radiogroup" aria-label={t("Stream safety filter")}>
      {options.map((option) => (
        <label key={option.id} className="hset-source-option">
          <input
            type="radio"
            name={name}
            value={option.id}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
            onBlur={(event) => {
              if (event.currentTarget.hasAttribute("data-tv-focused")) tvHover(null);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isTrusted && event.key.startsWith("Arrow")) event.stopPropagation();
            }}
            aria-labelledby={name + option.id}
            aria-describedby={name + option.id + "-description"}
          />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex items-baseline gap-3">
              <span id={name + option.id} className="text-[16px] font-semibold leading-6 text-ink">{option.label}</span>
              {option.id === "strict" && <span className="text-[13px] text-ink-muted">{t("Default")}</span>}
            </span>
            <span id={name + option.id + "-description"} className="max-w-[68ch] text-[15px] leading-[22px] text-ink-muted">{option.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
