import { useEffect, useState } from "react";
import { useProfiles } from "@/lib/profiles";
import { useT } from "@/lib/i18n";
import { useSubTabs } from "../sub-tabs";
import { TV_GROUPS } from "./model";
import { TvGroupSection } from "./sections";
import { TvStatusHeader } from "./status-header";
import { TvDevicesSection } from "./devices-section";
import { TvMirrorSection } from "./mirror-section";
import { TvSubLookSection } from "./look-section";
import { TvThemeSection } from "./theme-section";
import { TvOnDeviceSection } from "./on-tv-section";
import { pullTvNow, registerTvSyncSections, useTvBundle } from "./store";

type Tab = "devices" | "look" | "watching" | "content";

const CLAIMED: Record<Exclude<Tab, "watching">, string[]> = {
  devices: [],
  look: ["picture"],
  content: ["languages", "services"],
};

const SPOKEN_FOR = new Set(Object.values(CLAIMED).flat());

export function TvPanel() {
  const t = useT();
  const { activeId } = useProfiles();
  const profileId = activeId ?? "default";
  const bundle = useTvBundle(profileId);
  const [tab, setTab] = useState<Tab>("devices");

  const tabs = [
    { id: "devices" as const, label: t("Devices") },
    { id: "look" as const, label: t("Look") },
    { id: "watching" as const, label: t("Watching") },
    { id: "content" as const, label: t("Content") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));

  useEffect(() => {
    registerTvSyncSections();
    pullTvNow();
  }, []);

  const groups = TV_GROUPS.filter((group) =>
    tab === "watching" ? !SPOKEN_FOR.has(group.id) : CLAIMED[tab].includes(group.id),
  );

  return (
    <>
      <TvStatusHeader />
      <div key={tab} className="harbor-cascade flex flex-col gap-10">
        {tab === "devices" && (
          <>
            <TvDevicesSection />
            <TvMirrorSection profileId={profileId} />
            <TvOnDeviceSection />
          </>
        )}
        {tab === "look" && (
          <>
            <TvThemeSection profileId={profileId} active={bundle.theme} />
            <TvSubLookSection profileId={profileId} doc={bundle.playerlayout} />
          </>
        )}
        {groups.map((group) => (
          <TvGroupSection key={group.id} group={group} doc={bundle.settings} profileId={profileId} />
        ))}
      </div>
    </>
  );
}
