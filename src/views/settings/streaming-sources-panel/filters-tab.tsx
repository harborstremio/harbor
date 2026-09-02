import { useSettings } from "@/lib/settings";
import { Section } from "../shared";
import { AddonTimeoutSetting } from "../addon-timeout-setting";
import { StreamFilterPreview } from "../stream-filter-preview";
import { ChoiceBlock } from "../player-panel/choice";
import { useT } from "@/lib/i18n";

export function FiltersTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <>
      <Section
        title={t("Stream safety filter")}
        subtitle={t("How aggressively Harbor rejects shady or mismatched streams before showing them in the picker.")}
      >
        <StreamFilterPicker
          value={settings.streamFilterLevel}
          onChange={(v) => update({ streamFilterLevel: v })}
        />
        <StreamFilterPreview level={settings.streamFilterLevel} />
      </Section>

      <AddonTimeoutSetting />
    </>
  );
}

function StreamFilterPicker({
  value,
  onChange,
}: {
  value: "strict" | "balanced" | "off";
  onChange: (v: "strict" | "balanced" | "off") => void;
}) {
  const t = useT();
  const options: Array<{ id: "strict" | "balanced" | "off"; label: string; sub: string }> = [
    {
      id: "strict",
      label: t("Strict"),
      sub: t("Default. Rejects size outliers, suspicious extensions, year/episode mismatches, season packs (for episode requests), trailers, and likely cams."),
    },
    {
      id: "balanced",
      label: t("Balanced"),
      sub: t("Keeps the malware/year/episode-mismatch checks but allows season packs and oversized files. Same as hitting Search wider in the picker."),
    },
    {
      id: "off",
      label: t("Off"),
      sub: t("No filtering. Every stream every addon returns shows up, including obvious junk. You'll be on your own."),
    },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => (
        <ChoiceBlock
          key={opt.id}
          selected={value === opt.id}
          onClick={() => onChange(opt.id)}
          label={opt.label}
          sub={opt.sub}
        />
      ))}
    </div>
  );
}
