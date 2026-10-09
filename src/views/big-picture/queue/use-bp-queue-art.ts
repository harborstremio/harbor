import { useEffect, useMemo, useRef, useState } from "react";
import { needsImageProxy, useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { bpCardArt, bpHeroArt } from "../bp-art";
import { publishBpBackdropCommit } from "../bp-backdrop-commit";
import { useBpEnrichFor } from "../use-bp-enrich";
import { type BpQueueEntry } from "./use-bp-queue";

const ENRICH_GRACE_MS = 420;
const LANDSCAPE = 1.2;
const DECODE_CEILING_MS = 5000;
const COMPOSITE_POSTER_WIDTH = 300;

export type BpQueueArtMode = "landscape" | "composite" | "plate";

export type BpQueueArt = {
  key: string;
  src: string | null;
  poster: string | null;
  mode: BpQueueArtMode;
};

type BpQueueResolved = Omit<BpQueueArt, "key"> & { id: string };

const NO_ART: BpQueueArt = { key: "", src: null, poster: null, mode: "plate" };

export function useBpQueueArt(entry: BpQueueEntry | null): BpQueueArt {
  const meta = entry?.meta ?? null;
  const id = meta?.id ?? "";
  const enrich = useBpEnrichFor(meta);
  const detail = enrich.detail;

  const poster = bpCardArt(meta?.poster, COMPOSITE_POSTER_WIDTH) ?? null;

  const candidates = useMemo(() => {
    if (!meta) return [] as string[];
    const raw = [detail?.gallery.backdrops[0], detail?.backdrop, meta.background];
    return [...new Set(raw.map((u) => bpHeroArt(u)).filter(Boolean) as string[])];
  }, [detail?.gallery.backdrops[0], detail?.backdrop, meta]);

  const [graceFor, setGraceFor] = useState("");
  const [resolved, setResolved] = useState<BpQueueResolved | null>(null);
  const committedFor = useRef("");

  useEffect(() => {
    if (!id) {
      committedFor.current = "";
      setResolved(null);
      return;
    }
    const timer = window.setTimeout(() => setGraceFor(id), ENRICH_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [id]);

  // Enrichment lands after the entry does, so walking on the first candidate list
  // paints meta.background and then snaps to the gallery backdrop. The grace is
  // the ceiling on that wait. The very first entry skips it outright: there is no
  // outgoing layer to hold the screen, so waiting here is a void screen on open.
  const armed =
    !!id && (resolved === null || (enrich.id === id && (enrich.settled || graceFor === id)));

  useEffect(() => {
    if (!id || !armed || committedFor.current === id) return;
    let alive = true;
    let ceiling = 0;

    const commit = (src: string | null, mode: BpQueueArtMode) => {
      if (!alive) return;
      alive = false;
      window.clearTimeout(ceiling);
      committedFor.current = id;
      setResolved({ id, src, poster, mode });
      // Every rung publishes, not only the landscape one. A poster-only entry
      // that stays silent burns the copy gate's 900ms ceiling on every single
      // step and the whole surface reads as laggy.
      publishBpBackdropCommit(`queue:${id}`);
    };

    const plate = () => commit(null, "plate");

    // A url the WebView refuses as mixed content never decodes here at all, so
    // it counts as unusable rather than as an error still on its way.
    const decode = (src: string, ok: (img: HTMLImageElement) => void, fail: () => void) => {
      if (needsImageProxy(src)) {
        fail();
        return;
      }
      const img = new Image();
      img.decoding = "async";
      let settled = false;
      const done = (good: boolean) => {
        if (settled || !alive) return;
        settled = true;
        if (good) ok(img);
        else fail();
      };
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = src;
      if (img.complete && img.naturalWidth > 0) done(true);
    };

    // Pass one rejects anything portrait: bpHeroArt will happily upscale a 2:3
    // poster into a 16:9 slot and crop two thirds of it away. The composite is
    // the designed answer for that, so pass two only runs when there is no
    // poster to build one from.
    const walk = (i: number, wide: boolean) => {
      if (!alive) return;
      if (i >= candidates.length) {
        if (!wide) {
          plate();
          return;
        }
        if (poster) {
          decode(poster, () => commit(null, "composite"), plate);
          return;
        }
        walk(0, false);
        return;
      }
      const src = candidates[i];
      decode(
        src,
        (img) => {
          if (wide && img.naturalHeight > 0 && img.naturalWidth / img.naturalHeight < LANDSCAPE) {
            walk(i + 1, true);
            return;
          }
          commit(src, "landscape");
        },
        () => walk(i + 1, wide),
      );
    };

    // Nothing settling at all leaves the previous entry's art on screen under the
    // new entry's copy. The plate is a worse picture and a truthful one.
    ceiling = window.setTimeout(plate, DECODE_CEILING_MS);
    walk(0, true);
    return () => {
      alive = false;
      window.clearTimeout(ceiling);
    };
  }, [id, armed, candidates, poster]);

  // Held, not cleared, until the next entry commits. The stage cross-fades on
  // this key changing, so clearing it on the keypress is the blank frame the
  // whole transition exists to avoid.
  const src = useProxiedImageSrc(resolved?.src ?? undefined);
  const posterSrc = useProxiedImageSrc(resolved?.poster ?? undefined);

  return useMemo(() => {
    if (!resolved) return NO_ART;
    return {
      key: `queue:${resolved.id}`,
      src: src ?? null,
      poster: posterSrc ?? null,
      mode: resolved.mode,
    };
  }, [resolved, src, posterSrc]);
}
