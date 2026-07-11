import { FeedShelf } from "@/components/feed-shelf";
import type { Meta } from "@/lib/cinemeta";
import type { RailDef } from "@/lib/feed";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { useEffect } from "react";

export function Rail({
  railId,
  allRails,
  deduped,
  loadMore,
  ensureLoaded,
  titleOverride,
}: {
  railId: string;
  allRails: RailDef[];
  deduped: Record<string, Meta[] | null>;
  loadMore: (id: string) => void;
  ensureLoaded?: (id: string) => void;
  titleOverride?: string;
}) {
  const { openGrid } = useView();
  const t = useT();
  useEffect(() => {
    ensureLoaded?.(railId);
  }, [railId, ensureLoaded]);
  const def = allRails.find((r) => r.id === railId);
  if (!def) return null;
  const items = deduped[railId] ?? null;
  const shelf = {
    ...def.shelf,
    title: t(titleOverride ?? def.shelf.title),
    kicker: def.shelf.kicker ? t(def.shelf.kicker) : def.shelf.kicker,
  };
  return (
    <FeedShelf
      shelf={shelf}
      items={items}
      onEndReached={() => loadMore(railId)}
      scrollKey={`discover:${railId}`}
      onViewAll={() =>
        openGrid({
          title: shelf.title,
          fetcher: (page) => def.fetch(page),
          initial: items ?? undefined,
        })
      }
    />
  );
}
