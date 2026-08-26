import { useEffect } from "react";
import { isBundledEngineUrl } from "@/lib/stremio-server";
import { setTrickplayState, trickplaySetUrl, trickplaySpawnEager, trickplayStop } from "@/lib/trickplay";

export function useTrickplay({ url, enabled, isLive }: { url: string; enabled: boolean; isLive?: boolean }) {
  useEffect(() => {
    if (!enabled || !url || isLive) {
      setTrickplayState({ active: false, bufferedOnly: false });
      return;
    }
    const isTorrent = isBundledEngineUrl(url);
    setTrickplayState({ active: true, bufferedOnly: isTorrent });
    let alive = true;
    void trickplaySetUrl(url).then(() => {
      if (!alive) return;
      if (!isLive) void trickplaySpawnEager();
    });
    return () => {
      alive = false;
      setTrickplayState({ active: false, bufferedOnly: false });
      void trickplayStop();
    };
  }, [url, enabled, isLive]);
}
