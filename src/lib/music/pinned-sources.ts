import { idbCacheGet, idbCacheSet } from "@/lib/idb-cache";
import type { MusicTrack } from "./types";

const STORE_KEY = "harbor.music.pinned-sources.v1";
const LIMIT = 4000;

export type PinnedSource = { connectorId: string; id: string };

let pins: Map<string, PinnedSource> | null = null;
let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** A song is the recording, not the upload that happened to answer for it last time. */
export function pinnedSourceKey(track: Pick<MusicTrack, "title" | "artist">): string {
  const part = (value: string) =>
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const title = part(track.title ?? "");
  const artist = part(track.artist ?? "");
  return title && artist ? `${artist}|${title}` : "";
}

export function loadPinnedSources(): Promise<void> {
  if (pins) return Promise.resolve();
  loading ??= idbCacheGet(STORE_KEY)
    .then((entry) => {
      const rows = Array.isArray(entry?.data) ? entry.data : [];
      pins = new Map();
      for (const row of rows) {
        if (!Array.isArray(row) || typeof row[0] !== "string") continue;
        const value = row[1] as Partial<PinnedSource> | undefined;
        if (!value || typeof value.connectorId !== "string" || typeof value.id !== "string") continue;
        pins.set(row[0], { connectorId: value.connectorId, id: value.id });
      }
    })
    .catch(() => {
      pins = new Map();
    });
  return loading;
}

function persist(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!pins) return;
    const rows = [...pins.entries()].slice(-LIMIT);
    void idbCacheSet(STORE_KEY, { at: Date.now(), data: rows }).catch(() => {});
  }, 400);
}

export function peekPinnedSource(track: Pick<MusicTrack, "title" | "artist">): PinnedSource | null {
  const key = pinnedSourceKey(track);
  return key ? (pins?.get(key) ?? null) : null;
}

export function pinSourceFor(track: MusicTrack): void {
  const key = pinnedSourceKey(track);
  const connectorId = track.connectorId ?? "";
  if (!key || !connectorId || !track.id) return;
  pins ??= new Map();
  pins.delete(key);
  pins.set(key, { connectorId, id: track.id });
  while (pins.size > LIMIT) pins.delete(pins.keys().next().value!);
  persist();
}

export function unpinSourceFor(track: Pick<MusicTrack, "title" | "artist">): void {
  const key = pinnedSourceKey(track);
  if (!key || !pins?.delete(key)) return;
  persist();
}
