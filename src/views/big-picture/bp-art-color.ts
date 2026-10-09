import { useEffect, useState } from "react";
import { bpPlatform } from "./bp-platform";
import { bpArtTintsLoad, bpArtTintsSave } from "./bp-home-cache";

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

const SAMPLE = 14;

// The ring passes through every cell of a rail on the way somewhere, and each
// cell it touches used to start its own host fetch and decode. Sampling waits
// for the ring to rest, so a sweep costs one extraction rather than one per cell.
const SETTLE_MS = 200;

let shared: CanvasRenderingContext2D | null = null;

function sampler(): CanvasRenderingContext2D | null {
  if (shared) return shared;
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  shared = canvas.getContext("2d", { willReadFrequently: true });
  return shared;
}

function weigh(data: ArrayLike<number>): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const cr = data[i];
    const cg = data[i + 1];
    const cb = data[i + 2];
    const max = Math.max(cr, cg, cb);
    const min = Math.min(cr, cg, cb);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const brightness = max / 255;
    const w = saturation * saturation * brightness + 0.03;
    r += cr * w;
    g += cg * w;
    b += cb * w;
    weight += w;
  }
  if (weight === 0) return null;

  let out = [r / weight, g / weight, b / weight];
  const peak = Math.max(...out);
  if (peak > 0 && peak < 150) {
    const lift = 150 / peak;
    out = out.map((c) => Math.min(255, c * lift));
  }
  return out.map((c) => Math.round(c)).join(" ");
}

