import type { MangaSummary } from "@/lib/manga/types";
import { BrowseSources } from "./browse-sources";
import { ExtensionsManager } from "./extensions-manager";
import { ServersSection } from "./servers-section";
import { useServers } from "./use-servers";
import { serverConfig } from "./types";
import { activateServerSource } from "./open-bridge";

export function SuwayomiWorkspace({ onOpen }: { onOpen?: (id: string) => void }) {
  const { active } = useServers();
  const config = active ? serverConfig(active) : null;

  const open = (item: MangaSummary) => {
    if (!active) return;
    activateServerSource(active);
    onOpen?.(item.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <ServersSection />
      {config && (
        <>
          <ExtensionsManager config={config} />
          <BrowseSources config={config} onOpen={open} />
        </>
      )}
    </div>
  );
}
