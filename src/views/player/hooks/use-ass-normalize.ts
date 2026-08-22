import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { assScaleFromFactor } from "@/lib/player/ass-header";
import {
  loadAssBaseFactor,
  type AssLoaderDeps,
  type AssNormalizeTrack,
} from "@/lib/player/ass-normalize-loader";
import { safeFetch } from "@/lib/safe-fetch";
import { decodeSubtitleBytes } from "@/lib/subtitles/encoding";
import { resolveReadableUrl } from "@/lib/subtitles/extract";
import type { TrackInfo } from "@/lib/player/bridge";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const deps: AssLoaderDeps = {
  loadExternal: async (url, signal) => {
    const readable = await resolveReadableUrl(url);
    if (!readable) return null;
    const response = await safeFetch(readable, { method: "GET", signal });
    if (!response.ok) return null;
    return decodeSubtitleBytes(new Uint8Array(await response.arrayBuffer()), {});
  },
  loadEmbedded: async (sourceUrl, streamIndex, headers) => {
    if (!isTauri()) return null;
    return invoke<string>("subtitle_extract_ass", {
      source: sourceUrl,
      streamIndex,
      headers: headers ?? null,
    });
  },
};

export function useAssNormalize(params: {
  enabled: boolean;
  sourceUrl: string | null;
  headers?: Record<string, string>;
  track: TrackInfo | null;
  tracks: TrackInfo[];
  targetFontSize: number;
}): number | undefined {
  const { enabled, sourceUrl, headers, track, tracks, targetFontSize } = params;
  const [result, setResult] = useState<{ key: string; factor: number | null }>({
    key: "",
    factor: null,
  });
  const key = enabled && sourceUrl && track ? `${sourceUrl}|${track.id}` : "";

  useEffect(() => {
    const controller = new AbortController();
    if (!key || !sourceUrl || !track) {
      return () => controller.abort();
    }
    void loadAssBaseFactor(
      {
        sourceUrl,
        track: track as AssNormalizeTrack,
        tracks: tracks as AssNormalizeTrack[],
        headers,
      },
      deps,
      controller.signal,
    ).then(
      (value) => setResult({ key, factor: value }),
      (error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResult({ key, factor: null });
        }
      },
    );
    return () => controller.abort();
  }, [key, sourceUrl, track, tracks, headers]);

  return result.key !== key || result.factor == null
    ? undefined
    : assScaleFromFactor(result.factor, targetFontSize);
}
