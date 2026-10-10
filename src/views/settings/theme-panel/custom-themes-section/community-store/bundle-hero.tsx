import type { StoreTheme } from "@/lib/theme-store";
import { getBundle, installBundle, type StoreBundle } from "@/lib/bundle-store";
import { MarketHero } from "./market/market-hero";

export function BundleHero({
  bundle,
  label,
  onOpen,
}: {
  bundle: StoreBundle;
  label: string;
  onOpen: (item: StoreTheme | StoreBundle) => void;
}) {
  return (
    <MarketHero
      item={bundle}
      kind={bundle.kind}
      label={label}
      onOpen={onOpen}
      onGet={async () => {
        installBundle(bundle);
        await getBundle(bundle.id).catch(() => {});
      }}
    />
  );
}
