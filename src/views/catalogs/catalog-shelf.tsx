import { useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { FeedShelf } from "@/components/feed-shelf";
import { useHideAnimeMetas } from "@/lib/anime-hide";
import { browseFetcher, catalogTypeLabelKey, type BrowseCatalog } from "@/lib/catalog-browse";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";

export function CatalogShelf({ catalog }: { catalog: BrowseCatalog }) {
  const { openGrid } = useView();
  const t = useT();
  const typeLabelKey = catalogTypeLabelKey(catalog.type);
  const [items, setItems] = useState<Meta[] | null>(null);
  const pageRef = useRef(1);
  const loadedRef = useRef(0);
  const startedRef = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(null);
    startedRef.current = false;
    pageRef.current = 1;
    loadedRef.current = 0;
    const el = ref.current;
    if (!el) return;
    const load = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      void browseFetcher(
        catalog,
        null,
      )(1)
        .then((list) => {
          setItems(list);
          loadedRef.current = list.length;
        })
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
    void browseFetcher(catalog, null)(next, loadedRef.current)
      .then((list) => {
        if (list.length === 0) return;
        pageRef.current = next;
        setItems((prev) => {
          const seen = new Set((prev ?? []).map((m) => m.id));
          const fresh = list.filter((m) => !seen.has(m.id));
          if (fresh.length === 0) return prev;
          loadedRef.current += fresh.length;
          return [...(prev ?? []), ...fresh];
        });
      })
      .catch(() => {});
  };

  const shownItems = useHideAnimeMetas(items ?? []);
  if (items !== null && shownItems.length === 0) return null;

  return (
    <div ref={ref}>
      <FeedShelf
        shelf={{
          id: catalog.key,
          title: catalog.name,
          kicker: typeLabelKey ? t(typeLabelKey) : catalog.type,
        }}
        items={items === null ? null : shownItems}
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
