import { useEffect, useSyncExternalStore } from "react";
import { autoDlList, isAutoDownloaded, recordGrab, updateAutoDownload, type AutoDlSeries } from "@/lib/auto-download";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { enqueueDownload } from "@/lib/download/downloads-store";
import { resolveMeta } from "@/lib/meta-resource";
import { tmdbImdbId } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { gatherContext, readAuthKey, type AutoDlContext } from "./context";
import { eligibleEpisodes, grabKey, nextUnairedDate } from "./episodes";
import { resolveBestDownload } from "./resolve";

const FIRST_DELAY_MS = 30_000;
const INTERVAL_MS = 6 * 60 * 60 * 1000;
const RUN_BUDGET_MS = 8 * 60 * 1000;
const ENQUEUE_TIMEOUT_MS = 60_000;
const BETWEEN_SERIES_MS = 500;
const MAX_CONCURRENT = 2;

let running = false;
let runGen = 0;
let nextRunAt: number | null = null;
const checkingIds = new Set<string>();
const claimedKeys = new Set<string>();
const stateListeners = new Set<() => void>();

function notifyState(): void {
  stateListeners.forEach((l) => l());
}

function subscribeState(fn: () => void): () => void {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

export function useNextRunAt(): number | null {
  return useSyncExternalStore(subscribeState, () => nextRunAt, () => nextRunAt);
}

export function useIsChecking(id: string): boolean {
  return useSyncExternalStore(
    subscribeState,
    () => checkingIds.has(id),
    () => checkingIds.has(id),
  );
}

export function useIsRunning(): boolean {
  return useSyncExternalStore(
    subscribeState,
    () => running,
    () => running,
  );
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active--;
    queue.shift()?.();
  };
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active++;
        fn().then(resolve, reject).finally(next);
      };
      if (active < max) start();
      else queue.push(start);
    });
  };
}

type SeriesResolution = { meta: Meta | null; imdbId: string | null };

async function seriesImdbId(series: AutoDlSeries, ctx: AutoDlContext): Promise<string | null> {
  if (series.id.startsWith("tt")) return series.id;
  if (series.imdbId) return series.imdbId;
  if (!ctx.settings.tmdbKey) return null;
  const resolved = await tmdbImdbId(ctx.settings.tmdbKey, series.id).catch(() => null);
  if (resolved) updateAutoDownload(series.id, { imdbId: resolved });
  return resolved;
}

async function seriesMeta(series: AutoDlSeries, ctx: AutoDlContext): Promise<SeriesResolution> {
  if (narrowMediaType(series.type) !== "series") return { meta: null, imdbId: null };
  const imdbId = await seriesImdbId(series, ctx);
  const lookupId = imdbId ?? series.id;
  const direct = await fetchMeta("series", lookupId).catch(() => null);
  if (direct) return { meta: direct, imdbId };
  const viaAddon = await resolveMeta(readAuthKey(), "series", lookupId).catch(() => null);
  return { meta: viaAddon, imdbId };
}

