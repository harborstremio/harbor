import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useSubTabs } from "./sub-tabs";
import { CustomCodeCard } from "./player-panel";
import { isTauri } from "./player-panel/internals";
import { WebBuildBanner } from "./advanced-panel/web-build-banner";
import { SystemTab } from "./advanced-panel/system-tab";
import { PrivacyTab } from "./advanced-panel/privacy-tab";
import { RepairTab } from "./advanced-panel/repair-tab";
import { AboutTab } from "./advanced-panel/about-tab";

export { BetaChannelRow, UpdatesRow } from "./advanced-panel/update-rows";

type Tab = "system" | "privacy" | "repair" | "code" | "about";

export function AdvancedPanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("system");
  const tabs = [
    { id: "system" as const, label: t("System") },
    { id: "privacy" as const, label: t("Privacy") },
    { id: "repair" as const, label: t("Repair") },
    { id: "code" as const, label: t("Custom code") },
    { id: "about" as const, label: t("About") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));
  return (
    <>
      {!isTauri && tab === "about" && <WebBuildBanner />}
      <div key={tab} className="harbor-cascade flex flex-col gap-10">
        {tab === "system" && <SystemTab />}
        {tab === "privacy" && <PrivacyTab />}
        {tab === "repair" && <RepairTab />}
        {tab === "code" && <CustomCodeCard />}
        {tab === "about" && <AboutTab />}
      </div>
    </>
  );
}
