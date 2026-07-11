import type { Meta } from "@/lib/cinemeta";
import { getCachedHydration, hydrateChannel } from "@/lib/iptv/channel-hydration";
import { useEffect, useRef, useState } from "react";

const BATCH_SIZE = 16;
const BATCH_DELAY_MS = 0;

export function useChannelHydration(channelNames: string[]): Map<string, Meta | null> {
  const [hydrations, setHydrations] = useState<Map<string, Meta | null>>(() => {
    const map = new Map<string, Meta | null>();
    for (const n of channelNames) {
      const cached = getCachedHydration(n);
      if (cached !== undefined) map.set(n, cached);
    }
    return map;
  });
  const queueRef = useRef<string[]>([]);
  const runningRef = useRef(false);

  useEffect(() => {
    const pending: string[] = [];
    setHydrations((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const n of channelNames) {
        if (next.has(n)) continue;
        const cached = getCachedHydration(n);
        if (cached !== undefined) {
          next.set(n, cached);
          changed = true;
        } else {
          pending.push(n);
        }
      }
      return changed ? next : prev;
    });
    if (pending.length === 0) return;
    queueRef.current.push(...pending);
    if (!runningRef.current) runQueue();
  }, [channelNames.join("|")]);

  const runQueue = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    while (queueRef.current.length > 0) {
      const batch = queueRef.current.splice(0, BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (name) => {
          try {
            const meta = await hydrateChannel(name);
            return [name, meta] as const;
          } catch {
            return [name, null] as const;
          }
        }),
      );
      setHydrations((prev) => {
        const next = new Map(prev);
        for (const [name, meta] of results) next.set(name, meta);
        return next;
      });
      if (queueRef.current.length > 0) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }
    runningRef.current = false;
  };

  return hydrations;
}
