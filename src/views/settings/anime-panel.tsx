import { Info } from "./icons";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ROW_DESC, Section, ToggleRow } from "./shared";
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
          { id: "smooth", label: t("Motion") },
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
        <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
          <Info size={18} className="mt-[2px] shrink-0 text-ink-subtle" />
          <p className={`max-w-[66ch] ${ROW_DESC}`}>
            {t("Download the desktop app to use anime enhancements.")}
          </p>
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
      >
        <ToggleRow
          label={t("Motion smoothing")}
          sub={t("Smooths camera movement using Harbor's player. Works best when your screen refreshes faster than the video's frame rate.")}
          value={settings.playerMotionInterp}
          onChange={(v) => update({ playerMotionInterp: v })}
          lockReason={
            svpDriving
              ? t("SVP is handling motion smoothing. Turn it off on the SVP page to use Harbor's smoothing instead.")
              : undefined
          }
        />

        <MotionCompare />
      </Section>
        </>
      )}
      {tab === "svp" && <SvpSection />}
    </div>
  );
}
