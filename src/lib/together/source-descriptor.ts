import type { PlayerStreamRef } from "@/lib/view";

import type { SourceDescriptor } from "./protocol";

const HASH_RX = /^[0-9a-f]{16,64}$/;

export function normalizeResolution(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim().toLowerCase();
  if (!t) return undefined;
  if (t === "4k" || t === "2160p" || t === "uhd") return "2160p";
  return t.slice(0, 16);
}

export function buildSourceDescriptor(
  ref: PlayerStreamRef | null | undefined,
  durationSec?: number,
): SourceDescriptor | null {
  const out: SourceDescriptor = {};
  const title = (ref?.parsedTitle || ref?.title || "").trim();
  if (title) out.title = title.slice(0, 200);
  const resolution = normalizeResolution(ref?.resolution);
  if (resolution) out.resolution = resolution;
  if (typeof ref?.size === "number" && Number.isFinite(ref.size) && ref.size > 0) {
    out.sizeBytes = Math.round(ref.size);
  }
  const hash = ref?.infoHash?.trim().toLowerCase();
  if (hash && HASH_RX.test(hash)) {
    out.infoHash = hash;
    if (typeof ref?.fileIdx === "number" && Number.isInteger(ref.fileIdx) && ref.fileIdx >= 0) {
      out.fileIdx = ref.fileIdx;
    }
  }
  if (typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > 0) {
    out.durationSec = Math.round(durationSec * 10) / 10;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function descriptorsEqual(
  a: SourceDescriptor | null | undefined,
  b: SourceDescriptor | null | undefined,
): boolean {
  if (!a || !b) return !a === !b;
  return (
    a.title === b.title &&
    a.resolution === b.resolution &&
    a.sizeBytes === b.sizeBytes &&
    a.infoHash === b.infoHash &&
    a.fileIdx === b.fileIdx &&
    a.durationSec === b.durationSec
  );
}

export function formatRuntime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
