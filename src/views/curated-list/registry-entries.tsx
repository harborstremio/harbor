import { useEffect, useRef, useState, type RefObject } from "react";
import type { CuratedList, CuratedListItem } from "@/lib/curated/types";
import { loadRegistryEntries, registryEntriesNow } from "@/lib/film-registry/entries";
import { inductionYear } from "@/lib/film-registry/inductions";
import type { RegistryEntry as Entry } from "@/lib/film-registry/types";
import { useT } from "@/lib/i18n";
import { RegistryEntry } from "./registry-entry";

const PAGE = 24;

export function RegistryEntries({
  list,
  items,
  scrollRoot,
}: {
  list: CuratedList;
  items: readonly CuratedListItem[];
  scrollRoot: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const [entries, setEntries] = useState<Record<string, Entry> | null>(() => registryEntriesNow());
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (entries) return;
    let cancelled = false;
    void loadRegistryEntries().then((loaded) => {
      if (!cancelled) setEntries(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= items.length) return;
    const io = new IntersectionObserver(
      (seen) => {
        if (seen[0]?.isIntersecting) setShown((n) => n + PAGE);
      },
      { root: scrollRoot.current, rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, items.length, scrollRoot]);

  if (items.length === 0) {
    return <p className="py-20 text-center text-[14px] text-ink-subtle">{t("Nothing here yet.")}</p>;
  }

  return (
    <section className="flex w-full max-w-[880px] flex-col gap-10">
      {items.slice(0, shown).map((item) => (
        <RegistryEntry
          key={item.imdb}
          list={list}
          item={item}
          entry={entries?.[item.imdb]}
          inducted={inductionYear(item.imdb)}
        />
      ))}
      {shown < items.length && <div ref={sentinel} className="h-24" />}
    </section>
  );
}
