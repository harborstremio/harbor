import { fillStyle } from "@/components/slider";
import { ArrowUpDown, Languages, Type } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ALL_LANGUAGE_NAMES } from "@/lib/subtitles/language";
import { Section, Segmented } from "../shared";
import { SettingRow, Nested } from "../kit";

function DualPreview({ placement, scale }: { placement: "top" | "bottom"; scale: number }) {
  const t = useT();
  const secondSize = `${Math.max(8, Math.round(13 * scale))}px`;
  const second = (
    <span className="max-w-full truncate text-ink-muted" style={{ fontSize: secondSize }}>
      {t("Second line")}
    </span>
  );
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-md bg-canvas">
      {placement === "top" && (
        <span className="absolute inset-x-0 top-3 flex justify-center px-3">{second}</span>
      )}
      <span className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-1 px-3">
        {placement === "bottom" && second}
        <span className="max-w-full truncate text-[13px] font-medium text-ink">
          {t("Main subtitle line")}
        </span>
      </span>
    </div>
  );
}

export function DualSubtitleSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const on = settings.secondarySubLang.trim().length > 0;
  const places: ReadonlyArray<{ value: "top" | "bottom"; label: string }> = [
    { value: "top", label: t("Top of the screen") },
    { value: "bottom", label: t("Above the main line") },
  ];

  return (
    <Section
      title={t("Dual subtitles")}
      subtitle={t("Show a second subtitle in another language at the same time. Handy when you are learning a language: keep the one you are learning as your main subtitle, and put your own language here.")}
    >
      <SettingRow
        icon={<Languages size={16} strokeWidth={2} />}
        label={t("Second subtitle language")}
        desc={t("Shown at the same time as your main subtitle.")}
        tip={t("Harbor loads it automatically when a track in that language exists. You can also set or clear the second track for one video from the subtitle menu in the player.")}
      >
        <Dropdown
          value={settings.secondarySubLang}
          onChange={(v) => update({ secondarySubLang: v })}
          options={[
            { value: "", label: t("Off") },
            ...ALL_LANGUAGE_NAMES.map((name) => ({ value: name, label: name })),
          ]}
          className="w-full max-w-[240px]"
        />
      </SettingRow>

      {on && (
        <Nested>
          <SettingRow
            wide
            icon={<ArrowUpDown size={16} strokeWidth={2} />}
            label={t("Where it shows")}
            desc={t("Which line sits where while both are on screen.")}
          >
            <div className="flex w-full flex-col gap-3">
              <DualPreview
                placement={settings.subSecondaryPlacement}
                scale={settings.subSecondaryScale}
              />
              <Segmented
                value={settings.subSecondaryPlacement}
                options={places}
                onChange={(v) => update({ subSecondaryPlacement: v })}
              />
            </div>
          </SettingRow>

          <SettingRow
            icon={<Type size={16} strokeWidth={2} />}
            label={t("Second line size")}
            desc={t("Relative to your main subtitle size.")}
          >
            <span className="flex shrink-0 items-center gap-3">
              <input
                type="range"
                min={0.4}
                max={1.4}
                step={0.05}
                value={settings.subSecondaryScale}
                aria-label={t("Second line size")}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) {
                    update({ subSecondaryScale: Math.max(0.4, Math.min(1.4, v)) });
                  }
                }}
                className="harbor-slider w-[150px]"
        style={fillStyle(settings.subSecondaryScale, 0.4, 1.4)}
      />
              <span className="w-[42px] text-end font-mono text-[12.5px] tabular-nums text-ink-muted">
                {`${Math.round(settings.subSecondaryScale * 100)}%`}
              </span>
            </span>
          </SettingRow>
        </Nested>
      )}
    </Section>
  );
}
