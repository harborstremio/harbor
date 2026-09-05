import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useSubTabs } from "./sub-tabs";
import { PlayTab } from "./quality-panel/play-tab";
import { EngineTab } from "./quality-panel/engine-tab";
import { AspectTab } from "./quality-panel/aspect-tab";
import { AudioTab } from "./quality-panel/audio-tab";
import { OnScreenTab } from "./quality-panel/onscreen-tab";
import { XrayTab } from "./quality-panel/xray-tab";
import { AdSkipTab } from "./quality-panel/ad-skip-tab";
import { IntrosTab } from "./quality-panel/intros-tab";
import { UpNextTab } from "./quality-panel/up-next-tab";
import { TrailersTab } from "./quality-panel/trailers-tab";

type Tab =
  | "play"
  | "engine"
  | "aspect"
  | "audio"
  | "onscreen"
  | "xray"
  | "adskip"
  | "intros"
  | "upnext"
  | "trailers";

export function QualityPanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("play");
  const tabs = [
    { id: "play" as const, label: t("Play") },
    { id: "engine" as const, label: t("Engine") },
    { id: "aspect" as const, label: t("Aspect") },
    { id: "audio" as const, label: t("Audio") },
    { id: "onscreen" as const, label: t("On screen") },
    { id: "xray" as const, label: t("X-Ray") },
    { id: "adskip" as const, label: t("Ad skip") },
    { id: "intros" as const, label: t("Intros") },
    { id: "upnext" as const, label: t("Up next") },
    { id: "trailers" as const, label: t("Trailers") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));
  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "play" && <PlayTab />}
      {tab === "engine" && <EngineTab />}
      {tab === "aspect" && <AspectTab />}
      {tab === "audio" && <AudioTab />}
      {tab === "onscreen" && <OnScreenTab />}
      {tab === "xray" && <XrayTab />}
      {tab === "adskip" && <AdSkipTab />}
      {tab === "intros" && <IntrosTab />}
      {tab === "upnext" && <UpNextTab />}
      {tab === "trailers" && <TrailersTab />}
    </div>
  );
}
