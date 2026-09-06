import { Check, Info } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { Section } from "../shared";
import { AnimeIdPriorityCard } from "../anime-id-priority-card";
import { SettingRow } from "../kit";
import { SRow } from "../ui";
import { StreamPriorityCard } from "../stream-priority-card";
import { useT } from "@/lib/i18n";

export function SortingTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <Section
      title={t("Result order")}
      subtitle={t(
        "Harbor ranking puts the best-scoring sources first. Addon order keeps each addon's results in the order it returned them, like the Stremio and Vidi apps. Stream priority below decides which addon leads, in both modes.",
      )}
    >
      <StreamSortPicker value={settings.streamSort} onChange={(v) => update({ streamSort: v })} />
      <StreamPriorityCard />
      <AnimeIdPriorityCard />
      <SettingRow
        icon={<Info size={18} strokeWidth={2.2} className="text-ink-subtle" />}
        label={t("Aggregator addons")}
        desc={t(
          "Using AIOStreams or another aggregator addon? Its own sorting and filtering happen inside the addon before Harbor ever sees the results, then Harbor applies the stream filter and result order above on top. If results look thinner than expected, keep one side permissive: either relax the addon's internal filters or set Harbor's stream filter to Balanced or Off.",
        )}
      />
    </Section>
  );
}

function StreamSortPicker({
  value,
  onChange,
}: {
  value: "harbor" | "addon";
  onChange: (v: "harbor" | "addon") => void;
}) {
  const t = useT();
  const options: Array<{ id: "harbor" | "addon"; label: string; sub: string }> = [
    {
      id: "harbor",
      label: t("Harbor ranking"),
      sub: t("Default. Harbor parses and scores every source and surfaces the best quality first."),
    },
    {
      id: "addon",
      label: t("Addon order"),
      sub: t(
        "Show each addon's results in the order it returned them, grouped by your addon list. Matches the Stremio and Vidi apps.",
      ),
    },
  ];
  return (
    <>
      {options.map((opt) => (
        <SRow
          key={opt.id}
          onClick={() => onChange(opt.id)}
          title={opt.label}
          description={opt.sub}
          trailing={
            <span className="grid h-11 w-11 place-items-center">
              {value === opt.id && <Check size={20} strokeWidth={2.4} className="text-accent" />}
            </span>
          }
        />
      ))}
    </>
  );
}
