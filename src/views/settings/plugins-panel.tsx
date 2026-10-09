import { useEffect, useState } from "react";
import { Info } from "./icons";
import { useT } from "@/lib/i18n";
import { loadPluginKinds } from "@/lib/plugins";
import { schedulePluginAutoCheck } from "@/lib/plugins/auto-check";
import { useSettings } from "@/lib/settings";
import { InstalledTab } from "./plugins-panel/installed-tab";
import { RepositoriesTab } from "./plugins-panel/repositories-tab";
import { Section } from "./shared";
import { useSubTabs } from "./sub-tabs";

type Tab = "plugins" | "repositories";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function PluginsPanel() {
  const t = useT();
  const { settings } = useSettings();
  const [tab, setTab] = useState<Tab>("plugins");
  const tabs = [
    { id: "plugins" as const, label: t("Plugins") },
    { id: "repositories" as const, label: t("Repositories") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));

  useEffect(() => {
    if (!isTauri) return;
    void loadPluginKinds();
    schedulePluginAutoCheck(settings.pluginsAutoCheck);
  }, [settings.pluginsAutoCheck]);

  if (!isTauri) {
    return (
      <Section title={t("Desktop only")}>
        <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
          <Info size={18} strokeWidth={2.2} className="mt-[2px] shrink-0 text-ink-subtle" />
          <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
            {t("Plugins run in the desktop app. Open Harbor on your computer to add and manage them.")}
          </p>
        </div>
      </Section>
    );
  }

  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "plugins" ? (
        <InstalledTab onAddRepository={() => setTab("repositories")} />
      ) : (
        <RepositoriesTab />
      )}
    </div>
  );
}
