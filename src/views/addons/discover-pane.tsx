import { CommunityAddonsRail } from "@/components/community-addons-rail";
import { CategoryGrid } from "./category-grid";
import { AddonSpotlight } from "./addon-spotlight";
import { LazyReveal } from "./lazy-reveal";
import { SyncNudge } from "./sync-nudge";

export function DiscoverPane({
  onOpen,
  onCategorySelect,
  installedIds,
  authKey,
  onRefetch,
}: {
  onOpen: (id: string) => void;
  onCategorySelect: (cat: string) => void;
  installedIds: Set<string>;
  authKey: string | null;
  onRefetch?: () => void;
}) {
  return (
    <div className="flex flex-col gap-12">
      <SyncNudge authKey={authKey} />
      <AddonSpotlight installedIds={installedIds} onOpen={onOpen} onChange={onRefetch} />
      <CommunityAddonsRail installedIds={installedIds} onChange={onRefetch} onOpen={onOpen} />
      <LazyReveal minHeight={220}>
        <CategoryGrid onCategorySelect={onCategorySelect} />
      </LazyReveal>
    </div>
  );
}
