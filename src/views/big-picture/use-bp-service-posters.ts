import { useEffect, useState } from "react";
import { servicePosters } from "@/lib/providers/streaming";
import { useSettings, type StreamingService } from "@/lib/settings";

const EMPTY: readonly string[] = [];

const SETTLE_MS = 180;

const cache = new Map<string, string[]>();
const inflight = new Map<string, Promise<string[]>>();

// A different key or region is a different result set, so the slot has to carry
// both. Keying on the service alone made a region change silently reuse posters
// fetched for the old one, for the rest of the session.
const slot = (service: StreamingService, key: string, region: string): string =>
  `${service}\u0000${key}\u0000${region}`;

function load(id: string, key: string, service: StreamingService, region: string): Promise<string[]> {
  const pending = inflight.get(id);
  if (pending) return pending;
  const next = servicePosters(key, service, region)
    .then((list) => {
      // Only a real answer is cached. Writing [] on a rejection would pin the
      // band to wash-only for the whole session with no retry and no error.
      cache.set(id, list);
      return list;
    })
    .catch(() => [] as string[])
    .finally(() => {
      inflight.delete(id);
    });
  inflight.set(id, next);
  return next;
}

export function useBpServicePosters(service: StreamingService | null): readonly string[] {
  const { settings } = useSettings();
  const key = settings.tmdbKey;
  const region = settings.region;
  const [, bump] = useState(0);
  const id = service ? slot(service, key, region) : "";

  useEffect(() => {
    if (!service || !key || cache.has(id)) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      void load(id, key, service, region).then(() => {
        if (alive) bump((n) => n + 1);
      });
    }, SETTLE_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [id, service, key, region]);

  if (!id) return EMPTY;
  return cache.get(id) ?? EMPTY;
}
