import type { PlayerSrc, PlayerStreamRef, PlayerSubtitleHints } from "@/lib/view";

export function trustedPlayerImdbId(
  src: Pick<PlayerSrc, "imdbId" | "imdbIdVerified" | "meta">,
): string | undefined {
  if (src.imdbIdVerified === true && /^tt\d+$/.test(src.imdbId ?? "")) return src.imdbId;
  return /^tt\d+$/.test(src.meta.id) ? src.meta.id : undefined;
}

export function playerSubtitleMetadataId(src: Pick<PlayerSrc, "meta" | "tmdbId">): string {
  if (src.tmdbId == null) return src.meta.id;
  const kind = src.meta.type === "series" ? "tv" : "movie";
  return `tmdb:${kind}:${src.tmdbId}`;
}

export function subtitleHintsFromStreamRef(
  streamRef: PlayerStreamRef | undefined,
): PlayerSubtitleHints | undefined {
  if (!streamRef) return undefined;
  return {
    filename: streamRef.parsedTitle ?? streamRef.title ?? undefined,
    release: streamRef.title ?? streamRef.parsedTitle ?? null,
    source: streamRef.source ?? null,
    resolution: streamRef.resolution ?? null,
    size: streamRef.size ?? null,
  };
}

export function resolvePlayerSubtitleHints(
  src: Pick<PlayerSrc, "streamRef" | "subtitleHints">,
): PlayerSubtitleHints {
  const fallback = subtitleHintsFromStreamRef(src.streamRef);
  return {
    filename: src.subtitleHints?.filename ?? fallback?.filename,
    release: src.subtitleHints?.release ?? fallback?.release,
    source: src.subtitleHints?.source ?? fallback?.source,
    resolution: src.subtitleHints?.resolution ?? fallback?.resolution,
    size: src.subtitleHints?.size ?? fallback?.size,
  };
}
