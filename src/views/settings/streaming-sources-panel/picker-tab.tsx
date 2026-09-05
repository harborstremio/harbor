import { Check } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { Section, Segmented, ToggleRow } from "../shared";
import { SettingRow } from "../kit";
import { SRow } from "../ui";
import {
  PickerLayoutPreview,
  StreamDescriptionPreview,
  TorrentNamePreview,
} from "../picker-previews";
import { useT } from "@/lib/i18n";
import type { StreamMode } from "@/lib/streams/mode";

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

      <Section title={t("Source mode")}>
        <SettingRow
          wide
          label={t("Prefer these sources")}
          desc={t(
            "Both shows direct, debrid, and peer-to-peer results together. Direct/debrid keeps torrents out of the way unless nothing else is available. P2P puts torrents first.",
          )}
        >
          <Segmented<StreamMode>
            value={settings.streamMode}
            onChange={(mode) => update({ streamMode: mode })}
            options={[
              { value: "both", label: "Both" },
              { value: "addons", label: "Direct/debrid" },
              { value: "p2p", label: "P2P" },
            ]}
          />
        </SettingRow>
      </Section>

      <Section title={t("Refresh button")}>
        <ToggleRow
          label={t("Move Refresh next to Back")}
          sub={t(
            "Groups Refresh beside Back at the start of the picker header. Off keeps it at the far end, across from Back.",
          )}
          value={settings.pickerRefreshNextToBack}
          onChange={(v) => update({ pickerRefreshNextToBack: v })}
        />
      </Section>

      <Section title={t("Torrent name")}>
        <ToggleRow
          label={t("Show torrent name")}
          sub={t(
            "Displays the raw release filename under each source in the condensed picker. Off keeps rows compact. The Stremio layout always shows it.",
          )}
          value={settings.pickerShowFilename}
          onChange={(v) => update({ pickerShowFilename: v })}
        />
        <TorrentNamePreview on={settings.pickerShowFilename} />
      </Section>

      <Section title={t("Stream descriptions")}>
        <ToggleRow
          label={t("Show full descriptions")}
          sub={t(
            "Shows everything the addon sends in the Stremio picker layout instead of trimming it to a few lines. That matters for AIOStreams and other custom formats. Off gives shorter, tidier rows.",
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
