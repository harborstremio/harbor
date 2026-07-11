import { FeedShelf } from "@/components/feed-shelf";
import { browseFetcher, type BrowseCatalog } from "@/lib/catalog-browse";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { useEffect, useRef, useState } from "react";

const TYPE_LABELS: Record<string, string> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  tv: "TV",
  channel: "Channels",
};

export function CatalogShelf({ catalog }: { catalog: BrowseCatalog }) {
  const { openGrid } = useView();
  const t = useT();
  const [items, setItems] = useState<Meta[] | null>(null);
  const pageRef = useRef(1);
  const startedRef = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(null);
    startedRef.current = false;
    pageRef.current = 1;
    const el = ref.current;
    if (!el) return;
    const load = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      void browseFetcher(
        catalog,
        null,
      )(1)
        .then((list) => setItems(list))
        .catch(() => setItems([]));
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) load();
      },
      { rootMargin: "700px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [catalog.key]);

  const loadMore = () => {
    const next = pageRef.current + 1;
    void browseFetcher(
      catalog,
      null,
    )(next)
      .then((list) => {
        if (list.length === 0) return;
        pageRef.current = next;
        setItems((prev) => [...(prev ?? []), ...list]);
      })
      .catch(() => {});
  };

  return (
    <div ref={ref}>
      <FeedShelf
        shelf={{
          id: catalog.key,
          title: catalog.name,
          kicker: t(TYPE_LABELS[catalog.type] ?? catalog.type),
        }}
        items={items}
        onEndReached={loadMore}
        scrollKey={`catalogs:${catalog.key}`}
        onViewAll={() =>
          openGrid({
            title: catalog.name,
            fetcher: browseFetcher(catalog, null),
            initial: items ?? undefined,
          })
        }
      />
    </div>
  );
}
