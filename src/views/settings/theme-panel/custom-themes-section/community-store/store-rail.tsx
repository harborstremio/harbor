import type { ReactNode } from "react";
import type { StoreTheme } from "@/lib/theme-store";
import { MarketRail } from "./market/market-rail";

export function StoreRail({
  icon,
  title,
  subtitle,
  themes,
  ranked,
  scrollKey,
  onOpen,
  onViewAll,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  themes: StoreTheme[];
  ranked?: boolean;
  scrollKey: string;
  onOpen: (t: StoreTheme) => void;
  onViewAll?: () => void;
}) {
  return (
    <MarketRail
      icon={icon}
      title={title}
      subtitle={subtitle}
      items={themes}
      kind="theme"
      ranked={ranked}
      scrollKey={scrollKey}
      onOpen={(it) => onOpen(it as StoreTheme)}
      onViewAll={onViewAll}
    />
  );
}
