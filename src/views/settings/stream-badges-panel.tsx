import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useSubTabs } from "./sub-tabs";
import { BadgesTab } from "./stream-badges-panel/badges-tab";
import { RulesTab } from "./stream-badges-panel/rules-tab";
import { PacksTab } from "./stream-badges-panel/packs-tab";

type Tab = "badges" | "rules" | "packs";

export function StreamBadgesPanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("badges");
  const tabs = [
    { id: "badges" as const, label: t("Badges") },
    { id: "rules" as const, label: t("Custom rules") },
    { id: "packs" as const, label: t("Packs") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));
  return (
    <>
      <div key={tab} className="harbor-cascade flex flex-col gap-10">
        {tab === "badges" && <BadgesTab />}
        {tab === "rules" && <RulesTab />}
        {tab === "packs" && <PacksTab />}
      </div>
    </>
  );
}
