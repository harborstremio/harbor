import { useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { isCapstanId, loadCapstanDetail, type CapstanDetail } from "./detail";

/** The provider's own record for one of its items, for a detail page that has no addon meta to
 * read. Null for every other id, and while the bridge is still answering. */
export function useCapstanDetail(meta: Meta): CapstanDetail | null {
  const id = meta.id;
  const type = meta.type;
  // The catalogue rebuilds its origin object on every read, so it is held in a ref: keyed on the
  // object it would reload the item on every render, and captured by value it would go stale.
  const originRef = useRef(meta.addonOrigin);
  originRef.current = meta.addonOrigin;
  const [loaded, setLoaded] = useState<CapstanDetail | null>(null);
  useEffect(() => {
    setLoaded(null);
    if (!isCapstanId(id)) return;
    let cancelled = false;
    void loadCapstanDetail(id, type, originRef.current).then((found) => {
      if (!cancelled) setLoaded(found);
    });
    return () => {
      cancelled = true;
    };
  }, [id, type]);
  return isCapstanId(id) ? loaded : null;
}
