import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { isRtl, useUiLanguage } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { needsImageProxy } from "@/lib/remote-image-proxy";
import { useBigPictureRoute } from "@/lib/big-picture";
import { useBpFocusedMeta } from "./bp-focus-meta";
import { useArtGlow } from "./bp-art-color";
import { bpHeroCandidates, type BpHeroCandidate, type BpHeroSource } from "./bp-art";
import { useBpEnrichFor } from "./use-bp-enrich";
import { useBpLivePanels } from "./use-bp-live-panels";
import { useBpTrailer } from "./use-bp-trailer";
import { BP_META_SETTLE_MS, publishBpBackdropCommit } from "./bp-backdrop-commit";
import {
  BP_TITLE_ART_FADE_MS,
  BpAmbientLayers,
  bpPushLayer,
  bpRgbTriplet,
  useBpPair,
  useBpPrune,
  type BpLayer,
  type BpSplit,
  type BpStill,
} from "./bp-ambient-layers";
import { BAND_SETTLE_MS, BP_BAND_FLOOR_REST, useBpBandState, type BpBandId } from "./use-bp-sections";

const ENRICH_GRACE_MS = 420;
const BAND_FLOOR_MS = 600;
const MOSAIC_SWAP_MS = 260;
const LANDSCAPE = 1.2;
const MOSAIC_MIN = 14;
const NO_POSTERS: readonly string[] = [];

const TITLE_ART_ROUTES = new Set(
  "home shows movies anime service detail person library collection tmdb-collection addon".split(" "),
);

