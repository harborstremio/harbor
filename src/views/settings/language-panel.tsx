import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useSubTabs } from "./sub-tabs";
import { AppLanguageTab } from "./language-panel/app-tab";
import { AudioLanguageTab } from "./language-panel/audio-tab";
import { DiscoveryLanguageTab } from "./language-panel/discovery-tab";

type Tab = "app" | "audio" | "discovery";

export function LanguagePanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("app");
  const tabs = [
    { id: "app" as const, label: t("Harbor") },
    { id: "audio" as const, label: t("Audio") },
    { id: "discovery" as const, label: t("What you see") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));
  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "app" && <AppLanguageTab />}
      {tab === "audio" && <AudioLanguageTab />}
      {tab === "discovery" && <DiscoveryLanguageTab />}
    </div>
  );
}
