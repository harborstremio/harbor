import { useEffect, useState, useSyncExternalStore } from "react";
import { useSettings } from "@/lib/settings";
import {
  NYT_PRIMARY_LIST,
  nytList,
  readNytSnapshot,
  resetNytBackoff,
  startNytAutoRefresh,
  subscribeNytSnapshot,
  type NytList,
  type NytSnapshot,
} from "./nyt";
import {
  nytAvailabilityVersion,
  resolveNytBooks,
  subscribeNytAvailability,
} from "./nyt-availability";

export function useNytSnapshot(): NytSnapshot | null {
  const { settings } = useSettings();
  const key = settings.nytKey?.trim() ?? "";
  const [snap, setSnap] = useState<NytSnapshot | null>(() => readNytSnapshot());

  useEffect(() => subscribeNytSnapshot(setSnap), []);

  useEffect(() => {
    if (!key) return;
    resetNytBackoff();
    return startNytAutoRefresh(() => key);
  }, [key]);

  return snap;
}

export function useNytList(encodedName = NYT_PRIMARY_LIST): NytList | null {
  return nytList(useNytSnapshot(), encodedName);
}

export function useNytAvailability(): number {
  return useSyncExternalStore(
    subscribeNytAvailability,
    nytAvailabilityVersion,
    nytAvailabilityVersion,
  );
}

export function useResolveNytBooks(list: NytList | null, count: number): void {
  useEffect(() => {
    if (!list) return;
    void resolveNytBooks(list.books.slice(0, count));
  }, [list, count]);
}
