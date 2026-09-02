import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useSubTabs } from "./sub-tabs";
import {
  LocalEngineSection,
  P2PPowerToolsSection,
  RemoteServerSection,
  ServerAddressSection,
} from "./player-panel";

type Tab = "engine" | "server";

export function P2PPanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("engine");
  const tabs = [
    { id: "engine" as const, label: t("Engine") },
    { id: "server" as const, label: t("Server") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));
  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
        {tab === "engine" && (
          <>
            <LocalEngineSection />
            <P2PPowerToolsSection />
          </>
        )}
        {tab === "server" && (
          <>
            <ServerAddressSection />
            <RemoteServerSection />
          </>
      )}
    </div>
  );
}
