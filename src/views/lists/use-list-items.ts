import { resolveList } from "@/lib/lists/resolve";
import { ListResolveError, type CustomList, type ListItem } from "@/lib/lists/types";
import { useSettings } from "@/lib/settings";
import { useCallback, useEffect, useRef, useState } from "react";

export function useListItems(list: CustomList | null, active: boolean) {
  const { settings } = useSettings();
  const { mdblistKey, tmdbKey } = settings;
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ListResolveError | null>(null);
  const epoch = useRef(0);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!active || !list) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    const current = ++epoch.current;
    setLoading(true);
    setError(null);
    resolveList(list, { mdblistKey, tmdbKey })
      .then((res) => {
        if (epoch.current !== current) return;
        setItems(res.items);
      })
      .catch((e) => {
        if (epoch.current !== current) return;
        setItems([]);
        setError(e instanceof ListResolveError ? e : new ListResolveError("network", list.source));
      })
      .finally(() => {
        if (epoch.current === current) setLoading(false);
      });
  }, [active, list?.id, list?.ref, list?.source, mdblistKey, tmdbKey, nonce]);

  return { items, loading, error, refresh };
}
