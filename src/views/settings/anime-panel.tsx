import { Waves } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import { SettingRow } from "./kit";
import { isTauri } from "./player-panel/internals";
import { SvpSection } from "./anime-panel/svp-section";
import { MotionCompare } from "./anime-panel/motion-compare";
import { useSubTabs } from "./sub-tabs";

type Tab = "smooth" | "svp";

export function AnimePanel() {
  const { settings, update } = useSettings();
  const t = useT();
  const [tab, setTab] = useState<Tab>("smooth");
  useSubTabs(
    isTauri
      ? [
          { id: "smooth", label: t("Smooth motion") },
          { id: "svp", label: t("SVP") },
        ]
      : [],
    tab,
    (id) => setTab(id as Tab),
  );

  if (!isTauri) {
    return (
      <Section
        title={t("Desktop only")}
        subtitle={t("Smooth motion runs on the bundled mpv engine in the Harbor desktop app. It has no effect in the browser.")}
      >
        <div className="rounded-md bg-elevated px-4 py-3.5 text-[13px] leading-relaxed text-ink-subtle">
          {t("Download the desktop app to use anime enhancements.")}
        </div>
      </Section>
    );
  }

  const svpDriving = settings.playerSvp && !!settings.svpVpyPath;

  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "smooth" && (
        <>
      <Section
        title={t("Smooth motion")}
        subtitle={t("Anime is drawn on twos and threes, so fast pans can judder. Smoothing fills in the gaps so motion glides.")}
      >
        <ToggleRow
          label={t("Motion smoothing")}
          sub={t("Harbor's built-in frame interpolation. Smooths panning, best on anime. Needs a display refresh rate above the video's frame rate, and can stutter on weak GPUs. Lighter than SVP.")}
          value={settings.playerMotionInterp}
          onChange={(v) => update({ playerMotionInterp: v })}
          lockReason={
            svpDriving
              ? t("SVP is already handling frame interpolation. Turn off SVP below to use this instead. Running both delays the audio.")
              : undefined
          }
        />

        <SettingRow
          wide
          icon={<Waves size={16} />}
          label={t("Before and after")}
          desc={t("The same camera pan on each setting. The lit lane is what you get right now.")}
          tip={t("Interpolation invents frames between the drawn ones, so a pan travels in many small moves instead of a few big jumps.")}
        >
          <MotionCompare smoothed={svpDriving || settings.playerMotionInterp} />
        </SettingRow>
      </Section>
        </>
      )}
      {tab === "svp" && <SvpSection />}
    </div>
  );
}