function readPixels(src: CanvasImageSource, ctx: CanvasRenderingContext2D): string | null {
  ctx.clearRect(0, 0, SAMPLE, SAMPLE);
  ctx.drawImage(src, 0, 0, SAMPLE, SAMPLE);
  return weigh(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
}

// createImageBitmap does the decode off the main thread and hands back a bitmap
// already at sample size. Loading the same bytes into an Image instead left the
// decode to the first drawImage, which is synchronous: 95 to 130ms of blocked
// main thread per poster on a Fire TV stick, against 1ms for this.
// resizeQuality must stay "high". At "low" the sample drifted by up to 51 per
// channel against the old full-size downscale, which is a different hue on the
// card, and it measured no cheaper on the main thread.
async function sampleBytes(blob: Blob): Promise<string | null> {
  const ctx = sampler();
  if (!ctx) return null;
  try {
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: SAMPLE,
      resizeHeight: SAMPLE,
      resizeQuality: "high",
    });
    try {
      return readPixels(bitmap, ctx);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

// A cross-origin poster taints the canvas, so this only ever answers for a host
// that serves CORS headers. Its own canvas, never the shared one, because a
// taint is permanent and would take every later sample down with it.
function sampleElement(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        resolve(readPixels(img, ctx));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// bpPlatform().fetchImageBytes goes out through harbor_fetch, which is reqwest
// in src-tauri/src/http_fetch.rs with no response cache at any layer, on mobile
// too (src-tauri/src/mobile.rs registers the same command). It shares nothing
// with the WebView that already painted the poster, so every call there is a
// second full download of the same bytes. Affordable once, for the tile the
// viewer is looking at. Doing it for every tile that loads doubles the poster
// traffic of the whole app to save a colour.
//
// This asks the WebView instead, so it can be answered by the cache entry the
// tile's own <img> just wrote. force-cache because Chromium will not reuse an
// in-memory image entry across a change of CORS mode, and this request needs
// cors where the tile's did not: force-cache sends it to the HTTP cache, which
// is keyed on the url and does not care.
//
// Access-Control-Allow-Origin is still required, which metahub and tmdb both
// send. A host that does not is handled by the fuse below, not by trying harder.
async function warmBytes(src: string): Promise<Blob | null> {
  try {
    const resp = await fetch(src, { cache: "force-cache", mode: "cors", credentials: "omit" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

// Home draws up to 720 tiles. One poster host with no CORS headers is 720 dead
// requests a session without this, because nothing about the failure is visible
// from a single url: it looks exactly like a poster that happened not to sample.
const MISS_LIMIT = 3;
const misses = new Map<string, number>();

function originOf(src: string): string {
  try {
    return new URL(src).origin;
  } catch {
    return src;
  }
}

async function sampleWarm(src: string): Promise<string | null> {
  const origin = originOf(src);
  if ((misses.get(origin) ?? 0) >= MISS_LIMIT) return null;
  const blob = await warmBytes(src);
  if (!blob) {
    misses.set(origin, (misses.get(origin) ?? 0) + 1);
    return null;
  }
  misses.delete(origin);
  return sampleBytes(blob);
}

async function extract(src: string): Promise<string | null> {
  // Warm first, host second. A backdrop the ambient layer is already showing is
  // several hundred KB, and pulling it down a second time through Rust to read
  // fourteen pixels of it was the whole cost of the old order.
  const warm = await sampleWarm(src);
  if (warm) return warm;
  const bytes = await bpPlatform().fetchImageBytes(src);
  if (bytes) {
    const value = await sampleBytes(bytes);
    if (value) return value;
  }
  return sampleElement(src);
}

const subs = new Map<string, Set<(value: string | null) => void>>();

// Per url, not one list of everyone. A single shared list would mean 262 tiles
// re-rendering on every sample any one of them finished, which is the mistake
// bp-ring-motion.ts records paying for in a different form.
function notify(src: string, value: string | null): void {
  const set = subs.get(src);
  if (!set) return;
  for (const fn of set) fn(value);
}

function remember(src: string, value: string | null): string | null {
  cache.set(src, value);
  inflight.delete(src);
  // Successes persist, failures do not. A null is only ever "this session could
  // not sample it", and writing those would leave a whole shelf grey for the
  // life of the store on the strength of one bad boot.
  if (value) scheduleSave();
  notify(src, value);
  return value;
}

// A trailing throttle, deliberately not a debounce. Samples trickle in for as
// long as the viewer keeps moving through shelves, and a timer that reset on
// each one would never fire on the session that had the most to save.
const SAVE_MS = 6000;
let saveTimer = 0;

function saveNow(): void {
  window.clearTimeout(saveTimer);
  saveTimer = 0;
  const out: Record<string, string> = {};
  for (const [url, value] of cache) if (value) out[url] = value;
  void bpArtTintsSave(out);
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = window.setTimeout(saveNow, SAVE_MS);
}

if (typeof document !== "undefined") {
  // A television kills the process rather than closing the app, so the throttle
  // above needs a floor under it or the last few seconds of a session are the
  // ones that never reach the store.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && saveTimer) saveNow();
  });
}

let hydrating = false;
let hydrated = false;

function settle(): void {
  hydrated = true;
  drain();
}

function hydrate(): void {
  if (hydrating) return;
  hydrating = true;
  void bpArtTintsLoad()
    .then((stored) => {
      for (const [url, value] of Object.entries(stored)) {
        if (cache.has(url)) continue;
        cache.set(url, value);
        notify(url, value);
      }
      settle();
    })
    .catch(settle);
}

// One sample at a time, off idle, and never before the stored tints have landed:
// without that gate every cold start resamples the entire home screen it already
// has the colours for, which is the traffic this was built to avoid.
//
// Nothing in this queue is urgent. A sample taken on load cannot help the tile
// that produced it, only the next cold start and the focus bloom, so it yields
// to anything the viewer is actually doing.
const queue: string[] = [];
const queued = new Set<string>();
let draining = false;

function idle(run: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(() => run(), { timeout: 4000 });
  else window.setTimeout(run, 120);
}

function drain(): void {
  if (draining || !hydrated) return;
  let src = queue.shift();
  while (src !== undefined && cache.has(src)) {
    queued.delete(src);
    src = queue.shift();
  }
  if (src === undefined) return;
  const next = src;
  queued.delete(next);
  draining = true;
  idle(() => {
    const pending = inflight.get(next) ?? sampleWarm(next).then((value) => remember(next, value));
    inflight.set(next, pending);
    void pending
      .catch(() => null)
      .then(() => {
        draining = false;
        drain();
      });
  });
}

function enqueue(src: string): void {
  if (cache.has(src) || queued.has(src) || inflight.has(src)) return;
  queued.add(src);
  queue.push(src);
  drain();
}

export function useArtGlow(src: string | undefined): string | null {
  const [color, setColor] = useState<string | null>(() => (src ? (cache.get(src) ?? null) : null));

  useEffect(() => {
    if (!src) {
      setColor(null);
      return;
    }
    if (cache.has(src)) {
      setColor(cache.get(src) ?? null);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      const pending = inflight.get(src) ?? extract(src).then((value) => remember(src, value));
      inflight.set(src, pending);
      void pending.then((value) => {
        if (alive) setColor(value);
      });
    }, SETTLE_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [src]);

  return color;
}

/**
 * The colour of a tile's own art, for the plate the tile draws while the poster
 * is still in flight. Answers immediately from the store on a cold start, and
 * samples the poster once it has loaded so the next cold start opens in colour.
 *
 * `loaded` is the gate and it is not decoration. Sampling reads the bytes back
 * out of the WebView cache, which only holds them because this tile already
 * fetched them. Pass true before the <img> has loaded and every tile on the
 * screen becomes a real second request instead of a cache read.
 */
export function useArtTint(src: string | undefined, loaded: boolean): string | null {
  const [tint, setTint] = useState<string | null>(() => (src ? (cache.get(src) ?? null) : null));

  useEffect(() => {
    if (!src) {
      setTint(null);
      return;
    }
    const known = cache.get(src);
    setTint(known ?? null);
    if (known !== undefined) return;
    hydrate();
    let alive = true;
    const sink = (value: string | null) => {
      if (alive) setTint(value);
    };
    const set = subs.get(src) ?? new Set<(value: string | null) => void>();
    set.add(sink);
    subs.set(src, set);
    return () => {
      alive = false;
      set.delete(sink);
      if (set.size === 0) subs.delete(src);
    };
  }, [src]);

  useEffect(() => {
    if (!src || !loaded) return;
    hydrate();
    enqueue(src);
  }, [src, loaded]);

  return tint;
}

// weigh() lifts a dark sample until its peak channel reaches 150 so the focus
// bloom reads against the page, and that is far too loud for a field the size of
// a whole tile. The mix is what brings it back to the art, dimmed: the poster
// that lands on top has to stay the most saturated thing in the cell, and a
// plate that competes with it is the failure this doctrine exists to prevent.
const PLATE_MIX = "26%";

export function bpTintPlate(tint: string | null | undefined): string | undefined {
  if (!tint) return undefined;
  return `color-mix(in oklab, rgb(${tint}) ${PLATE_MIX}, var(--bp-panel-2))`;
}
