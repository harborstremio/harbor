import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { FeedShelf } from "@/components/feed-shelf";
import { browseFetcher, type BrowseCatalog } from "@/lib/catalog-browse";
import { queryKeys } from "@/lib/query";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";

const TYPE_LABELS: Record<string, string> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  tv: "TV",
  channel: "Channels",
};

const STALE_MS = 5 * 60_000;

export function CatalogShelf({
  catalog,
  eager = false,
}: {
  catalog: BrowseCatalog;
  /** Load immediately (above the fold) instead of waiting for IntersectionObserver. */
  eager?: boolean;
}) {
  const { openGrid } = useView();
  const t = useT();
  const queryClient = useQueryClient();
  const [inView, setInView] = useState(false);
  const pageRef = useRef(1);
  const ref = useRef<HTMLDivElement>(null);
  const shouldLoad = eager || inView;

  useEffect(() => {
    if (eager) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setInView(true);
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    // Fail-open: if IO never fires (weird scroll root), still load shortly.
    const failOpen = window.setTimeout(() => setInView(true), 2500);
    return () => {
      io.disconnect();
      window.clearTimeout(failOpen);
    };
  }, [eager, catalog.key]);

  const shelfKey = queryKeys.catalog.shelf(catalog.base, catalog.type, catalog.id);

  const {
    data: items = null,
    isPending,
    isError,
  } = useQuery({
    queryKey: shelfKey,
    queryFn: () => browseFetcher(catalog, null)(1),
    enabled: shouldLoad,
    staleTime: STALE_MS,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  const loadMore = () => {
    const next = pageRef.current + 1;
    void browseFetcher(
      catalog,
      null,
    )(next)
      .then((list) => {
        if (list.length === 0) return;
        pageRef.current = next;
        queryClient.setQueryData<Meta[]>(shelfKey, (prev) => [...(prev ?? []), ...list]);
      })
      .catch(() => {});
  };

  // null = loading skeleton; [] = loaded empty (hide shelf)
  const display: Meta[] | null =
    !shouldLoad || (isPending && items === null) ? null : isError ? [] : items;

  return (
    <div ref={ref}>
      <FeedShelf
        shelf={{
          id: catalog.key,
          title: catalog.name,
          kicker: t(TYPE_LABELS[catalog.type] ?? catalog.type),
        }}
        items={display}
        onEndReached={loadMore}
        scrollKey={`catalogs:${catalog.key}`}
        onViewAll={() =>
          openGrid({
            title: catalog.name,
            fetcher: browseFetcher(catalog, null),
            initial: display ?? undefined,
          })
        }
      />
    </div>
  );
}

/** Prefetch first page of a catalog shelf into TanStack Query. */
export function prefetchCatalogShelf(
  queryClient: ReturnType<typeof useQueryClient>,
  catalog: BrowseCatalog,
): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.catalog.shelf(catalog.base, catalog.type, catalog.id),
    queryFn: () => browseFetcher(catalog, null)(1),
    staleTime: STALE_MS,
  });
}
