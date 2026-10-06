import { useSyncExternalStore } from "react";
import { activeProfileId } from "@/lib/active-profile-id";
import type { JlFavoriteTeam } from "./rank";

const BASE_KEY = "jl.sports.favorites.v1";
const EMPTY: JlFavoriteTeam[] = [];

const listeners = new Set<() => void>();
let cache: { key: string; raw: string | null; list: JlFavoriteTeam[] } | null = null;

function keyFor(): string {
  return `${BASE_KEY}.${activeProfileId()}`;
}

function parse(raw: string | null): JlFavoriteTeam[] {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return EMPTY;
    return value.filter(
      (f): f is JlFavoriteTeam =>
        !!f && typeof f.league === "string" && typeof f.id === "string" && typeof f.name === "string",
    );
  } catch {
    return EMPTY;
  }
}

function snapshot(): JlFavoriteTeam[] {
  const key = keyFor();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (cache && cache.key === key && cache.raw === raw) return cache.list;
  cache = { key, raw, list: parse(raw) };
  return cache.list;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function write(list: JlFavoriteTeam[]): void {
  try {
    localStorage.setItem(keyFor(), JSON.stringify(list));
  } catch {
    /* storage unavailable: nothing can be saved */
  }
  for (const fn of listeners) fn();
}

export function isFollowing(list: JlFavoriteTeam[], league: string, id: string): boolean {
  return list.some((f) => f.league === league && f.id === id);
}

export function toggleFavoriteTeam(team: JlFavoriteTeam): void {
  if (!team.id) return;
  const list = snapshot();
  write(
    isFollowing(list, team.league, team.id)
      ? list.filter((f) => !(f.league === team.league && f.id === team.id))
      : [...list, team],
  );
}

export function useJlSportsFavorites(): JlFavoriteTeam[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
