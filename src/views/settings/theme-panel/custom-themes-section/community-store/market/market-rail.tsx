import type { ReactNode } from "react";
import { Row } from "@/components/row";
import { SectionHeader } from "@/views/profile/section-header";
import type { StoreTheme } from "@/lib/theme-store";
import type { StoreBundle } from "@/lib/bundle-store";
import { MarketCard } from "./market-card";

export function MarketRail({
  title,
  subtitle,
  icon,
  items,
  kind,
  ranked = false,
  scrollKey,
  onOpen,
  onViewAll,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  items: Array<StoreTheme | StoreBundle>;
  kind: "theme" | "badge" | "award";
  ranked?: boolean;
  scrollKey: string;
  onOpen: (item: StoreTheme | StoreBundle) => void;
  onViewAll?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col">
      <SectionHeader icon={icon} label={title} onViewAll={onViewAll} />
      {subtitle && (
        <p className="-mt-3 mb-4 max-w-[70ch] text-[15.5px] font-normal leading-[22px] text-ink-subtle">
          {subtitle}
        </p>
      )}
      <Row shape="landscape" min={252} scrollKey={scrollKey}>
        {items.map((it, i) => (
          <MarketCard key={it.id} item={it} kind={kind} rank={ranked ? i + 1 : undefined} onOpen={onOpen} />
        ))}
      </Row>
    </div>
  );
}
