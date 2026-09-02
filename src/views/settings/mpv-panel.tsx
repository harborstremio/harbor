import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "./shared";
import { SettingRow } from "./kit";
import { isTauri } from "./player-panel/internals";
import { QualityProfile } from "./mpv-panel/profile";
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
      <>
      <Section
        title={t("Desktop only")}
        subtitle={t("These tune the bundled mpv engine, which runs in the Harbor desktop app. They have no effect in the browser.")}
      >
        <span className="rounded-md bg-elevated px-4 py-3.5 text-[13px] text-ink-subtle">
          {t("Download the desktop app to use video tuning.")}
        </span>
      </Section>
      </>
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
        </>
      )}
      {tab === "picture" && (
        <>
          <PictureDialsSection />
          <ColorHdrSection />
        </>
      )}
      {tab === "network" && (
        <>
      <Section
        title={t("Slow or unstable connection")}
        subtitle={t("If video keeps pausing to buffer, or you're on spotty Wi-Fi or a far-away server, this gives Harbor a bigger head start so playback rides through the rough patches.")}
      >
        <ToggleRow
          label={t("Build a bigger buffer")}
          sub={t("Loads more of the video ahead of time before playing. Smoother on weak connections, uses a little more memory and takes a moment longer to start.")}
          value={settings.mpvBufferBoost}
          onChange={(v) => update({ mpvBufferBoost: v })}
        />
      </Section>

        </>
      )}
      {tab === "advanced" && <AdvancedMpvSection />}
    </div>
  );
}
