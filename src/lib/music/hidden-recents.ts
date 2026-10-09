import { useSyncExternalStore } from "react";
import { readMusicPreference, writeMusicPreference } from "./preferences";

const KEY = "harbor.music.recents.hidden.v1";

function read(): string[] {
  try {
    const value = JSON.parse(readMusicPreference(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

let hidden = read();
const listeners = new Set<() => void>();

function commit(next: string[]): void {
  hidden = next.slice(-200);
  writeMusicPreference(KEY, JSON.stringify(hidden));
  listeners.forEach((listener) => listener());
}

export function hideMusicRecent(id: string): void {
  if (!id || hidden.includes(id)) return;
  commit([...hidden, id]);
}

export function unhideMusicRecent(id: string): void {
  if (!id || !hidden.includes(id)) return;
  commit(hidden.filter((entry) => entry !== id));
}

export function useHiddenMusicRecents(): string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => hidden,
    () => hidden,
  );
}

export function isMusicRecentHidden(id: string): boolean {
  return hidden.includes(id);
}
