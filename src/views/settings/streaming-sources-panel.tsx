import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useSubTabs } from "./sub-tabs";
import { DebridTab, type DebridKey } from "./streaming-sources-panel/debrid-tab";
import { FiltersTab } from "./streaming-sources-panel/filters-tab";
import { SortingTab } from "./streaming-sources-panel/sorting-tab";
import { PickerTab } from "./streaming-sources-panel/picker-tab";
import { HomeServersTab } from "./streaming-sources-panel/home-servers-tab";

export type { DebridKey };

type Tab = "services" | "home-servers" | "filters" | "sorting" | "picker";

export function StreamingSourcesPanel({
  rdDraft,
  tbDraft,
  adDraft,
  pmDraft,
  dlDraft,
  setRdDraft,
  setTbDraft,
  setAdDraft,
  setPmDraft,
  setDlDraft,
  savedKey,
  saveKey,
}: {
  rdDraft: string;
  tbDraft: string;
  adDraft: string;
  pmDraft: string;
  dlDraft: string;
  setRdDraft: (v: string) => void;
  setTbDraft: (v: string) => void;
  setAdDraft: (v: string) => void;
  setPmDraft: (v: string) => void;
  setDlDraft: (v: string) => void;
  savedKey: string | null;
  saveKey: (which: DebridKey, value: string) => void;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(() =>
    sessionStorage.getItem("harbor.settings.streaming.home-servers") ? "home-servers" : "services",
  );
  const tabs = [
    { id: "services" as const, label: t("Services") },
    { id: "home-servers" as const, label: t("Home servers") },
    { id: "filters" as const, label: t("Filters") },
    { id: "sorting" as const, label: t("Sorting") },
    { id: "picker" as const, label: t("Picker") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));
  if (tab === "home-servers") sessionStorage.removeItem("harbor.settings.streaming.home-servers");
  return (
    <>
      <div key={tab} className="harbor-cascade flex flex-col gap-10">
        {tab === "services" && (
          <DebridTab
            rdDraft={rdDraft}
            tbDraft={tbDraft}
            adDraft={adDraft}
            pmDraft={pmDraft}
            dlDraft={dlDraft}
            setRdDraft={setRdDraft}
            setTbDraft={setTbDraft}
            setAdDraft={setAdDraft}
            setPmDraft={setPmDraft}
            setDlDraft={setDlDraft}
            savedKey={savedKey}
            saveKey={saveKey}
          />
        )}
        {tab === "home-servers" && <HomeServersTab />}
        {tab === "filters" && <FiltersTab />}
        {tab === "sorting" && <SortingTab />}
        {tab === "picker" && <PickerTab />}
      </div>
    </>
  );
}
