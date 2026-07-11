import type { ResolvedAddon } from "@/lib/addons-store/store";
import { useT } from "@/lib/i18n";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { addonKey, idOf } from "./addons-utils";
import { FeatureCard } from "./feature-card";
import { ListCard } from "./list-card";
import { TileCard } from "./tile-card";

export function Rail({
  title,
  blurb,
  layout,
  items,
  onOpen,
  onInstall,
  onUninstall,
  installedIds,
}: {
  title: string;
  blurb?: string;
  layout: string;
  items: ResolvedAddon[];
  onOpen: (id: string) => void;
  onInstall: (r: ResolvedAddon) => Promise<void>;
  onUninstall: (r: ResolvedAddon) => Promise<void>;
  installedIds: Set<string>;
}) {
  const t = useT();
  const collapsedCount = layout === "feature" ? 2 : layout === "list" ? 2 : 4;
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > collapsedCount;
  const visibleItems = expanded ? items : items.slice(0, collapsedCount);
  return (
    <section style={{ contentVisibility: "auto", containIntrinsicSize: "auto 360px" }}>
      <header className="mb-5 flex items-end justify-between gap-4 border-b border-edge-soft/70 pb-3">
        <div>
          <h3 className="font-display text-[26px] font-medium tracking-tight text-ink">{title}</h3>
          {blurb && <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{blurb}</p>}
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-[12.5px] font-semibold text-accent transition-opacity hover:opacity-70"
          >
            {expanded ? t("Show less") : t("See all ({n})", { n: items.length })}
            <ChevronRight
              className={`-me-0.5 ms-0.5 inline transition-transform ${expanded ? "rotate-90" : "rtl:-scale-x-100"}`}
              size={12}
              strokeWidth={2.6}
            />
          </button>
        )}
      </header>
      {layout === "feature" ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visibleItems.map((r) => (
            <FeatureCard
              key={addonKey(r)}
              resolved={r}
              onOpen={() => onOpen(idOf(r))}
              onInstall={() => onInstall(r)}
              onUninstall={() => onUninstall(r)}
              installed={installedIds.has(idOf(r))}
            />
          ))}
        </div>
      ) : layout === "list" ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {visibleItems.map((r) => (
            <ListCard
              key={addonKey(r)}
              resolved={r}
              onOpen={() => onOpen(idOf(r))}
              onInstall={() => onInstall(r)}
              onUninstall={() => onUninstall(r)}
              installed={installedIds.has(idOf(r))}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((r) => (
            <TileCard
              key={addonKey(r)}
              resolved={r}
              onOpen={() => onOpen(idOf(r))}
              onInstall={() => onInstall(r)}
              installed={installedIds.has(idOf(r))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
