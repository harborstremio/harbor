import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import { decodeSubtitleBytes } from "@/lib/subtitles/encoding";
import { embeddedSubIndex, resolveReadableUrl } from "@/lib/subtitles/extract";
import { assScaleFromFactor, computeAssBaseFactor } from "@/lib/player/ass-header";
import type { TrackInfo } from "@/lib/player/bridge";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function loadAssText(
  sourceUrl: string,
  track: TrackInfo,
  tracks: TrackInfo[],
  headers?: Record<string, string>,
): Promise<string | null> {
  if (track.external === true || track.url) {
    const raw = track.url ?? track.externalFilename;
    if (!raw) return null;
    const readable = await resolveReadableUrl(raw);
    if (!readable) return null;
    const res = await safeFetch(readable, { method: "GET" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return decodeSubtitleBytes(new Uint8Array(buf), {});
  }
  if (!isTauri()) return null;
  const streamIndex = embeddedSubIndex(tracks, track.id);
  return invoke<string>("subtitle_extract_ass", {
    source: sourceUrl,
    streamIndex,
    headers: headers ?? null,
  });
}

export function useAssNormalize(params: {
  enabled: boolean;
  sourceUrl: string | null;
  headers?: Record<string, string>;
  track: TrackInfo | null;
  tracks: TrackInfo[];
  targetFontSize: number;
}): number | undefined {
  const { enabled, sourceUrl, headers, track, tracks, targetFontSize } = params;
  const cacheRef = useRef<Map<string, number | null>>(new Map());
  const liveRef = useRef({ sourceUrl, track, tracks, headers });
  liveRef.current = { sourceUrl, track, tracks, headers };
  const [factor, setFactor] = useState<number | null>(null);
  const key = enabled && sourceUrl && track ? `${sourceUrl}|${track.id}|${track.external ? 1 : 0}` : "";

  useEffect(() => {
    if (!key) {
      setFactor(null);
      return;
    }
    const cached = cacheRef.current.get(key);
    if (cached !== undefined) {
      setFactor(cached);
      return;
    }
    setFactor(null);
    let cancelled = false;
    void (async () => {
      const live = liveRef.current;
      let result: number | null = null;
      try {
        if (live.sourceUrl && live.track) {
          const text = await loadAssText(live.sourceUrl, live.track, live.tracks, live.headers);
          result = text ? computeAssBaseFactor(text) : null;
        }
      } catch {
        result = null;
      }
      cacheRef.current.set(key, result);
      if (!cancelled) setFactor(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return factor == null ? undefined : assScaleFromFactor(factor, targetFontSize);
}
