import { useContext, useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { RailDef } from "@/lib/feed";
import { FeedShelf } from "@/components/feed-shelf";
import { ScrollRootContext } from "@/components/row";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

export function Rail({
  active = true,
  railId,
  allRails,
  deduped,
  loadMore,
  ensureLoaded,
  titleOverride,
}: {
  active?: boolean;
  railId: string;
  allRails: RailDef[];
  deduped: Record<string, Meta[] | null>;
  loadMore: (id: string) => void;
  ensureLoaded?: (id: string) => void;
  titleOverride?: string;
}) {
  const { openGrid } = useView();
  const t = useT();
  const root = useContext(ScrollRootContext);
  const element = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!active || !root || !element.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root,
      rootMargin: "1000px 0px",
    });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [active, root]);
  useEffect(() => {
    if (!active || !near) return;
    ensureLoaded?.(railId);
    // Bounded retries for transient failures; successful pages are a no-op.
    const retry = window.setTimeout(() => ensureLoaded?.(railId), 5000);
    const lastRetry = window.setTimeout(() => ensureLoaded?.(railId), 15000);
    return () => {
      clearTimeout(retry);
      clearTimeout(lastRetry);
    };
  }, [active, near, railId, ensureLoaded]);
  const def = allRails.find((r) => r.id === railId);
  if (!def) return null;
  const items = deduped[railId] ?? null;
  const shelf = {
    ...def.shelf,
    title: titleOverride === undefined ? t(def.shelf.title) : titleOverride,
    kicker: def.shelf.kicker ? t(def.shelf.kicker) : def.shelf.kicker,
  };
  return (
    <div
      ref={element}
      data-scroll-anchor={`discover:${railId}`}
      className={items?.length === 0 ? "hidden" : undefined}
      onFocusCapture={() => setNear(true)}
    >
      <FeedShelf
        shelf={shelf}
        items={items}
        onEndReached={active && near && items !== null ? () => loadMore(railId) : undefined}
        scrollKey={`discover:${railId}`}
        onViewAll={() =>
          openGrid({
            title: shelf.title,
            fetcher: (page) => def.fetch(page),
            initial: items ?? undefined,
          })
        }
      />
    </div>
  );
}
