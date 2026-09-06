import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useSubTabs } from "./sub-tabs";
import { Section } from "./shared";
import { SubtitleStylePanel } from "./player-panel";
import { SubtitleOffsetSettings } from "./player-panel/subtitle-offset-settings";
import { SubtitlesLanguageTab } from "./language-panel/subtitles-tab";
import { SubSourcesPanel } from "./sub-sources-panel";
import { AutoSyncPanel } from "./autosync-panel";

type Tab = "languages" | "sources" | "sync" | "look";

export function SubtitlesPanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("languages");
  const tabs = [
    { id: "languages" as const, label: t("Languages") },
    { id: "sources" as const, label: t("Sources") },
    { id: "sync" as const, label: t("Sync") },
    { id: "look" as const, label: t("Look") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));
  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "languages" && <SubtitlesLanguageTab />}
      {tab === "sources" && <SubSourcesPanel />}
      {tab === "sync" && <AutoSyncPanel />}
      {tab === "look" && <LookTab />}
    </div>
  );
}

function LookTab() {
  const t = useT();
  return (
    <>
      <Section
        title={t("Subtitle style")}
        subtitle={t("Adjust the text and background. The preview shows your changes as you make them.")}
      >
        <SubtitleStylePanel />
      </Section>
      <Section
        title={t("Sync indicator")}
        subtitle={t("The small on-screen readout that appears while you nudge subtitle timing with Z and X during playback. Automatic syncing lives in the Sync tab.")}
      >
        <SubtitleOffsetSettings />
      </Section>
    </>
  );
}
