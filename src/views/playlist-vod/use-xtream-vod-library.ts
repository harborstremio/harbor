import { useCallback, useEffect, useState } from "react";
import type { IptvPlaylistSource } from "@/lib/iptv/types";
import {
  getXtreamVodSnapshot,
  loadXtreamVodLibrary,
  subscribeXtreamVodLibrary,
  type XtreamVodSnapshot,
} from "@/lib/iptv/xtream-vod-library";

export { clearXtreamVodLibraryCache } from "@/lib/iptv/xtream-vod-library";

export function useXtreamVodLibrary(source: IptvPlaylistSource | null) {
  const [snapshot, setSnapshot] = useState<XtreamVodSnapshot>(() =>
    getXtreamVodSnapshot(source?.id),
  );

  useEffect(() => {
    if (!source || source.kind !== "xtream") {
      setSnapshot(getXtreamVodSnapshot());
      return;
    }
    const sync = () => setSnapshot(getXtreamVodSnapshot(source.id));
    const unsubscribe = subscribeXtreamVodLibrary(sync);
    sync();
    void loadXtreamVodLibrary(source);
    return unsubscribe;
  }, [
    source?.id,
    source?.name,
    source?.url,
    source?.epgUrl,
    source?.kind,
    source?.xtream?.server,
    source?.xtream?.username,
    source?.xtream?.password,
  ]);

  const refresh = useCallback(() => {
    if (source) void loadXtreamVodLibrary(source, true);
  }, [source]);

  return {
    ...snapshot,
    loading: snapshot.moviesLoading || snapshot.seriesLoading,
    error: snapshot.movieError,
    refresh,
  };
}
