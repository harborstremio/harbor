import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { browseBundles, type BundleKind, type StoreBundle } from "@/lib/bundle-store";

const caches: Partial<Record<BundleKind, StoreBundle[]>> = {};

export function useStoreBundles(kind: BundleKind): {
  bundles: StoreBundle[] | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [bundles, setBundles] = useState<StoreBundle[] | null>(caches[kind] ?? null);
  const [loading, setLoading] = useState(!caches[kind]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cached = caches[kind];
    if (cached) {
      setBundles(cached);
      setLoading(false);
    } else {
      setBundles(null);
      setLoading(true);
    }
    setError(null);
    browseBundles(kind, "top", "")
      .then((list) => {
        if (cancelled) return;
        caches[kind] = list;
        setBundles(list);
      })
      .catch(
        (e) =>
          !cancelled &&
          setError(e instanceof Error ? e.message : t("Could not reach the bundle library.")),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kind, tick]);

  return {
    bundles,
    loading,
    error,
    reload: () => {
      delete caches[kind];
      setTick((t) => t + 1);
    },
  };
}
