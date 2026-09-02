import { useSettings } from "@/lib/settings";
import { Section, ToggleRow } from "../shared";
import {
  PickerLayoutPreview,
  StreamDescriptionPreview,
  TorrentNamePreview,
} from "../picker-previews";
import { ChoiceBlock } from "../player-panel/choice";
import { useT } from "@/lib/i18n";
import { StreamModeToggle } from "@/components/stream-mode-toggle";

export function PickerTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <>
      <Section
        title={t("Picker layout")}
        subtitle={t(
          "Condensed shows a top pick, quality tiles, and a drawer. Stremio is a flat list grouped by addon, no scoring.",
        )}
      >
        <PickerLayoutPicker
          value={settings.pickerLayout}
          onChange={(v) => update({ pickerLayout: v })}
        />
        <PickerLayoutPreview value={settings.pickerLayout} />
      </Section>

      <Section
        title={t("Source mode")}
        subtitle={t(
          "Choose whether Harbor prefers direct and debrid sources, peer-to-peer torrents, or shows both.",
        )}
      >
        <StreamModeToggle
          mode={settings.streamMode}
          onChange={(mode) => update({ streamMode: mode })}
        />
      </Section>

      <Section
        title={t("Refresh button")}
        subtitle={t(
          "Where the Refresh button sits in the picker header. Default keeps it on the right, across from Back.",
        )}
      >
        <ToggleRow
          label={t("Move Refresh next to Back")}
          sub={t("Group Refresh on the left beside Back instead of the far right of the header.")}
          value={settings.pickerRefreshNextToBack}
          onChange={(v) => update({ pickerRefreshNextToBack: v })}
        />
      </Section>

      <Section
        title={t("Torrent name")}
        subtitle={t(
          "Show each source's full release filename on the condensed layout. The Stremio layout already shows it.",
        )}
      >
        <ToggleRow
          label={t("Show torrent name")}
          sub={t(
            "Display the raw release filename under each source in the condensed picker. Off keeps rows compact.",
          )}
          value={settings.pickerShowFilename}
          onChange={(v) => update({ pickerShowFilename: v })}
        />
        <TorrentNamePreview on={settings.pickerShowFilename} />
      </Section>

      <Section
        title={t("Stream descriptions")}
        subtitle={t(
          "How much of each source's description the Stremio picker layout shows. Full keeps everything the addon sends, which matters for AIOStreams and other custom formats.",
        )}
      >
        <ToggleRow
          label={t("Show full descriptions")}
          sub={t(
            "Show the addon's complete description instead of trimming it to a few lines. Turn off for shorter, tidier rows.",
          )}
          value={settings.fullStreamDescription}
          onChange={(v) => update({ fullStreamDescription: v })}
        />
        <StreamDescriptionPreview full={settings.fullStreamDescription} />
      </Section>
    </>
  );
}

function PickerLayoutPicker({
  value,
  onChange,
}: {
  value: "condensed" | "stremio";
  onChange: (v: "condensed" | "stremio") => void;
}) {
  const t = useT();
  const options: Array<{ id: "condensed" | "stremio"; label: string; sub: string }> = [
    {
      id: "condensed",
      label: t("Condensed"),
      sub: t(
        "Default. Top pick at the top, quality tiles, and an All-Sources drawer. Harbor scores and ranks results.",
      ),
    },
    {
      id: "stremio",
      label: "Stremio",
      sub: t(
        "Flat list of sources grouped by addon, with a filter dropdown. No re-ranking. Closest match to the Stremio app's stream picker.",
      ),
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
