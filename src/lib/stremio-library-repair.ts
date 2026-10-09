import { ANIME_CLOUD_ID } from "@/lib/stremio";

const API = "https://api.strem.io/api";

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

async function call(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error) throw new Error(`${path}: ${json.error.message ?? "request failed"}`);
  return json.result;
}

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
  const ids = (await call("datastoreMeta", { authKey, collection: "libraryItem" })) as Array<[string, string]>;
  if (!Array.isArray(ids) || ids.length === 0) {
    onProgress?.({ phase: "done", total: 0, needsRepair: 0, pushed: 0 });
    return { total: 0, alreadyClean: 0, repaired: 0, unrepairable: 0 };
  }
  onProgress?.({ phase: "fetching", total: ids.length });
  const items = (await call("datastoreGet", {
    authKey,
    collection: "libraryItem",
    ids: ids.map(([id]) => id),
    all: true,
  })) as unknown[];

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
    await call("datastorePut", { authKey, collection: "libraryItem", changes: slice });
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
