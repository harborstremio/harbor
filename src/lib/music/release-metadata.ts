import { safeFetch } from "@/lib/safe-fetch";
import type { MusicCatalogItem } from "./types";

type MetadataKind = "track" | "album" | "artist";
type MetadataItem = Pick<MusicCatalogItem, "id" | "kind" | "connectorId">;
type Target = { id: string; kind: MetadataKind; numericId: number };
type ObjectValue = Record<string, unknown>;

export type MusicReleaseDetails = {
  id: string;
  kind: MetadataKind;
  releaseDate?: string;
  recordLabel?: string;
  genres: string[];
  contributors: string[];
  explicit?: boolean;
  albumCount?: number;
  fanCount?: number;
  albumId?: number;
};

const cache = new Map<string, { expires: number; value: MusicReleaseDetails }>();
const CACHE_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const REQUEST_MS = 10_000;

function record(value: unknown): ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as ObjectValue)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.slice(0, 50).flatMap((entry) => {
        const item = record(entry);
        const name = text(item.name);
        return count(item.id) && name ? [name] : [];
      }),
    ),
  ];
}

function releaseDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

function targetFor(item: MetadataItem): Target | null {
  if (item.connectorId !== "catalog" && item.connectorId !== "deezer") return null;
  const match = /^deezer:(track|album|artist):([1-9]\d*)$/.exec(item.id);
  if (!match || match[1] !== item.kind) return null;
  const numericId = Number(match[2]);
  return Number.isSafeInteger(numericId)
    ? { id: item.id, kind: match[1] as MetadataKind, numericId }
    : null;
}

export function parseMusicReleaseMetadata(
  value: unknown,
  item: MetadataItem,
): MusicReleaseDetails | null {
  const target = targetFor(item);
  const entry = record(value);
  if (!target || entry.error || entry.id !== target.numericId || entry.type !== target.kind)
    return null;
  if (target.kind === "artist")
    return {
      id: target.id,
      kind: target.kind,
      genres: [],
      contributors: [],
      albumCount: count(entry.nb_album),
      fanCount: count(entry.nb_fan),
    };
  return {
    id: target.id,
    kind: target.kind,
    releaseDate: releaseDate(entry.release_date),
    recordLabel: target.kind === "album" ? text(entry.label) : undefined,
    genres: target.kind === "album" ? names(record(entry.genres).data) : [],
    contributors: names(entry.contributors),
    explicit: typeof entry.explicit_lyrics === "boolean" ? entry.explicit_lyrics : undefined,
    albumId: target.kind === "track" ? count(record(entry.album).id) || undefined : undefined,
  };
}

async function entity(target: Target, signal: AbortSignal): Promise<MusicReleaseDetails> {
  signal.throwIfAborted();
  const saved = cache.get(target.id);
  if (saved && saved.expires > Date.now()) return saved.value;
  const response = await safeFetch(`https://api.deezer.com/${target.kind}/${target.numericId}`, {
    signal,
  });
  if (!response.ok) throw new Error("Music metadata is unavailable");
  const value = parseMusicReleaseMetadata(await response.json(), {
    id: target.id,
    kind: target.kind,
    connectorId: "catalog",
  });
  signal.throwIfAborted();
  if (!value) throw new Error("Music metadata did not match the requested item");
  cache.delete(target.id);
  cache.set(target.id, { expires: Date.now() + CACHE_MS, value });
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  return value;
}

export async function loadMusicReleaseMetadata(
  item: MetadataItem,
  signal?: AbortSignal,
): Promise<MusicReleaseDetails | null> {
  const target = targetFor(item);
  if (!target) return null;
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Timed out", "TimeoutError")),
    REQUEST_MS,
  );
  try {
    const result = await entity(target, controller.signal);
    controller.signal.throwIfAborted();
    if (result.kind !== "track" || !result.albumId) return result;
    try {
      // Album fields come only from the album explicitly linked by this exact track.
      const album = await entity(
        {
          id: `deezer:album:${result.albumId}`,
          kind: "album",
          numericId: result.albumId,
        },
        controller.signal,
      );
      controller.signal.throwIfAborted();
      return { ...result, recordLabel: album.recordLabel, genres: album.genres };
    } catch (error) {
      if (controller.signal.aborted) throw error;
      return result;
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
