import { useEffect, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { useT } from "@/lib/i18n";
import { loadListItems } from "@/lib/curated/items";
import { curatedList } from "@/lib/curated/registry";
import type { CuratedListItem } from "@/lib/curated/types";
import { useScrollMemory } from "@/lib/view";
import { ListGrid } from "./curated-list/list-grid";
import { ListHeader } from "./curated-list/list-header";
import { RegistryEntries } from "./curated-list/registry-entries";

export function CuratedListView({ listId }: { listId: string }) {
  const t = useT();
  const list = curatedList(listId);
  const scrollRef = useRef<HTMLElement>(null);
  const [items, setItems] = useState<readonly CuratedListItem[]>(list?.head ?? []);
  const [settled, setSettled] = useState(false);

  useScrollMemory(`curated-list:${listId}`, scrollRef);

  useEffect(() => {
    let cancelled = false;
    setItems(curatedList(listId)?.head ?? []);
    setSettled(false);
    void loadListItems(listId).then((full) => {
      if (cancelled) return;
      if (full.length > 0) setItems(full);
      setSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  if (!list) return null;

  return (
    <main ref={scrollRef} className="relative h-full overflow-y-auto bg-canvas">
      <ListHeader list={list} />
      <div className="relative mx-auto flex max-w-[1180px] flex-col gap-10 px-12 pb-32 pt-14">
        {list.prose ? (
          <RegistryEntries list={list} items={items} scrollRoot={scrollRef} />
        ) : (
          <ListGrid list={list} items={items} scrollRoot={scrollRef} />
        )}
        {settled && items.length < list.count && (
          <p className="text-[13px] text-ink-subtle">
            {t("Showing {shown} of {total} from the last snapshot.", {
              shown: items.length.toLocaleString(),
              total: list.count.toLocaleString(),
            })}
          </p>
        )}
      </div>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}