async function processSeries(
  series: AutoDlSeries,
  ctx: AutoDlContext,
  grabbed: Set<string>,
  limit: ReturnType<typeof createLimiter>,
  signal: AbortSignal,
  gen: number,
): Promise<void> {
  const { meta: m, imdbId } = await seriesMeta(series, ctx);
  if (gen !== runGen) return;
  updateAutoDownload(series.id, {
    lastCheckedAt: Date.now(),
    nextAirDate: m ? nextUnairedDate(m) : series.nextAirDate,
    lastError: m ? null : "couldn't load episodes",
  });
  if (!m || signal.aborted) return;

  if (series.stop.kind === "count" && series.stop.from == null) {
    updateAutoDownload(series.id, { stop: { ...series.stop, from: series.grabbedCount } });
  }
  for (const k of series.grabbedKeys) grabbed.add(k);

  const fresh = autoDlList().find((s) => s.id === series.id) ?? series;
  const eps = eligibleEpisodes(fresh, m, grabbed);
  if (eps.length === 0) return;

  let attempted = 0;
  let found = 0;
  await Promise.all(
    eps.map((ep) =>
      limit(async () => {
        if (signal.aborted || gen !== runGen) return;
        const current = autoDlList().find((s) => s.id === series.id);
        if (!current) return;
        if (
          current.stop.kind === "count" &&
          current.grabbedCount - (current.stop.from ?? current.grabbedCount) >= current.stop.value
        ) {
          return;
        }
        const key = grabKey(series.id, ep.season, ep.episode);
        if (grabbed.has(key) || claimedKeys.has(key)) return;
        attempted += 1;
        const hit = await resolveBestDownload(m, ep, {
          allowP2p: current.allowP2p,
          maxHeight: current.maxHeight,
          imdbId,
          debrids: ctx.debrids,
          addons: ctx.addons,
          signal,
        });
        if (hit) found += 1;
        if (!hit || signal.aborted || gen !== runGen) return;
        if (grabbed.has(key) || claimedKeys.has(key)) return;
        grabbed.add(key);
        claimedKeys.add(key);
        try {
          await withTimeout(
            enqueueDownload({
              meta: m,
              episode: ep,
              streamLabel: hit.label,
              url: hit.url,
              headers: hit.headers ?? null,
            }),
            ENQUEUE_TIMEOUT_MS,
          );
          recordGrab(series.id, key, `S${ep.season}E${ep.episode}`);
        } catch {
          grabbed.delete(key);
        } finally {
          claimedKeys.delete(key);
        }
      }),
    ),
  );
  if (signal.aborted || gen !== runGen) return;
  if (attempted > 0 && found === 0) {
    updateAutoDownload(series.id, { lastError: "no sources found" });
  }
}

async function runSeriesList(list: AutoDlSeries[], signal: AbortSignal, gen: number): Promise<void> {
  const ctx = await gatherContext();
  if (signal.aborted || gen !== runGen) return;
  const grabbed = new Set<string>();
  const limit = createLimiter(MAX_CONCURRENT);
  for (const series of list) {
    if (signal.aborted || gen !== runGen) break;
    if (!isAutoDownloaded(series.id)) continue;
    if (gen === runGen) {
      checkingIds.add(series.id);
      notifyState();
    }
    try {
      await processSeries(series, ctx, grabbed, limit, signal, gen);
    } finally {
      if (gen === runGen) {
        checkingIds.delete(series.id);
        notifyState();
      }
    }
    await delay(BETWEEN_SERIES_MS);
  }
}

export async function runAutoDownloadCheck(manual = false): Promise<boolean> {
  if (running) return false;
  const list = autoDlList();
  if (list.length === 0) return false;
  running = true;
  const gen = ++runGen;
  const controller = new AbortController();
  let budget: ReturnType<typeof setTimeout> | undefined;
  try {
    notifyState();
    const deadline = new Promise<void>((resolve) => {
      budget = setTimeout(() => {
        controller.abort();
        resolve();
      }, RUN_BUDGET_MS);
    });
    await Promise.race([runSeriesList(list, controller.signal, gen), deadline]);
  } catch {
    void manual;
  } finally {
    if (budget) clearTimeout(budget);
    running = false;
    if (checkingIds.size > 0) checkingIds.clear();
    notifyState();
  }
  return true;
}

export function useAutoDownloadRunner(): void {
  useEffect(() => {
    let disposed = false;
    const kick = () => {
      if (disposed) return;
      nextRunAt = Date.now() + INTERVAL_MS;
      notifyState();
      void runAutoDownloadCheck();
    };
    nextRunAt = Date.now() + FIRST_DELAY_MS;
    notifyState();
    const first = window.setTimeout(kick, FIRST_DELAY_MS);
    const interval = window.setInterval(kick, INTERVAL_MS);
    return () => {
      disposed = true;
      nextRunAt = null;
      notifyState();
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);
}
