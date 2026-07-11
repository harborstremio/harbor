import { getCachedEpg, loadEpg, subscribeEpg } from "@/lib/iptv/epg-store";
import { deriveEpgUrls } from "@/lib/iptv/m3u";
import type { EpgIndex, EpgProgram, IptvPlaylistSource } from "@/lib/iptv/types";
import { findCurrent } from "@/lib/iptv/xmltv";
import { useEffect, useState } from "react";

export function useEpg(
  source: IptvPlaylistSource | null,
  extraUrls: string[] = [],
): {
  index: EpgIndex | null;
  loading: boolean;
  error: string | null;
} {
  const [index, setIndex] = useState<EpgIndex | null>(() => (source ? getCachedEpg(source.id) : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const extraKey = extraUrls.join("|");

  useEffect(() => {
    if (!source) {
      setIndex(null);
      return;
    }
    const own = source.epgUrl ? [source.epgUrl] : deriveEpgUrls(source.url);
    const urls = [...new Set([...own, ...extraUrls.filter(Boolean)])];
    if (urls.length === 0) {
      setIndex(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    loadEpg({ playlistId: source.id, urls })
      .then((idx) => {
        if (cancelled) return;
        setIndex(idx);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    const unsub = subscribeEpg(() => {
      if (cancelled) return;
      const next = getCachedEpg(source.id);
      if (next) setIndex(next);
    });
    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.id, source?.url, source?.epgUrl, extraKey]);

  return { index, loading, error };
}

export function useNowTick(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function nowOn(
  index: EpgIndex | null,
  tvgId: string | null,
  now: number,
): { current: EpgProgram | null; next: EpgProgram | null } {
  if (!index || !tvgId) return { current: null, next: null };
  const arr = index.byChannel.get(tvgId);
  return findCurrent(arr, now);
}
