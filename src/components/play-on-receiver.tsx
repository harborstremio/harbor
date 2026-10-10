import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Meta, MetaType } from "@/lib/cinemeta";
import { queueAdd } from "@/lib/queue";
import type { PlayEpisode } from "@/lib/view";
import { isTauri } from "./play-on-lan";

type InboundQueue = {
  action: "queueMeta";
  metaId: string;
  metaType?: string;
  name?: string;
  poster?: string;
  season?: number;
  episode?: number;
};

const META_TYPES: MetaType[] = ["movie", "series", "channel", "tv", "anime", "other", "manga"];

function readQueueCommand(raw: string): InboundQueue | null {
  try {
    const parsed = JSON.parse(raw) as { t?: string; command?: InboundQueue };
    if (parsed?.t !== "cmd") return null;
    const command = parsed.command;
    if (!command || command.action !== "queueMeta") return null;
    if (typeof command.metaId !== "string" || !command.metaId) return null;
    return command;
  } catch {
    return null;
  }
}

function toMeta(command: InboundQueue): Meta {
  const type = META_TYPES.find((candidate) => candidate === command.metaType) ?? "movie";
  return { id: command.metaId, type, name: command.name ?? "" , poster: command.poster };
}

function toEpisode(command: InboundQueue): PlayEpisode | undefined {
  if (typeof command.season !== "number" || typeof command.episode !== "number") return undefined;
  return { season: command.season, episode: command.episode };
}

export function PlayOnReceiver() {
  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    void listen<{ clientId: number; raw: string }>("remote://cmd", (event) => {
      const raw = event.payload?.raw;
      if (!raw) return;
      const command = readQueueCommand(raw);
      if (!command) return;
      queueAdd(toMeta(command), toEpisode(command));
    }).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  return null;
}
