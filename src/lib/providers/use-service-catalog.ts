import { useCallback, useEffect, useMemo, useState } from "react";
import { SERVICES, providerIdsFor } from "@/lib/providers/streaming";
import {
  MAX_PER_BUCKET,
  dedupe,
  fetchCategoryBatch,
  type Bucket,
  type Category,
} from "@/lib/providers/service-catalog";
import { useSettings, type StreamingService } from "@/lib/settings";

export function useServiceCatalog(service: StreamingService, category: Category) {
  const { settings } = useSettings();
  const [bucket, setBucket] = useState<Bucket>({ movies: [], series: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setBucket({ movies: [], series: [] });
    setBatch(0);
    setLoading(true);
    setHasMore(true);
  }, [service, category.id, settings.tmdbKey, settings.region]);

  useEffect(() => {
    if (bucket.movies.length >= MAX_PER_BUCKET && bucket.series.length >= MAX_PER_BUCKET) {
      setHasMore(false);
    }
  }, [bucket.movies.length, bucket.series.length]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    fetchCategoryBatch(
      settings.tmdbKey,
      providerIdsFor(SERVICES[service]),
      settings.region,
      category,
      batch,
    )
      .then((b) => {
        if (cancelled) return;
        if (b.movies.length === 0 && b.series.length === 0) setHasMore(false);
        setBucket((prev) => {
          if (batch === 0) return { movies: b.movies, series: b.series };
          return {
            movies: dedupe([...prev.movies, ...b.movies]).slice(0, MAX_PER_BUCKET),
            series: dedupe([...prev.series, ...b.series]).slice(0, MAX_PER_BUCKET),
          };
        });
        setLoading(false);
        setBusy(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batch, service, category, settings.tmdbKey, settings.region]);

  const metas = useMemo(() => dedupe([...bucket.movies, ...bucket.series]), [bucket]);

  const loadMore = useCallback(() => {
    if (busy || loading || !hasMore) return;
    setBatch((b) => b + 1);
  }, [busy, loading, hasMore]);

  return { bucket, metas, loading, busy, hasMore, loadMore, hasKey: !!settings.tmdbKey };
}