export function BpAmbient({ pool, still }: { pool: Meta[]; still?: boolean }) {
  const route = useBigPictureRoute();
  const ownsTitle = TITLE_ART_ROUTES.has(route.kind);
  const meta = useBpFocusedMeta(BP_META_SETTLE_MS);
  const enrich = useBpEnrichFor(meta, ownsTitle);
  const detail = enrich.detail;
  const metaId = meta?.id ?? "";
  const { settings } = useSettings();
  const rtl = isRtl(useUiLanguage());

  const fallback = useMemo<BpHeroSource | null>(() => {
    const background = pool.find((m) => m.background)?.background;
    if (background) return { url: background, portrait: false };
    const poster = pool.find((m) => m.poster)?.poster;
    return poster ? { url: poster, portrait: true } : null;
  }, [pool]);
  // The pool fallback is another title's artwork, so it can only ever answer for
  // nothing-focused. Listing it beside a focused title's own art meant that
  // whenever that title had not resolved yet the fallback won, committed under
  // the focused id, and latched committedFor so the real art never replaced it.
  // That is the Spider-Man backdrop sitting behind a focused Silo.
  const candidates = useMemo(() => {
    const own: BpHeroSource[] = [
      { url: detail?.gallery.backdrops[0], portrait: false },
      { url: detail?.backdrop, portrait: false },
      { url: meta?.background, portrait: false },
      { url: meta?.poster, portrait: true },
    ];
    return bpHeroCandidates(meta ? own : fallback ? [fallback] : []);
  }, [detail?.backdrop, detail?.gallery.backdrops[0], meta, fallback]);

  const { src: trailerSrc } = useBpTrailer(ownsTitle ? meta : null);
  const [trailerReady, setTrailerReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playing = Boolean(trailerSrc) && trailerReady;
  const onTrailerReady = useCallback(() => setTrailerReady(true), []);

  useEffect(() => {
    setTrailerReady(false);
  }, [trailerSrc]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !trailerSrc) return;
    v.play().catch(() => {});
  }, [trailerSrc]);

  const { band, art: bandArt } = useBpBandState(BAND_SETTLE_MS);
  const bandOwns = band?.owns === "band";
  const titleArt = bandOwns || !ownsTitle ? 0 : 1;

  const [layers, setLayers] = useState<BpLayer[]>([]);
  const seq = useRef(0);
  const committedFor = useRef("");
  const committedTier = useRef(9);
  const committedList = useRef<BpHeroCandidate[] | null>(null);

  // Enrichment resolves after the meta does, so committing on the first
  // candidate list showed the poster and then snapped to the real backdrop.
  // The detail alone is one render stale, so the tagged id is what arms this.
  const [graceFor, setGraceFor] = useState("");
  useEffect(() => {
    if (!metaId) return;
    const timer = window.setTimeout(() => setGraceFor(metaId), ENRICH_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [metaId]);
  const armed = enrich.id === metaId && (enrich.settled || graceFor === metaId);

  // No bridge layer here, deliberately, and this is a design decision rather
  // than an oversight. Painting the focused card's own poster as a stand-in
  // backdrop while the real one loads was tried and rejected on the panel: a
  // 300x450 poster stretched across a 1140 wide hero is visibly soft, and a
  // blown up low resolution backdrop reads as cheaper than no backdrop at all.
  // The hero falls to the void until the real art is ready. Empty and black is
  // a deliberate state; blurry is an accident that looks like a bug.
  const tier = armed ? 1 : 2;
  useEffect(() => {
    if (!ownsTitle || candidates.length === 0) return;
    // The grace timer flips tier 2 to 1 with no new art having arrived, and this
    // effect lists tier, so the identical list used to be walked twice: a second
    // Image, request and decode for a src already committed and on screen. List
    // identity is the honest question, so an unchanged one only records the tier.
    const walked = committedFor.current === metaId;
    if (walked && committedList.current === candidates) {
      if (tier < committedTier.current) committedTier.current = tier;
      return;
    }
    if (walked && committedTier.current <= tier) return;
    let alive = true;
    // The cleanup used to set `alive` and nothing else, so an abandoned walk kept
    // downloading a full backdrop for a title the ring had already left.
    let pending: HTMLImageElement | null = null;

    // Pass one rejects anything portrait, because bpHeroArt happily upscales a
    // 2:3 poster into a slot that crops two thirds of it away. Pass two re-walks
    // the same list accepting any aspect rather than leaving the screen empty.
    const walk = (i: number, wide: boolean) => {
      if (!alive) return;
      if (i >= candidates.length) {
        if (wide && tier === 1) walk(0, false);
        return;
      }
      const candidate = candidates[i];
      if (wide && candidate.portrait) {
        walk(i + 1, wide);
        return;
      }
      const src = candidate.src;
      const img = new Image();
      pending = img;
      img.decoding = "async";
      let settled = false;
      const settle = () => {
        if (!alive || settled) return;
        settled = true;
        if (wide && img.naturalHeight > 0 && img.naturalWidth / img.naturalHeight < LANDSCAPE) {
          walk(i + 1, true);
          return;
        }
        committedFor.current = metaId;
        committedTier.current = tier;
        committedList.current = candidates;
        seq.current += 1;
        const layer = { src, id: seq.current };
        setLayers((prev) => bpPushLayer(prev, layer));
        publishBpBackdropCommit(`card:${metaId}`);
      };
      // decode(), never onload, and `img.decoding` above does not cover it.
      // onload means the bytes arrived and the header parsed; no bitmap exists
      // yet, and a decoding hint on a detached Image nothing ever paints
      // schedules no decode at all. So the commit handed the layer stack an
      // undecoded 1920x1080 backdrop, fifteen times the pixels of a poster, and
      // it mounts at its final opacity by design, so the decode landed inside
      // the one frame that had to paint it. decode() resolves only once the
      // bitmap is there.
      // The rejection path MUST walk on: a decode that fails without advancing
      // leaves committedFor unset and the hero sits in the void permanently.
      // Empty and black is a deliberate state here, permanently empty is a bug.
      const next = () => {
        if (!alive || settled) return;
        settled = true;
        walk(i + 1, wide);
      };
      img.onerror = next;
      img.src = src;
      void img.decode().then(settle, next);
    };

    walk(0, true);
    return () => {
      alive = false;
      if (!pending) return;
      // Empty string is the one src value the spec resolves without a fetch: it
      // aborts the outstanding request and marks the element broken. Never a
      // relative path, and never removeAttribute, the trap bp-ring-motion records.
      pending.onerror = null;
      pending.src = "";
      pending = null;
    };
  }, [candidates, tier, metaId, ownsTitle]);

  useBpPrune(layers, setLayers);

  useEffect(() => {
    if (ownsTitle) return;
    const timer = window.setTimeout(() => {
      committedFor.current = "";
      committedTier.current = 9;
      committedList.current = null;
      setLayers((prev) => (prev.length === 0 ? prev : []));
    }, BP_TITLE_ART_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [ownsTitle]);

  const stillSrc = band?.still ? bandArt?.src : undefined;
  const bandKey = band && bandOwns ? `band:${band.id}:${bandArt?.key ?? ""}` : "";
  const [held, setHeld] = useState<{ src: string; band: BpBandId; key: string } | null>(null);
  const [stills, setStills] = useState<BpStill[]>([]);
  const [stillFailed, setStillFailed] = useState("");
  const stillSeq = useRef(0);

  useEffect(() => {
    const id = band?.id;
    if (!stillSrc || !id) return;
    let alive = true;
    const img = new Image();
    img.decoding = "async";
    let settled = false;
    const settle = () => {
      if (!alive || settled) return;
      settled = true;
      stillSeq.current += 1;
      const layer = { src: stillSrc, id: stillSeq.current, band: id };
      setHeld({ src: stillSrc, band: id, key: bandKey });
      setStills((prev) =>
        prev[prev.length - 1]?.src === stillSrc ? prev : [...prev.slice(-1), layer],
      );
    };
    // A still that 404s never resolves, and without this the copy waits out the
    // whole floor on every dead image instead of arriving as soon as it is known
    // that no picture is coming. A decode that rejects is the same outcome as a
    // load that failed, so it lands here too.
    const fail = () => {
      if (!alive || settled) return;
      settled = true;
      setStillFailed(bandKey);
    };
    img.onerror = fail;
    img.src = stillSrc;
    void img.decode().then(settle, fail);
    return () => {
      alive = false;
    };
  }, [stillSrc, band?.id, bandKey]);

  useBpPrune(stills, setStills);

  // Holding the previous cell's art while the next decodes is correct. Holding
  // the previous band's art is the stale backdrop this stamp exists to kill.
  const stillHeld = Boolean(band?.still && held && held.band === band.id && bandArt?.src);

  const panels = useBpLivePanels(bandArt, settings.tmdbKey);
  const wantA = panels?.a ?? "";
  const wantB = panels?.b ?? "";
  const [splits, setSplits] = useState<BpSplit[]>([]);
  const [splitHeld, setSplitHeld] = useState<BpBandId | null>(null);
  const splitSeq = useRef(0);

  // Both panels must have decoded before the pair commits. A split that lands
  // half-painted shows one photograph beside a black wedge, which is strictly
  // worse than the single still it replaced. Either panel failing drops the
  // whole split so the still path takes over instead of shipping a broken frame.
  useEffect(() => {
    const id = band?.id;
    if (!wantA || !wantB || !id) return;
    let alive = true;
    let pending = 2;
    let failed = false;

    const done = (ok: boolean) => {
      if (!alive) return;
      if (!ok) failed = true;
      pending -= 1;
      if (pending > 0 || failed) return;
      splitSeq.current += 1;
      const layer = { a: wantA, b: wantB, id: splitSeq.current, band: id };
      setSplits((prev) => {
        const last = prev[prev.length - 1];
        if (last?.a === wantA && last?.b === wantB) return prev;
        return [...prev.slice(-1), layer];
      });
      setSplitHeld(id);
    };

    // A url the WebView refuses as mixed content never decodes here, so it is
    // handed straight to the component and its proxy rather than counted lost.
    const load = (src: string) => {
      if (needsImageProxy(src)) {
        done(true);
        return;
      }
      const img = new Image();
      img.decoding = "async";
      let settled = false;
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        done(ok);
      };
      img.onload = () => settle(true);
      img.onerror = () => settle(false);
      img.src = src;
      if (img.complete && img.naturalWidth > 0) settle(true);
    };

    load(wantA);
    load(wantB);
    return () => {
      alive = false;
    };
  }, [wantA, wantB, band?.id]);

  useBpPrune(splits, setSplits);

  const splitOn = Boolean(band?.still && wantA && wantB && splitHeld && splitHeld === band.id);
  const stillOn = stillHeld && !splitOn;

  const brand = bpRgbTriplet(bandArt?.tint);
  const washOn = Boolean(band?.wash && brand);
  const wash = useBpPair(washOn ? brand : undefined);

  // Either the explicit brand hex or the sampled glow, never both, so no band
  // can introduce a colour its own artwork did not supply. A channel with no
  // picture still has its bug, and the bug-alone hero needs a hue from
  // somewhere it owns rather than an invented one.
  const glow = useArtGlow(band?.tint ? (bandArt?.src ?? bandArt?.logo) : undefined);
  const rgb = brand || glow || "";
  const tintOn = Boolean(band?.tint && rgb);
  const tint = useBpPair(tintOn ? rgb : undefined);

  const mosaicWanted = Boolean(band?.mosaic) && settings.bigPictureMosaic !== false;
  const wantKey = mosaicWanted ? (bandArt?.key ?? "") : "";
  const wantPosters = (mosaicWanted ? bandArt?.posters : undefined) ?? NO_POSTERS;
  const [mosaic, setMosaic] = useState<{ key: string; posters: readonly string[] }>({
    key: "",
    posters: NO_POSTERS,
  });

  useEffect(() => {
    if (mosaic.key === wantKey) {
      if (mosaic.posters !== wantPosters) setMosaic({ key: wantKey, posters: wantPosters });
      return;
    }
    const timer = window.setTimeout(
      () => setMosaic({ key: wantKey, posters: wantPosters }),
      MOSAIC_SWAP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [wantKey, wantPosters, mosaic]);

  const mosaicOn = mosaic.key === wantKey && wantKey !== "" && mosaic.posters.length >= MOSAIC_MIN;

  // A gradient needs no decode, so the wash commits on the same tick the band
  // settles. A still commits when it has actually painted. The floor is there so
  // a dead network can never hold the copy hostage.
  const stillReady = Boolean(bandKey) && (held?.key === bandKey || stillFailed === bandKey);
  useEffect(() => {
    if (!bandKey) return;
    if (washOn || stillReady) {
      publishBpBackdropCommit(bandKey);
      return;
    }
    const timer = window.setTimeout(() => publishBpBackdropCommit(bandKey), BAND_FLOOR_MS);
    return () => window.clearTimeout(timer);
  }, [bandKey, washOn, stillReady]);

  return (
    <BpAmbientLayers
      rtl={rtl}
      floor={band?.floor ?? BP_BAND_FLOOR_REST}
      titleArt={titleArt}
      layers={layers}
      drift={!playing && !still}
      trailerSrc={trailerSrc}
      trailerOn={playing}
      videoRef={videoRef}
      onTrailerReady={onTrailerReady}
      wash={wash}
      washOn={washOn}
      mosaicKey={mosaic.key}
      mosaicPosters={mosaic.posters}
      mosaicOn={mosaicOn}
      stills={stills}
      stillBand={band?.id ?? ""}
      stillOn={stillOn}
      splits={splits}
      splitOn={splitOn}
      tint={tint}
      tintOn={tintOn}
    />
  );
}
