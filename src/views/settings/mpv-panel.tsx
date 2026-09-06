import { Info } from "./icons";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ROW_DESC, Section, Segmented, ToggleRow } from "./shared";
import { SettingRow } from "./kit";
import { isTauri } from "./player-panel/internals";
import { QualityProfile } from "./mpv-panel/profile";
import { BufferSizeSection } from "./mpv-panel/buffer";
import { PictureDialsSection, ColorHdrSection } from "./mpv-panel/dials";
import { AdvancedMpvSection } from "./mpv-panel/advanced";
import { useSubTabs } from "./sub-tabs";

type Tab = "quality" | "picture" | "network" | "advanced";

export function MpvPanel() {
  const { settings, update } = useSettings();
  const t = useT();
  const [tab, setTab] = useState<Tab>("quality");
  useSubTabs(
    isTauri
      ? [
          { id: "quality", label: t("Quality") },
          { id: "picture", label: t("Picture") },
          { id: "network", label: t("Network") },
          { id: "advanced", label: t("mpv.conf") },
        ]
      : [],
    tab,
    (id) => setTab(id as Tab),
  );

  if (!isTauri) {
    return (
      <Section
        title={t("Desktop only")}
        subtitle={t("These tune the bundled mpv engine, which runs in the Harbor desktop app. They have no effect in the browser.")}
      >
        <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
          <Info size={18} className="mt-[2px] shrink-0 text-ink-subtle" />
          <p className={`max-w-[66ch] ${ROW_DESC}`}>
            {t("Download the desktop app to use video tuning.")}
          </p>
        </div>
      </Section>
    );
  }

  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "quality" && (
        <>
          <Section
            title={t("Picture quality")}
            subtitle={t("Balance picture quality and performance. Changes apply to the next video you play.")}
          >
            <QualityProfile />
          </Section>

          <Section
            title={t("Hardware acceleration")}
          >
            <SettingRow
              wide
              label={t("Hardware acceleration")}
              desc={
                settings.mpvHwdec === "off"
                  ? t("Uses the processor to decode video. Try this if hardware decoding causes picture problems.")
                  : settings.mpvHwdec === "on"
                    ? t("Always requests hardware decoding. Switch back to Auto if a video will not play.")
                    : t("Uses the graphics card when supported, with a processor fallback. Recommended for most computers.")
              }
            >
              <Segmented
                value={settings.mpvHwdec ?? "auto"}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "on", label: t("Force on") },
                  { value: "off", label: t("Off (use CPU)") },
                ]}
                onChange={(v) => update({ mpvHwdec: v })}
              />
            </SettingRow>
          </Section>

          <Section
            title={t("Compatibility")}
            subtitle={t("Try these if video shows a black screen, incorrect colors, or other picture problems.")}
          >
            <SettingRow
              wide
              label={t("Renderer")}
              desc={
                settings.mpvRenderer === "gpu"
                  ? t("Uses the older GPU renderer for graphics cards that have trouble with the modern renderer.")
                  : t("Uses the modern GPU renderer for higher-quality video processing.")
              }
            >
              <Segmented
                value={settings.mpvRenderer ?? "gpu-next"}
                options={[
                  { value: "gpu-next", label: t("GPU next") },
                  { value: "gpu", label: t("GPU (compatibility)") },
                ]}
                onChange={(v) => update({ mpvRenderer: v })}
              />
            </SettingRow>
            <ToggleRow
              label={t("Simple color mode")}
              sub={t("Converts video to 8-bit color for compatibility with older graphics cards. This disables HDR.")}
              value={settings.mpvForceYuv420p === true}
              onChange={(v) => update({ mpvForceYuv420p: v })}
            />
          </Section>
        </>
      )}
      {tab === "picture" && (
        <>
          <PictureDialsSection />
          <ColorHdrSection />
        </>
      )}
      {tab === "network" && <BufferSizeSection />}
      {tab === "advanced" && <AdvancedMpvSection />}
    </div>
  );
}
