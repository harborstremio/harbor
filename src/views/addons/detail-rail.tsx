import type { ResolvedAddon } from "@/lib/addons-store/store";
import { addonKey, idOf } from "./addons-utils";
import { TileCard } from "./tile-card";

export function DetailRail({
  title,
  items,
  installedIds,
  onOpen,
  onInstall,
}: {
  title: string;
  items: ResolvedAddon[];
  installedIds: Set<string>;
  onOpen: (id: string) => void;
  onInstall: (r: ResolvedAddon) => Promise<boolean>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-5 border-b border-edge-soft/70 pb-3 font-display text-[22px] font-medium tracking-tight text-ink">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {items.map((r) => (
          <TileCard
            key={addonKey(r)}
            resolved={r}
            onOpen={() => onOpen(idOf(r))}
            onInstall={() => void onInstall(r)}
            installed={installedIds.has(idOf(r))}
          />
        ))}
      </div>
    </section>
  );
}
