import { downloadTheme, type StoreTheme } from "@/lib/theme-store";
import { MarketHero } from "./market/market-hero";

export function StoreHero({
  theme,
  label,
  tag,
  onOpen,
}: {
  theme: StoreTheme;
  label: string;
  tag?: string;
  onOpen: (t: StoreTheme) => void;
}) {
  return (
    <MarketHero
      item={theme}
      kind="theme"
      label={label}
      tag={tag}
      onOpen={(it) => onOpen(it as StoreTheme)}
      onGet={() =>
        downloadTheme(theme.id, theme.cover ?? theme.screenshots[0] ?? null, theme.versionsCount).then(() => {})
      }
    />
  );
}
