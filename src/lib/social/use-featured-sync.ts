import { useEffect, useRef } from "react";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { subscribeLists } from "@/lib/custom-lists";
import {
  fetchFeaturedLists,
  normalizeListName,
  readLocalLists,
  saveFeaturedLists,
  type FeaturedItem,
  type FeaturedList,
} from "./featured-lists";

const MIGRATED_KEY = "harbor.featured.postermigrated.v1";

function sig(items: FeaturedItem[]): string {
  return items.map((i) => `${i.id}\u0000${i.name}`).join("|");
}

export function useFeaturedListsSync(): void {
  const served = useRef<FeaturedList[]>([]);
  const busy = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const handle = currentAuthor()?.handle;
      if (!handle) {
        served.current = [];
        return;
      }
      fetchFeaturedLists(handle)
        .then((f) => {
          if (cancelled) return;
          served.current = f;
          void migrate();
        })
        .catch(() => {});
    };
    load();
    const off = subscribeAuthor(load);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  useEffect(() => {
    return subscribeLists(() => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void resync(), 1500);
    });
  }, []);

  async function migrate(): Promise<void> {
    const list = served.current;
    if (!list.length || busy.current) return;
    try {
      if (localStorage.getItem(MIGRATED_KEY)) return;
    } catch {
      return;
    }
    busy.current = true;
    try {
      const saved = await saveFeaturedLists(list, true);
      served.current = saved.length ? saved : list;
      try {
        localStorage.setItem(MIGRATED_KEY, "1");
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    } finally {
      busy.current = false;
    }
  }

  async function resync(): Promise<void> {
    if (busy.current) return;
    const handle = currentAuthor()?.handle;
    if (!handle) return;
    busy.current = true;
    try {
      const current = await fetchFeaturedLists(handle);
      served.current = current;
      if (current.length === 0) return;
      const localByName = new Map(readLocalLists().map((l) => [normalizeListName(l.name), l]));
      let changed = false;
      const next = current.map((f) => {
        const local = localByName.get(normalizeListName(f.name));
        if (!local || (sig(f.items) === sig(local.items) && f.description === local.description))
          return f;
        changed = true;
        return { ...f, description: local.description, items: local.items };
      });
      if (!changed || !next.length) return;
      const saved = await saveFeaturedLists(next, true);
      if (saved.length) served.current = saved;
    } catch {
      /* ignore */
    } finally {
      busy.current = false;
    }
  }
}
