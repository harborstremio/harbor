import { useCallback, useEffect, useState } from "react";
import { torrentEngineList, type TorrentListItem } from "@/lib/torrent/local-engine";

export function useActiveTorrents(active: boolean): {
  items: TorrentListItem[];
  refresh: () => void;
} {
  const [items, setItems] = useState<TorrentListItem[]>([]);

  const refresh = useCallback(() => {
    void torrentEngineList().then(setItems);
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const tick = () => {
      void torrentEngineList().then((list) => {
        if (!cancelled) setItems(list);
      });
    };
    tick();
    const id = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active]);

  return { items, refresh };
}
