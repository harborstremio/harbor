import { useCallback, useEffect, useState } from "react";
import { torrentEngineList, type TorrentListItem } from "@/lib/torrent/local-engine";

function sameItems(a: TorrentListItem[], b: TorrentListItem[]): boolean {
  return a.length === b.length && a.every((item, index) => {
    const next = b[index];
    return (
      item.infoHash === next.infoHash &&
      item.name === next.name &&
      item.downloaded === next.downloaded &&
      item.total === next.total &&
      item.downloadSpeed === next.downloadSpeed &&
      item.finished === next.finished &&
      item.paused === next.paused &&
      item.state === next.state
    );
  });
}

export function useActiveTorrents(active: boolean): {
  items: TorrentListItem[];
  refresh: () => void;
} {
  const [items, setItems] = useState<TorrentListItem[]>([]);

  const apply = useCallback((next: TorrentListItem[]) => {
    setItems((current) => (sameItems(current, next) ? current : next));
  }, []);

  const refresh = useCallback(() => {
    void torrentEngineList().then(apply);
  }, [apply]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let inFlight = false;
    const tick = async () => {
      if (cancelled || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const list = await torrentEngineList();
        if (!cancelled) apply(list);
      } finally {
        inFlight = false;
      }
    };
    void tick();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const id = window.setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, apply]);

  return { items, refresh };
}
