import { useId } from "react";
import { PickerLayoutPreview } from "./picker-layout-preview";
import { useSettings } from "@/lib/settings";
import { tvHover } from "@/lib/keyboard-navigation";
import { Section, Segmented, ToggleRow } from "../shared";
import { SettingRow } from "../kit";
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
        <div className="grid items-center gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_340px]">
          <PickerLayoutPicker
            value={settings.pickerLayout}
            onChange={(v) => update({ pickerLayout: v })}
          />
          <PickerLayoutPreview layout={settings.pickerLayout} />
        </div>
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

      <Section title={t("Picker details")}>
        <ToggleRow
          label={t("Move Refresh next to Back")}
          sub={t(
            "Groups Refresh beside Back at the start of the picker header. Off keeps it at the far end, across from Back.",
          )}
          value={settings.pickerRefreshNextToBack}
          onChange={(v) => update({ pickerRefreshNextToBack: v })}
        />
        <ToggleRow
          label={t("Show torrent name")}
          sub={t("Show release filenames in the Condensed picker and Big Picture.")}
          value={settings.pickerShowFilename}
          onChange={(v) => update({ pickerShowFilename: v })}
        />
        <ToggleRow
          label={t("Show full descriptions")}
          sub={t("Show complete addon descriptions in the Stremio picker, downloads, and Big Picture.")}
          value={settings.fullStreamDescription}
          onChange={(v) => update({ fullStreamDescription: v })}
        />
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
  const name = useId();
  const options = [
    { id: "condensed", label: t("Condensed") },
    { id: "stremio", label: t("Stremio") },
  ] as const;

  return (
    <div className="hset-source-options" role="radiogroup" aria-label={t("Picker layout")}>
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
          />
          <span id={name + option.id} className="text-[16.5px] font-medium leading-6 text-ink">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
