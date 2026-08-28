import type { Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import { resolveStream, shouldPreferP2pDownload } from "@/lib/streams/resolve";
import type { ScoredStream } from "@/lib/streams/types";
import type { PlayEpisode } from "@/lib/view";
import { activeDownloadFor, enqueueDownload } from "@/lib/download/downloads-store";
import { seasonPackFileMatchesEpisode, streamForSeasonPackEpisode } from "./season-pack";

const MAX_CONCURRENT = 2;

function limiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const release = () => {
    active -= 1;
    queue.shift()?.();
  };
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active += 1;
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

export function pendingSeasonEpisodes(metaId: string, episodes: PlayEpisode[]): PlayEpisode[] {
  return episodes.filter((ep) => {
    const dl = activeDownloadFor(metaId, ep.season ?? null, ep.episode ?? null);
    return !dl || dl.status === "error";
  });
}

export type SeasonDownloadResult = {
  total: number;
  queued: number;
  failed: number;
};

export async function downloadSeasonFromPack({
  meta,
  episodes,
  stream,
  streamLabel,
  debrids,
  signal,
}: {
  meta: Meta;
  episodes: PlayEpisode[];
  stream: ScoredStream;
  streamLabel: string | null;
  debrids: DebridStore[];
  signal: AbortSignal;
}): Promise<SeasonDownloadResult> {
  const targets = pendingSeasonEpisodes(meta.id, episodes);
  const result: SeasonDownloadResult = { total: targets.length, queued: 0, failed: 0 };
  if (targets.length === 0 || signal.aborted) return result;
  const packStream = streamForSeasonPackEpisode(stream);
  const preferP2p = shouldPreferP2pDownload(packStream);
  const limit = limiter(preferP2p ? 1 : MAX_CONCURRENT);
  let p2pSetupFailed = false;
  await Promise.all(
    targets.map((ep) =>
      limit(async () => {
        if (signal.aborted) return;
        if (preferP2p && p2pSetupFailed) {
          result.failed += 1;
          return;
        }
        const resolved = await resolveStream(
          packStream,
          debrids,
          signal,
          true,
          preferP2p,
          { season: ep.season ?? null, episode: ep.episode ?? null },
          true,
          false,
        ).catch(() => null);
        if (!resolved?.ok || signal.aborted) {
          if (!signal.aborted) {
            if (preferP2p) p2pSetupFailed = true;
            result.failed += 1;
          }
          return;
        }
        if (resolved.data.filename && !seasonPackFileMatchesEpisode(resolved.data.filename, ep)) {
          result.failed += 1;
          return;
        }
        try {
          await enqueueDownload({
            meta,
            episode: ep,
            streamLabel,
            url: resolved.data.url,
            headers: resolved.data.headers ?? null,
          });
          result.queued += 1;
        } catch {
          result.failed += 1;
        }
      }),
    ),
  );
  return result;
}
