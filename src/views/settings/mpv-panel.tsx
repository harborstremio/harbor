import { Info } from "lucide-react";
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
            subtitle={t("One choice that sets how hard your computer works to make video look its best. Pick the one that matches your machine. Takes effect on the next thing you play.")}
          >
            <QualityProfile />
          </Section>

          <Section
            title={t("Hardware acceleration")}
            subtitle={t("Let your graphics card do the heavy lifting of decoding video. It saves battery and keeps the CPU cool. Auto is right for almost everyone; only switch if playback looks wrong or won't start.")}
          >
            <SettingRow
              wide
              label={t("Hardware acceleration")}
              desc={
                settings.mpvHwdec === "off"
                  ? t("The CPU decodes everything. Most compatible, but it runs hot and can stutter on 4K. Use this only if the picture glitches with hardware decoding on.")
                  : settings.mpvHwdec === "on"
                    ? t("Forces the graphics card on. Smoothest and coolest, but a few old or unusual files may refuse to play. Switch back to Auto if something won't start.")
                    : t("Harbor uses the graphics card when it's safe and falls back to the CPU when it isn't. The right call for almost everyone.")
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
            subtitle={t("Fallbacks for machines where the modern video path misbehaves. Leave these alone unless the picture is wrong or a file won't start.")}
          >
            <SettingRow
              wide
              label={t("Renderer")}
              desc={
                settings.mpvRenderer === "gpu"
                  ? t("Older, simpler renderer. Use it only if the modern one shows a black screen, wrong colors, or won't start on your graphics card.")
                  : t("Modern renderer with higher-quality processing. The right choice for almost every machine.")
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
              sub={t("Converts video to plain 8-bit before display for graphics cards that glitch on 10-bit or unusual formats. Fixes some visual artifacts, but turns off HDR. Leave off unless you need it.")}
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
