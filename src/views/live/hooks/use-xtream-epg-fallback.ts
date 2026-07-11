import type { EpgIndex, IptvChannel, IptvPlaylistSource } from "@/lib/iptv/types";
import { credsFromServer } from "@/lib/iptv/xtream";
import { hydrateShortEpg } from "@/lib/iptv/xtream-short-epg";
import { useEffect, useMemo, useState } from "react";

const MAX_CHANNELS = 120;

export function useXtreamEpgFallback(
  source: IptvPlaylistSource | null,
  channels: IptvChannel[],
  base: EpgIndex | null,
): EpgIndex | null {
  const [augmented, setAugmented] = useState<EpgIndex | null>(null);

  const creds = useMemo(() => {
    if (source?.kind !== "xtream" || !source.xtream) return null;
    return credsFromServer(source.xtream.server, source.xtream.username, source.xtream.password);
  }, [source?.kind, source?.xtream]);

  const baseEmpty = !base || base.byChannel.size === 0;
  const subset = useMemo(() => channels.slice(0, MAX_CHANNELS), [channels]);

  useEffect(() => {
    if (!creds || !baseEmpty || subset.length === 0) {
      setAugmented(null);
      return;
    }
    let cancelled = false;
    hydrateShortEpg(creds, subset, base)
      .then((idx) => {
        if (!cancelled && idx && idx !== base) setAugmented(idx);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [creds, baseEmpty, subset, base]);

  return augmented && baseEmpty ? augmented : base;
}
