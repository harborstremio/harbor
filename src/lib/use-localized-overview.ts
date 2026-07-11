import type { Meta } from "@/lib/cinemeta";
import { tmdbMetadataOverview } from "@/lib/providers/tmdb/tmdb-lite";
import { useSettings } from "@/lib/settings";
import { useEffect, useState } from "react";

export function useLocalizedOverview(meta: Meta): string | undefined {
  const { settings } = useSettings();
  const isTmdb = meta.id.startsWith("tmdb:");
  const [overview, setOverview] = useState<string | undefined>(isTmdb ? undefined : meta.description);
  useEffect(() => {
    if (!isTmdb || !settings.tmdbKey) {
      setOverview(meta.description);
      return;
    }
    setOverview(undefined);
    let alive = true;
    void tmdbMetadataOverview(settings.tmdbKey, meta.id).then((o) => {
      if (alive) setOverview(o ?? meta.description);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id, settings.tmdbKey]);
  return overview;
}
