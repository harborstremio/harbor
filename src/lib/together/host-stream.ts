import { parseStream } from "@/lib/streams/parser/parser-stream";
import type { ScoredStream, Tier } from "@/lib/streams/types";
import type { SourceDescriptor } from "@/lib/together/protocol";
import { directStreamAvailable } from "@/lib/torrent/stremio-stream";

function tierForResolution(res: string): Tier {
  if (res === "4K") return "4K";
  if (res === "1080p") return "1080p";
  if (res === "720p") return "720p";
  return "SD";
}

export function hostSourceStream(d: SourceDescriptor): ScoredStream | null {
  if (!d.infoHash) return null;
  if (!directStreamAvailable({ infoHash: d.infoHash })) return null;
  const title = [d.title, d.resolution].filter(Boolean).join(" ") || "Host stream";
  const parsed = parseStream({
    name: "Watch Together",
    title,
    infoHash: d.infoHash,
    fileIdx: d.fileIdx ?? undefined,
    addonId: "watch-together-host",
    addonName: "Host",
  });
  return {
    ...parsed,
    seeders: parsed.seeders ?? null,
    size: parsed.size ?? d.sizeBytes ?? null,
    score: 0,
    reasons: [],
    tier: tierForResolution(parsed.resolution),
  };
}
