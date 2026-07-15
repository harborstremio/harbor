import { safeFetch } from "@/lib/safe-fetch";
import { fingerprint } from "@/lib/skip-intro/fingerprint";
import type { PlayerStreamRef } from "@/lib/view";

const REPORT_URL = (import.meta.env.VITE_AD_REPORT_ENDPOINT as string | undefined) || "";

export type AdRange = { startSec: number; endSec: number };

export async function submitAdReport(input: {
  metaId: string;
  imdbId: string | null;
  streamRef: PlayerStreamRef | undefined;
  url: string;
  ranges: AdRange[];
}): Promise<boolean> {
  if (!REPORT_URL) return false;
  const { content, source } = fingerprint(input.metaId, input.imdbId, input.streamRef, input.url);
  if (!source.startsWith("ih_") && !source.startsWith("rg_")) return false;
  const ranges = input.ranges
    .map((r) => ({
      start: Math.round(Math.min(r.startSec, r.endSec)),
      end: Math.round(Math.max(r.startSec, r.endSec)),
    }))
    .filter((r) => r.end > r.start);
  if (ranges.length === 0) return false;
  try {
    const res = await safeFetch(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, source, ranges }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
