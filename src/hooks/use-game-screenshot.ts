import { useEffect, useRef, useState } from "react";
import { cacheableScreenshot } from "@/lib/games/screenshot-image-data";
import { screenshotImages } from "@/lib/games/screenshot-images";

export function useGameScreenshot(source: string, active = true) {
  const [result, setResult] = useState({ source: "", url: "", failed: false }), [attempt, setAttempt] = useState(0);
  const current = useRef(source); current.current = source;
  const cached = cacheableScreenshot(source);
  useEffect(() => {
    if (!active || !cached) return;
    const controller = new AbortController(); let url = "";
    setResult({ source, url: "", failed: false });
    void screenshotImages.load(source, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob); setResult({ source, url, failed: false });
    // Web image hosts may allow <img> while denying readable cross-origin bytes.
    // Preserve that existing online display path; only validated blobs are cached.
    }, () => { if (!controller.signal.aborted) setResult({ source, url: source, failed: false }); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [source, active, cached, attempt]);
  return {
    url: cached ? result.source === source ? result.url : "" : source,
    failed: result.source === source && result.failed,
    fail: () => { setResult({ source, url: "", failed: true }); if (cached) void screenshotImages.invalidate(source); },
    retry: async () => { if (cached) await screenshotImages.invalidate(source); if (current.current !== source) return; setResult({ source, url: "", failed: false }); setAttempt(value => value + 1); },
    attempt,
  };
}
