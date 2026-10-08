import { useSyncExternalStore } from "react";
import { activeProfileId } from "@/lib/active-profile-id";
import { isCollege, type College } from "./colleges";

/**
 * Schools the viewer follows, per profile on this device. Kept apart from the team favorites,
 * whose entries are ESPN teams that Game Day fetches schedules for.
 */

const BASE_KEY = "jl.sports.colleges.follows.v1";
const empty: College[] = [];
const listeners = new Set<() => void>();
let cache: { key: string; raw: string | null; list: College[] } | null = null;

const keyFor = () => `${BASE_KEY}.${activeProfileId()}`;

export function readFollowedColleges(): College[] {
  const key = keyFor();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (cache && cache.key === key && cache.raw === raw) return cache.list;
  let list = empty;
  try {
    const value = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(value)) list = value.filter(isCollege);
  } catch {
    list = empty;
  }
  cache = { key, raw, list };
  return list;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function writeFollowedColleges(list: College[]) {
  try {
    localStorage.setItem(keyFor(), JSON.stringify(list));
  } catch {
    /* storage unavailable: nothing can be saved */
  }
  for (const fn of listeners) fn();
}

export function toggleFollowCollege(college: College) {
  const list = readFollowedColleges();
  writeFollowedColleges(
    list.some((c) => c.id === college.id)
      ? list.filter((c) => c.id !== college.id)
      : [...list, college],
  );
}

export const useFollowedColleges = () =>
  useSyncExternalStore(subscribe, readFollowedColleges, () => empty);
