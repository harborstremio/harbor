import { safeFetch } from "@/lib/safe-fetch";

export type F1Driver = {
  driverId: string;
  givenName: string;
  familyName: string;
  permanentNumber?: string;
  code?: string;
  dateOfBirth: string;
  nationality: string;
};
export type F1Standing = {
  position: string;
  points: string;
  wins: string;
  Driver: F1Driver;
  Constructors: { constructorId: string; name: string }[];
};
export type F1ConstructorStanding = {
  position: string;
  points: string;
  wins: string;
  Constructor: { constructorId: string; name: string };
};
export type F1Race = {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: { locality: string; country: string };
  };
  Results?: {
    position: string;
    positionText: string;
    grid: string;
    points: string;
    status: string;
  }[];
};
export type F1Response = {
  MRData: {
    total: string;
    StandingsTable?: {
      season: string;
      round: string;
      StandingsLists: {
        season: string;
        round: string;
        DriverStandings?: F1Standing[];
        ConstructorStandings?: F1ConstructorStanding[];
      }[];
    };
    RaceTable?: { Races: F1Race[] };
  };
};
type Entry = { at: number; data: F1Response };
const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();
let queue = Promise.resolve();
let lastStarted = 0;
const PREFIX = "harbor.sports.f1.v1:";
export function readF1(path: string): Entry | undefined {
  const cached = memory.get(path);
  if (cached && Date.now() - cached.at < 7 * 86400_000) return cached;
  try {
    const value = JSON.parse(localStorage.getItem(PREFIX + path) || "null");
    if (
      value?.data?.MRData &&
      typeof value.at === "number" &&
      Date.now() - value.at < 7 * 86400_000
    ) {
      memory.set(path, value);
      return value;
    }
  } catch {}
}
export function fetchF1(path: string, force = false): Promise<Entry> {
  if (!/^[a-zA-Z0-9_/?=.-]+$/.test(path)) return Promise.reject(new Error("Invalid F1 resource"));
  const hit = readF1(path);
  if (!force && hit && Date.now() - hit.at < 15 * 60_000) return Promise.resolve(hit);
  if (inflight.has(path)) return inflight.get(path)!;
  const run = async () => {
    // Jolpica's public API permits four requests/second. Queue starts and cache across views.
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, 350 - (Date.now() - lastStarted))),
    );
    lastStarted = Date.now();
    const headers =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
        ? { "User-Agent": "Harbor/0.9.124" }
        : undefined;
    const response = await safeFetch(`https://api.jolpi.ca/ergast/f1/${path}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`F1 feed ${response.status}`);
    const data = (await response.json()) as F1Response;
    if (!data.MRData) throw new Error("Invalid F1 data");
    const entry = { at: Date.now(), data };
    memory.set(path, entry);
    if (memory.size > 80) memory.delete(memory.keys().next().value!);
    try {
      localStorage.setItem(PREFIX + path, JSON.stringify(entry));
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(PREFIX));
      if (keys.length > 80) {
        const oldest = keys.sort(
          (a, b) =>
            JSON.parse(localStorage.getItem(a) || "{}").at -
            JSON.parse(localStorage.getItem(b) || "{}").at,
        );
        for (const key of oldest.slice(0, keys.length - 80)) localStorage.removeItem(key);
      }
    } catch {}
    return entry;
  };
  const task = queue.then(run);
  queue = task.then(
    () => undefined,
    () => undefined,
  );
  inflight.set(path, task);
  void task.finally(() => inflight.delete(path)).catch(() => {});
  return task;
}
