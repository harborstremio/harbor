import { useEffect, useMemo, useRef, useState } from "react";
import { captureMpvFrame } from "@/lib/snapshots";
import { buildGallery, galleryPoolSize } from "./cast-embeddings";
import { ensureFaceEngine, scanFrame } from "./face-engine";
import { classify } from "./match";
import type { CastEntry } from "@/lib/providers/tmdb";
import type { GalleryEntry, WireFace } from "./match";

const SCAN_MS = 1200;
const SEEN_WINDOW_MS = 20000;

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
  loadBitmap: (url: string) => Promise<ImageBitmap>;
};

async function dataUrlToBitmap(dataUrl: string): Promise<ImageBitmap> {
  const blob = await (await fetch(dataUrl)).blob();
  return createImageBitmap(blob);
}

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
  const [ready, setReady] = useState(false);
  const [galleryReady, setGalleryReady] = useState(false);
  const [progress, setProgress] = useState<GalleryProgress>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<OnScreenPerson[]>([]);

  useEffect(() => {
    if (!liveScan) return;
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
    };
  }, [liveScan]);

  const runScan = useMemo(() => {
    return async () => {
      if (inFlightRef.current || galleryRef.current.length === 0) return;
      inFlightRef.current = true;
      try {
        const dataUrl = await captureMpvFrame(true);
        if (!dataUrl) return;
        const bmp = await dataUrlToBitmap(dataUrl);
        let faces: WireFace[];
        try {
          faces = await scanFrame(bmp, bmp.width, bmp.height);
        } finally {
          bmp.close();
        }
        const now = Date.now();
        for (const f of faces) {
          const match = classify(Float32Array.from(f.embedding), galleryRef.current);
          if (!match) continue;
          const g = galleryRef.current.find((x) => x.id === match.id);
          if (!g) continue;
          seenRef.current.set(match.id, {
            ts: now,
            person: { id: g.id, name: g.name, character: g.character, profilePath: g.profilePath, score: match.score },
          });
        }
        for (const [id2, v] of seenRef.current) {
          if (now - v.ts > SEEN_WINDOW_MS) seenRef.current.delete(id2);
        }
        setPeople([...seenRef.current.values()].sort((a, b) => b.person.score - a.person.score).map((v) => v.person));
      } finally {
        inFlightRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    galleryRef.current = [];
    seenRef.current.clear();
    setPeople([]);
    setGalleryReady(false);
    setProgress({ done: 0, total: 0 });
    if (!metaKey || cast.length === 0) return;
    setProgress({ done: 0, total: galleryPoolSize(cast) });
    buildGallery(metaKey, cast, loadBitmap, (entry) => {
      if (cancelled) return;
      const wasEmpty = galleryRef.current.length === 0;
      galleryRef.current = [...galleryRef.current, entry];
      setProgress((p) => ({ done: p.done + 1, total: Math.max(p.total, p.done + 1) }));
      if (wasEmpty) {
        setGalleryReady(true);
        void runScan();
      }
    })
      .then((all) => {
        if (cancelled) return;
        if (all.length === 0) setError("no cast headshots to match against");
        else {
          galleryRef.current = all;
          setGalleryReady(true);
        }
      })
      .catch(() => {
        if (!cancelled && galleryRef.current.length === 0) setError("couldn't read the cast");
      });
    return () => {
      cancelled = true;
    };
  }, [ready, metaKey, cast, loadBitmap, runScan]);

  useEffect(() => {
    if (!ready || !liveScan) return;
    const t = setInterval(() => void runScan(), SCAN_MS);
    return () => clearInterval(t);
  }, [ready, liveScan, runScan]);

  useEffect(() => {
    if (ready && liveScan && isPaused) void runScan();
  }, [ready, liveScan, isPaused, runScan]);

  return { people, ready, galleryReady, progress, error };
}
