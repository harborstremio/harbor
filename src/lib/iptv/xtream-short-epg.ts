import type { EpgIndex, EpgProgram, IptvChannel } from "./types";
import { fetchXtreamShortEpg, type XtreamCreds } from "./xtream";

function streamIdOf(ch: IptvChannel): string | null {
  const m = ch.id.match(/::xt::(\d+)$/);
  return m ? m[1] : null;
}

export async function hydrateShortEpg(
  creds: XtreamCreds,
  channels: IptvChannel[],
  base: EpgIndex | null,
): Promise<EpgIndex | null> {
  const byChannel = new Map<string, EpgProgram[]>(base?.byChannel ?? []);
  let added = false;
  for (const ch of channels) {
    const key = ch.tvgId || ch.id;
    if (byChannel.get(key)?.length) continue;
    const streamId = streamIdOf(ch);
    if (!streamId) continue;
    const rows = await fetchXtreamShortEpg(creds, streamId);
    if (rows.length === 0) continue;
    byChannel.set(
      key,
      rows
        .map((r) => ({
          channelTvgId: key,
          title: r.title,
          description: r.description,
          startMs: r.startMs,
          endMs: r.endMs,
          category: null,
          iconUrl: null,
        }))
        .sort((a, b) => a.startMs - b.startMs),
    );
    added = true;
  }
  if (!added) return base;
  return { byChannel, channelMeta: base?.channelMeta, fetchedAt: Date.now() };
}
