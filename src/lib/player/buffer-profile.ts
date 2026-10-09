export type BufferSizeId = "auto" | "small" | "medium" | "large" | "max";

export const BUFFER_SIZES: readonly BufferSizeId[] = [
  "auto",
  "small",
  "medium",
  "large",
  "max",
] as const;

export type BufferProfile = {
  cacheSecs: number;
  readaheadSecs: number;
  maxBytes: number;
  maxBackBytes: number;
  pauseWaitSecs: number;
};

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

export const BUFFER_PROFILES: Record<Exclude<BufferSizeId, "auto">, BufferProfile> = {
  small: {
    cacheSecs: 60,
    readaheadSecs: 20,
    maxBytes: 150 * MIB,
    maxBackBytes: 32 * MIB,
    pauseWaitSecs: 0,
  },
  medium: {
    cacheSecs: 300,
    readaheadSecs: 120,
    maxBytes: 512 * MIB,
    maxBackBytes: 64 * MIB,
    pauseWaitSecs: 4,
  },
  large: {
    cacheSecs: 600,
    readaheadSecs: 600,
    maxBytes: GIB,
    maxBackBytes: 128 * MIB,
    pauseWaitSecs: 10,
  },
  max: {
    cacheSecs: 1800,
    readaheadSecs: 1800,
    maxBytes: 2 * GIB,
    maxBackBytes: 256 * MIB,
    pauseWaitSecs: 20,
  },
};

export function isBufferSizeId(value: unknown): value is BufferSizeId {
  return (
    value === "auto" ||
    value === "small" ||
    value === "medium" ||
    value === "large" ||
    value === "max"
  );
}

export function sanitizeBufferSize(value: unknown): BufferSizeId {
  return isBufferSizeId(value) ? value : "auto";
}

export function bufferProfileFor(id: BufferSizeId): BufferProfile | null {
  return id === "auto" ? null : BUFFER_PROFILES[id];
}

export function formatMpvBytes(bytes: number): string {
  return bytes % GIB === 0 ? `${bytes / GIB}GiB` : `${Math.round(bytes / MIB)}MiB`;
}

export function formatBufferMemory(bytes: number): string {
  return bytes % GIB === 0 ? `${bytes / GIB} GB` : `${Math.round(bytes / MIB)} MB`;
}

export function bufferMpvLines(id: BufferSizeId): string[] {
  const profile = bufferProfileFor(id);
  if (!profile) return [];
  return [
    "cache=yes",
    `cache-secs=${profile.cacheSecs}`,
    `demuxer-max-bytes=${formatMpvBytes(profile.maxBytes)}`,
    `demuxer-max-back-bytes=${formatMpvBytes(profile.maxBackBytes)}`,
    `demuxer-readahead-secs=${profile.readaheadSecs}`,
    `cache-pause-initial=${profile.pauseWaitSecs > 0 ? "yes" : "no"}`,
    `cache-pause-wait=${profile.pauseWaitSecs}`,
  ];
}

export type StoredBufferChoice = {
  mpvBufferSize?: BufferSizeId;
  mpvBufferBoost?: boolean;
};

export function bufferSizeFor(stored: StoredBufferChoice): BufferSizeId {
  if (isBufferSizeId(stored.mpvBufferSize)) return stored.mpvBufferSize;
  return stored.mpvBufferBoost ? "large" : "auto";
}
