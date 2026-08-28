import { useEffect, useMemo, useRef, useState } from "react";
import { buildGallery, galleryPoolSize } from "./cast-embeddings";
import { captureFaceFrame } from "./face-capture";
import { ensureFaceEngine, releaseFaceEngine, scanFrame } from "./face-engine";
import { classify } from "./match";
import type { CastEntry } from "@/lib/providers/tmdb";
import type { GalleryEntry, WireFace } from "./match";

const SCAN_MS = 4000;
const SEEN_WINDOW_MS = 6000;
const CAPTURE_ERROR = "couldn't capture the video frame";
const CAPTURE_FAILURES_BEFORE_ERROR = 3;

export type OnScreenPerson = {
  id: number;
  name: string;
  character: string;
  profilePath: string;
  score: number;
};

export type GalleryProgress = { done: number; total: number };

type Args = {
  metaKey: string;
  cast: CastEntry[];
  liveScan: boolean;
  isPaused: boolean;
  loadBitmap: (url: string, signal?: AbortSignal) => Promise<ImageBitmap>;
};

export function useFaceId({ metaKey, cast, liveScan, isPaused, loadBitmap }: Args): {
  people: OnScreenPerson[];
  ready: boolean;
  galleryReady: boolean;
  progress: GalleryProgress;
  error: string | null;
} {
  const galleryRef = useRef<GalleryEntry[]>([]);
  const seenRef = useRef<Map<number, { person: OnScreenPerson; ts: number }>>(new Map());
  const inFlightRef = useRef(false);
  const captureFailuresRef = useRef(0);
  const scanGenerationRef = useRef(0);
  const liveScanRef = useRef(liveScan);
  const [ready, setReady] = useState(false);
  const [galleryReady, setGalleryReady] = useState(false);
  const [progress, setProgress] = useState<GalleryProgress>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<OnScreenPerson[]>([]);

  useEffect(() => {
    liveScanRef.current = liveScan;
    scanGenerationRef.current += 1;
    if (!liveScan) {
      galleryRef.current = [];
      seenRef.current.clear();
      setPeople([]);
      setReady(false);
      setGalleryReady(false);
      setProgress({ done: 0, total: 0 });
      setError(null);
      releaseFaceEngine();
      return;
    }
    let cancelled = false;
    setReady(false);
    setError(null);
    ensureFaceEngine()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      releaseFaceEngine();
    };
  }, [liveScan]);

  const runScan = useMemo(() => {
    return async () => {
      if (inFlightRef.current || galleryRef.current.length === 0) return;
      const generation = scanGenerationRef.current;
      inFlightRef.current = true;
      try {
        let bmp: ImageBitmap | null;
        try {
          bmp = await captureFaceFrame();
          captureFailuresRef.current = 0;
          setError((current) => (current === CAPTURE_ERROR ? null : current));
        } catch {
          captureFailuresRef.current += 1;
          if (captureFailuresRef.current >= CAPTURE_FAILURES_BEFORE_ERROR) setError(CAPTURE_ERROR);
          return;
        }
        if (!bmp) return;
        try {
          const faces: WireFace[] = await scanFrame(bmp, bmp.width, bmp.height);
          if (!liveScanRef.current || generation !== scanGenerationRef.current) return;
          const now = Date.now();
          for (const f of faces) {
            const match = classify(Float32Array.from(f.embedding), galleryRef.current);
            if (!match) continue;
            const g = galleryRef.current.find((x) => x.id === match.id);
            if (!g) continue;
            seenRef.current.set(match.id, {
              ts: now,
              person: {
                id: g.id,
                name: g.name,
                character: g.character,
                profilePath: g.profilePath,
                score: match.score,
              },
            });
          }
          for (const [id2, v] of seenRef.current) {
            if (now - v.ts > SEEN_WINDOW_MS) seenRef.current.delete(id2);
          }
          setPeople(
            [...seenRef.current.values()]
              .sort((a, b) => b.person.score - a.person.score)
              .map((v) => v.person),
          );
        } catch (scanError) {
          if (liveScanRef.current && generation === scanGenerationRef.current) {
            setError(scanError instanceof Error ? scanError.message : String(scanError));
          }
        }
      } finally {
        inFlightRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !liveScan) return;
    const controller = new AbortController();
    galleryRef.current = [];
    seenRef.current.clear();
    setPeople([]);
    setGalleryReady(false);
    setProgress({ done: 0, total: 0 });
    if (!metaKey || cast.length === 0) return;
    setProgress({ done: 0, total: galleryPoolSize(cast) });
    buildGallery(metaKey, cast, loadBitmap, controller.signal, (entry) => {
      if (controller.signal.aborted) return;
      const wasEmpty = galleryRef.current.length === 0;
      galleryRef.current = [...galleryRef.current, entry];
      setProgress((p) => ({ done: p.done + 1, total: Math.max(p.total, p.done + 1) }));
      if (wasEmpty) {
        setGalleryReady(true);
        void runScan();
      }
    })
      .then((all) => {
        if (controller.signal.aborted) return;
        if (all.length === 0) setError("no cast headshots to match against");
        else {
          galleryRef.current = all;
          setGalleryReady(true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && galleryRef.current.length === 0)
          setError("couldn't read the cast");
      });
    return () => {
      controller.abort();
    };
  }, [ready, liveScan, metaKey, cast, loadBitmap, runScan]);

  useEffect(() => {
    if (!ready || !liveScan || isPaused) return;
    if (document.visibilityState !== "visible") return;
    const t = setInterval(() => void runScan(), SCAN_MS);
    return () => clearInterval(t);
  }, [ready, liveScan, isPaused, runScan]);

  useEffect(() => {
    if (ready && liveScan && isPaused) void runScan();
  }, [ready, liveScan, isPaused, runScan]);

  return { people, ready, galleryReady, progress, error };
}
