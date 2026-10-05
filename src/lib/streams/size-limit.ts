import type { ParsedStream } from "./types";

export function normalizeStreamSizeLimit(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

// Unknown addon sizes remain eligible; resolution checks again when torrent
// metadata or the provider supplies the actual file size.
export function streamSizeAllowed(size: number | null | undefined, maxSizeGb: number): boolean {
  const limit = normalizeStreamSizeLimit(maxSizeGb);
  return (
    limit === 0 || size == null || !Number.isFinite(size) || size <= 0 || size <= limit * 1024 ** 3
  );
}

export function filterStreamsBySize<T extends Pick<ParsedStream, "size">>(
  streams: T[],
  maxSizeGb: number,
): T[] {
  return streams.filter((stream) => streamSizeAllowed(stream.size, maxSizeGb));
}

export function readStreamSizeLimit(): number {
  try {
    return normalizeStreamSizeLimit(
      JSON.parse(localStorage.getItem("harbor.settings") ?? "{}").maxStreamSizeGb,
    );
  } catch {
    return 0;
  }
}
