import { useEffect, useState } from "react";
import {
  mediaServerConnections,
  subscribeMediaServerConnections,
} from "@/lib/media-server/connections";
import { identityMatches, mediaServerItems } from "@/lib/media-server/index-store";
import { groupMediaServerTitles } from "@/lib/media-server/selectors";
import type { MediaIdentity, MediaServerConnection } from "@/lib/media-server/types";

function titleIdentity(
  metaId: string | undefined,
  imdbId: string | null | undefined,
): MediaIdentity {
  const tmdb = metaId?.match(/^tmdb:(?:movie|tv|series):(\d+)$/);
  return {
    tmdbId: tmdb ? Number(tmdb[1]) : undefined,
    imdbId: imdbId ?? (metaId?.startsWith("tt") ? metaId : undefined),
  };
}

export function useTitleMediaServers(
  metaId: string | undefined,
  imdbId?: string | null,
): MediaServerConnection[] {
  const [matches, setMatches] = useState<MediaServerConnection[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const identity = titleIdentity(metaId, imdbId);
      if (identity.tmdbId == null && !identity.imdbId) {
        if (alive) setMatches([]);
        return;
      }
      const connections = mediaServerConnections().filter((connection) => connection.enabled);
      const enabled = new Set(connections.map((connection) => connection.id));
      const titles = groupMediaServerTitles(
        (await mediaServerItems()).filter((item) => enabled.has(item.connectionId)),
      );
      const connectionIds = new Set(
        titles
          .filter((title) => identityMatches(title.identity, identity))
          .flatMap((title) => title.connectionIds),
      );
      if (alive) setMatches(connections.filter((connection) => connectionIds.has(connection.id)));
    };
    void load().catch(() => {
      if (alive) setMatches([]);
    });
    const unsubscribe = subscribeMediaServerConnections(() => void load());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [metaId, imdbId]);

  return matches;
}
