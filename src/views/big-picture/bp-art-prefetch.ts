import type { Meta } from "@/lib/cinemeta";
import { getBigPictureState, routeKey, subscribeBigPicture } from "@/lib/big-picture";
import { bpHeroArt } from "./bp-art";
import { warmBpEnrich } from "./use-bp-enrich";

const AHEAD = 5;
const BEHIND = 2;
const MAX_INFLIGHT = 3;
const SEEN_CAP = 400;

const DECODE_HOLD = 1;

const seen = new Set<string>();
const queue: string[] = [];
const decoded = new Map<string, HTMLImageElement>();
let inflight = 0;
let routeAt = "";

// A held decode is a full backdrop, 1280x720 at best and 1920x1080 at worst,
// and this Map is the only strong reference to it, so nothing the browser does
// can reclaim one. Nothing pruned on a route change either, so the pair the old
// page warmed for a hero no tile ever paints stayed decoded behind every page
// that followed it, for the whole session. The listener is deliberately never
// removed: the cache it prunes is module scoped and outlives every view, and a
// page that prefetches nothing is exactly the page that must still free this.
subscribeBigPicture(() => {
  const stack = getBigPictureState().stack;
  const top = stack[stack.length - 1];
  const key = top ? routeKey(top) : "";
  if (key === routeAt) return;
  routeAt = key;
  decoded.clear();
  // `queue` too. It used to survive, and pump() drains three at a time off
  // whatever page came next, so the anime page's cold load competed with home's
  // leftover backdrops for both the connection pool and the decoder.
  //
  // `inflight` and `seen` deliberately do NOT get cleared here. inflight is owned
  // by handlers already attached to images in flight, so zeroing it lets pump
  // exceed MAX_INFLIGHT and then run negative as those handlers land; clearing
  // seen re-queues every url the session has already fetched.
  queue.length = 0;
});

function holdDecoded(src: string, img: HTMLImageElement) {
  decoded.delete(src);
  decoded.set(src, img);
  while (decoded.size > DECODE_HOLD) {
    const oldest = decoded.keys().next().value;
    if (oldest === undefined) break;
    decoded.delete(oldest);
  }
}

export function decodeBpHeroArt(url: string | undefined) {
  const src = bpHeroArt(url);
  if (!src || decoded.has(src)) return;
  const at = routeAt;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  void img.decode().then(
    () => {
      // A decode that lands after the route it was started for would put itself
      // straight back into the Map the route change just cleared.
      if (routeAt !== at) return;
      holdDecoded(src, img);
    },
    () => {},
  );
}

function pump() {
  while (inflight < MAX_INFLIGHT && queue.length > 0) {
    const src = queue.shift();
    if (!src) return;
    inflight += 1;
    const img = new Image();
    const done = () => {
      inflight -= 1;
      pump();
    };
    img.onload = done;
    img.onerror = done;
    img.src = src;
  }
}

export function prefetchBpHeroArt(urls: readonly (string | undefined)[]) {
  for (const url of urls) {
    const src = bpHeroArt(url);
    if (!src || seen.has(src)) continue;
    // Evict one. Clearing at the cap is the same re-queue of the whole session
    // that the route listener above refuses to do, just triggered by a counter.
    if (seen.size >= SEEN_CAP) {
      const oldest = seen.values().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }
    seen.add(src);
    queue.push(src);
  }
  pump();
}

export function prefetchBpRowNeighbours(
  metas: readonly Meta[],
  index: number,
  tmdbKey?: string,
) {
  if (index < 0) return;
  const near: Meta[] = [];
  for (let step = 1; step <= AHEAD; step += 1) {
    const m = metas[index + step];
    if (m) near.push(m);
  }
  for (let step = 1; step <= BEHIND; step += 1) {
    const m = metas[index - step];
    if (m) near.push(m);
  }
  prefetchBpHeroArt(near.map((m) => m.background));
  const next = metas[index + 1];
  if (!tmdbKey) {
    if (next) decodeBpHeroArt(next.background);
    return;
  }
  for (const m of near) {
    void warmBpEnrich(tmdbKey, m).then((detail) => {
      const best = [detail?.gallery?.backdrops?.[0], detail?.backdrop, m.background].find(Boolean);
      if (m === next) {
        decodeBpHeroArt(best);
        return;
      }
      prefetchBpHeroArt([best]);
    });
  }
}
