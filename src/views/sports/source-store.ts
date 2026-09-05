import { useSyncExternalStore } from "react";
import type { StreamKind } from "@/lib/sports/stream-resolver";

const STORE_KEY = "harbor.sports.sources.v1";

export type AttachedStream = {
  url: string;
  kind: StreamKind;
  headers?: Record<string, string>;
  page: string;
  title: string;
  poster: string;
};

export type Attachments = {
  channels: Record<string, string[]>;
  streams: Record<string, AttachedStream>;
};

let cache: Attachments | null = null;
const subs = new Set<() => void>();

function read(): Attachments {
  if (cache) return cache;
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
  } catch {}
  cache =
    "channels" in raw || "streams" in raw
      ? {
          channels: (raw.channels as Record<string, string[]> | undefined) ?? {},
          streams: (raw.streams as Record<string, AttachedStream> | undefined) ?? {},
        }
      : { channels: raw as Record<string, string[]>, streams: {} };
  return cache;
}

function write(next: Attachments): void {
  cache = next;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {}
  for (const fn of subs) fn();
}

export function toggleAttachedChannel(leagueTag: string, channelId: string): void {
  const { channels, streams } = read();
  const current = channels[leagueTag] ?? [];
  const kept = current.includes(channelId)
    ? current.filter((id) => id !== channelId)
    : [...current, channelId];
  const next = { ...channels };
  if (kept.length > 0) next[leagueTag] = kept;
  else delete next[leagueTag];
  write({ channels: next, streams });
}

export function setAttachedStream(gameId: string, stream: AttachedStream | null): void {
  const { channels, streams } = read();
  const next = { ...streams };
  if (stream) next[gameId] = stream;
  else delete next[gameId];
  write({ channels, streams: next });
}

export function useAttachments(): Attachments {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    read,
    read,
  );
}
