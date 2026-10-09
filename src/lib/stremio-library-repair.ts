import { ANIME_CLOUD_ID, library, libraryPut, type LibraryItem } from "@/lib/stremio";


export type RepairProgress = {
  phase: "fetching" | "normalizing" | "pushing" | "done";
  fetched?: number;
  total?: number;
  needsRepair?: number;
  pushed?: number;
};

export type RepairResult = {
  total: number;
  alreadyClean: number;
  repaired: number;
  unrepairable: number;
};

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function asBool(v: unknown): boolean {
  return v === true;
}
function pickPosterShape(v: unknown): "square" | "landscape" | "poster" {
  return v === "square" || v === "landscape" || v === "poster" ? v : "poster";
}
function normalizeWatched(v: unknown): string | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const parts = v.split(":");
  if (parts.length < 3) return null;
  const len = Number.parseInt(parts[parts.length - 2], 10);
  if (!Number.isFinite(len)) return null;
  return v;
}

function normalizeItem(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = asString(r._id);
  if (!id) return null;
  const srcState = (r.state && typeof r.state === "object" ? r.state : {}) as Record<string, unknown>;
  const srcHints = (r.behaviorHints && typeof r.behaviorHints === "object" ? r.behaviorHints : {}) as Record<string, unknown>;
  return {
    _id: id,
    name: asString(r.name) ?? "",
    type: asString(r.type) ?? "movie",
    poster: asString(r.poster),
    posterShape: pickPosterShape(r.posterShape),
    removed: asBool(r.removed),
    temp: asBool(r.temp),
    _ctime: asString(r._ctime),
    _mtime: asString(r._mtime) ?? new Date().toISOString(),
    state: {
      lastWatched: asString(srcState.lastWatched),
      timeWatched: asNumber(srcState.timeWatched),
      timeOffset: asNumber(srcState.timeOffset),
      overallTimeWatched: asNumber(srcState.overallTimeWatched),
      timesWatched: asNumber(srcState.timesWatched),
      flaggedWatched: asNumber(srcState.flaggedWatched),
      duration: asNumber(srcState.duration),
      video_id: asString(srcState.video_id) ?? asString(srcState.videoId),
      watched: normalizeWatched(srcState.watched),
      lastVidReleased: asString(srcState.lastVidReleased),
      noNotif: asBool(srcState.noNotif),
    },
    behaviorHints: {
      defaultVideoId: asString(srcHints.defaultVideoId),
      featuredVideoId: asString(srcHints.featuredVideoId),
      hasScheduledVideos: asBool(srcHints.hasScheduledVideos),
    },
  };
}

function differs(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export async function repairStremioLibrary(
  authKey: string,
  onProgress?: (p: RepairProgress) => void,
): Promise<RepairResult> {
  onProgress?.({ phase: "fetching" });
  const items = await library(authKey);
  onProgress?.({ phase: "fetching", total: items.length });

  onProgress?.({ phase: "normalizing", total: items.length, fetched: items.length });
  const toPush: Record<string, unknown>[] = [];
  let unrepairable = 0;
  for (const raw of items) {
    const normalized = normalizeItem(raw);
    if (!normalized) {
      unrepairable++;
      continue;
    }
    const nid = String((normalized as { _id?: unknown })._id ?? "");
    if (ANIME_CLOUD_ID.test(nid) && (normalized as { removed?: unknown }).removed !== true) continue;
    if (differs(raw, normalized)) toPush.push(normalized);
  }
  onProgress?.({ phase: "normalizing", total: items.length, needsRepair: toPush.length });

  let pushed = 0;
  const BATCH = 25;
  for (let i = 0; i < toPush.length; i += BATCH) {
    const slice = toPush.slice(i, i + BATCH);
    for (const item of slice) await libraryPut(authKey, item as unknown as LibraryItem);
    pushed += slice.length;
    onProgress?.({ phase: "pushing", total: items.length, needsRepair: toPush.length, pushed });
  }

  const result: RepairResult = {
    total: items.length,
    alreadyClean: items.length - toPush.length - unrepairable,
    repaired: pushed,
    unrepairable,
  };
  onProgress?.({ phase: "done", ...result });
  return result;
}
