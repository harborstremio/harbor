import { useSettings } from "@/lib/settings";
import { Section } from "../shared";
import { StreamPriorityCard } from "../stream-priority-card";
import { ChoiceBlock } from "../player-panel/choice";
import { useT } from "@/lib/i18n";

export function SortingTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <Section
      title={t("Result order")}
      subtitle={t("Harbor ranking puts the best-scoring sources first. Addon order keeps each addon's results in the order it returned them, like the Stremio and Vidi apps. Stream priority below decides which addon leads, in both modes.")}
    >
      <StreamSortPicker
        value={settings.streamSort}
        onChange={(v) => update({ streamSort: v })}
      />
      <StreamPriorityCard />
      <p className="rounded-md bg-elevated px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted">
        {t("Using AIOStreams or another aggregator addon? Its own sorting and filtering happen inside the addon before Harbor ever sees the results, then Harbor applies the stream filter and result order above on top. If results look thinner than expected, keep one side permissive: either relax the addon's internal filters or set Harbor's stream filter to Balanced or Off.")}
      </p>
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
      sub: t("Show each addon's results in the order it returned them, grouped by your addon list. Matches the Stremio and Vidi apps."),
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
