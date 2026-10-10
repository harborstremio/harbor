import { useEffect, useRef, useState } from "react";
import { lruSet } from "@/lib/cache";
import { get, IMG } from "@/lib/providers/tmdb/tmdb-client";
import type { BpBandArt } from "./use-bp-sections";

// TheSportsDB permits hot-linking their artwork with credit and in the same
// breath says "You cannot publish apps to an appstore unless you are a paid
// subscriber." Big Picture is the Play Store shell, so the sports rung of the
// Panel B ladder stays dark until js buys the subscription. Nobody flips this.
export const BP_LIVE_SPORTS_ART = false;

export const PANEL_DEBOUNCE_MS = 220;

const QUERY_MAX = 300;
const PANEL_MAX = 300;
const METAHUB = "images.metahub.space";
const PANEL_WIDTH = "w1280";

export type BpLivePanels = { key: string; a: string; b: string | null };

type MultiResult = { id: number; media_type?: string; backdrop_path?: string | null };
type MultiPage = { results?: MultiResult[] };
type ImagesPage = { backdrops?: Array<{ file_path?: string }> };
type TmdbHit = { kind: "tv" | "movie"; id: number; backdrop: string };

// Session only, never localStorage. Big Picture already overflows the ~5MB
// quota on record, and a cache that dies with the tab is trivially inside
// TMDB's six month ceiling on caching anything obtained from them.
const hits = new Map<string, TmdbHit | null>();
const seconds = new Map<string, string | null>();
const panels = new Map<string, BpLivePanels | null>();

// The toning in bp-live-split is a render-time CSS filter and must stay one.
// Writing a toned bitmap to disk or to a cache would make it a derivative of
// TMDB content, which their terms forbid outright.
async function findHit(tmdbKey: string, query: string): Promise<TmdbHit | null> {
  const trimmed = query.trim();
  const slot = trimmed.toLowerCase();
  if (!slot) return null;
  const cached = hits.get(slot);
  if (cached !== undefined) return cached;
  const page = await get<MultiPage>(tmdbKey, "search/multi", {
    query: trimmed,
    include_adult: "false",
  });
  const found = (page?.results ?? []).find(
    (r) => (r.media_type === "tv" || r.media_type === "movie") && Boolean(r.backdrop_path),
  );
  const hit: TmdbHit | null = found
    ? {
        kind: found.media_type === "tv" ? "tv" : "movie",
        id: found.id,
        backdrop: `${IMG}/${PANEL_WIDTH}${found.backdrop_path}`,
      }
    : null;
  lruSet(hits, slot, hit, QUERY_MAX);
  return hit;
}

async function secondBackdrop(tmdbKey: string, hit: TmdbHit): Promise<string | null> {
  const slot = `${hit.kind}/${hit.id}`;
  const cached = seconds.get(slot);
  if (cached !== undefined) return cached;
  const data = await get<ImagesPage>(tmdbKey, `${slot}/images`, {
    include_image_language: "en,null",
  });
  const path = data?.backdrops?.[1]?.file_path;
  const url = path ? `${IMG}/${PANEL_WIDTH}${path}` : null;
  lruSet(seconds, slot, url, QUERY_MAX);
  return url;
}

// The user's own XMLTV icon leads because it is theirs by construction. TMDB
// comes next because metahub's own terms say the API licence grants no right to
// display their images, so metahub only fills the gap a TMDB key would have.
async function resolvePanels(art: BpBandArt, tmdbKey: string): Promise<BpLivePanels | null> {
  const own = art.src && !art.src.includes(METAHUB) ? art.src : "";
  const title = art.title?.trim() ?? "";
  const hitA = tmdbKey && title ? await findHit(tmdbKey, title) : null;
  const a = own || hitA?.backdrop || art.src || "";
  if (!a) return null;

  // Both panels are the programme that is on right now. Filling panel B from the
  // next programme meant a focused Who Wants to Be a Millionaire painted half a
  // hero of Scrubs, which reads as the wrong show rather than as a schedule.
  let b: string | null = null;
  if (hitA) {
    const second = await secondBackdrop(tmdbKey, hitA);
    if (second && second !== a) b = second;
  }
  return { key: art.key, a, b };
}

export function useBpLivePanels(art: BpBandArt | null, tmdbKey: string): BpLivePanels | null {
  const key = art?.key.startsWith("iptv:") ? art.key : "";
  const slot = key ? `${tmdbKey ? "k" : "n"}:${key}` : "";
  const held = useRef<BpBandArt | null>(null);
  held.current = art;
  const [, setSettled] = useState(0);

  // Scanning the row must not fire sixteen searches, and a key that has already
  // committed never resolves twice: a second answer arriving under a live key
  // would swap the wrapper's contents and land as a hard cut under the eye.
  useEffect(() => {
    if (!slot || panels.has(slot)) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      const current = held.current;
      if (!current || current.key !== key) return;
      void resolvePanels(current, tmdbKey).then((out) => {
        if (panels.has(slot)) return;
        lruSet(panels, slot, out, PANEL_MAX);
        if (alive) setSettled((n) => n + 1);
      });
    }, PANEL_DEBOUNCE_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [slot, key, tmdbKey]);

  return slot ? (panels.get(slot) ?? null) : null;
}
