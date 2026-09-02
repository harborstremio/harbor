import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "../shared";

const NEXT_EP_LEADS = [
  { value: "auto", label: "Auto", sec: -1 },
  { value: "off", label: "Off", sec: 0 },
  { value: "30", label: "30s", sec: 30 },
  { value: "45", label: "45s", sec: 45 },
  { value: "60", label: "1 min", sec: 60 },
  { value: "90", label: "1.5 min", sec: 90 },
  { value: "120", label: "2 min", sec: 120 },
] as const;

function nextEpLeadKey(sec: number): string {
  return NEXT_EP_LEADS.find((o) => o.sec === sec)?.value ?? "auto";
}

export function UpNextTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <Section
      title={t("Next episode prompt")}
      subtitle={t("When the Up Next pill appears before an episode ends. Auto scales to the episode length, so short episodes stop prompting so early. Off hides it.")}
    >
      <Segmented
        value={nextEpLeadKey(settings.nextEpisodeLeadSec)}
        options={NEXT_EP_LEADS.map((o) => ({ value: o.value, label: o.label }))}
        onChange={(v) =>
          update({ nextEpisodeLeadSec: NEXT_EP_LEADS.find((o) => o.value === v)?.sec ?? -1 })
        }
      />
      <ToggleRow
        label={t("Auto-play next episode")}
        sub={t("When an episode ends, automatically start the next one. Off lets the episode finish and stop.")}
        value={settings.autoPlayNextEpisode}
        onChange={(v) => update({ autoPlayNextEpisode: v })}
      />
      {settings.autoPlayNextEpisode && (
        <ToggleRow
          label={t("Ask if you're still watching")}
          sub={t("After several episodes auto-play in a row with no input, pause and check you're still there before continuing. Off by default.")}
          value={settings.stillWatching}
          onChange={(v) => update({ stillWatching: v })}
        />
      )}
      {settings.autoPlayNextEpisode && settings.stillWatching && (
        <Segmented
          value={String(settings.stillWatchingAfter)}
          options={[
            { value: "2", label: t("After 2") },
            { value: "3", label: t("After 3") },
            { value: "4", label: t("After 4") },
            { value: "5", label: t("After 5") },
          ]}
          onChange={(v) => update({ stillWatchingAfter: Number(v) })}
        />
      )}
      <ToggleRow
        label={t("Queue drives Next/Previous")}
        sub={t("After the current show's episodes, Next flows into your queue. Off keeps Next/Previous within the current show only.")}
        value={settings.queueDrivesNav}
        onChange={(v) => update({ queueDrivesNav: v })}
      />
    </Section>
  );
}
