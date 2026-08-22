const KEY = "harbor.resume";

type Entry = { ms: number; t: number; s?: number; e?: number };

function entryKey(id: string, season?: number, episode?: number): string {
  if (typeof season === "number" && typeof episode === "number") {
    return `${id}|s${season}e${episode}`;
  }
  return id;
}

function readAll(): Record<string, Entry> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Entry>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Entry>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* noop */
  }
}

export function saveResumeMs(
  id: string,
  ms: number,
  season?: number,
  episode?: number,
  displaySeason?: number,
  displayEpisode?: number,
): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  if (typeof season === "number" && typeof episode === "number") {
    if (season < 0 || episode < 1) return;
  }
  const all = readAll();
  const s = typeof displaySeason === "number" && displaySeason >= 1 ? displaySeason : undefined;
  const e = typeof displayEpisode === "number" && displayEpisode >= 1 ? displayEpisode : undefined;
  all[entryKey(id, season, episode)] = {
    ms,
    t: Date.now(),
    ...(s !== undefined ? { s } : {}),
    ...(e !== undefined ? { e } : {}),
  };
  writeAll(all);
}

export function saveResumeBatch(
  entries: {
    id: string;
    ms: number;
    season?: number;
    episode?: number;
    displaySeason?: number;
    displayEpisode?: number;
    t?: number;
  }[],
): void {
  if (entries.length === 0) return;
  const all = readAll();
  const now = Date.now();
  for (const e of entries) {
    if (!Number.isFinite(e.ms) || e.ms < 0) continue;
    if (typeof e.season === "number" && typeof e.episode === "number") {
      if (e.season < 0 || e.episode < 1) continue;
    }
    const key = entryKey(e.id, e.season, e.episode);
    const s =
      typeof e.displaySeason === "number" && e.displaySeason >= 1 ? e.displaySeason : all[key]?.s;
    const displayEpisode =
      typeof e.displayEpisode === "number" && e.displayEpisode >= 1
        ? e.displayEpisode
        : all[key]?.e;
    all[key] = {
      ms: e.ms,
      t: e.t ?? now,
      ...(s !== undefined ? { s } : {}),
      ...(displayEpisode !== undefined ? { e: displayEpisode } : {}),
    };
  }
  writeAll(all);
}

export function readResumeMs(id: string, season?: number, episode?: number): number {
  const all = readAll();
  return all[entryKey(id, season, episode)]?.ms ?? 0;
}

export function readResumeEntry(
  id: string,
  season?: number,
  episode?: number,
): { ms: number; t: number; displaySeason?: number; displayEpisode?: number } | null {
  const all = readAll();
  const e = all[entryKey(id, season, episode)];
  return e
    ? {
        ms: e.ms,
        t: e.t,
        ...(e.s !== undefined ? { displaySeason: e.s } : {}),
        ...(e.e !== undefined ? { displayEpisode: e.e } : {}),
      }
    : null;
}

export function clearResume(id: string, season?: number, episode?: number): void {
  const all = readAll();
  delete all[entryKey(id, season, episode)];
  writeAll(all);
}

export function lastPlayedEpisode(seriesId: string): {
  season: number;
  episode: number;
  ms: number;
  t: number;
  displaySeason?: number;
  displayEpisode?: number;
} | null {
  const all = readAll();
  const prefix = `${seriesId}|s`;
  let best: {
    season: number;
    episode: number;
    ms: number;
    t: number;
    displaySeason?: number;
    displayEpisode?: number;
  } | null = null;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(prefix)) continue;
    const m = key.match(/\|s(\d+)e(\d+)$/);
    if (!m) continue;
    const season = parseInt(m[1], 10);
    const episode = parseInt(m[2], 10);
    if (season < 1 || episode < 1) continue;
    if (!best || value.t > best.t) {
      best = {
        season,
        episode,
        ms: value.ms,
        t: value.t,
        displaySeason: value.s,
        displayEpisode: value.e,
      };
    }
  }
  return best;
}
