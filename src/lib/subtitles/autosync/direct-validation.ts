import {
  measuredQuality,
  unknownQuality,
  type AlignmentQuality,
  type QualityMeasurement,
  type QualityMeasurementRequest,
  type QualityValidationWindow,
  type SyncTransform,
} from "./fp-gate";
import type { PipelineContext } from "./pipeline";

export const DIRECT_HELD_OUT_PROVENANCE = "direct-middle-held-out-v2";
export const DIRECT_EXPLICIT_HELD_OUT_PROVENANCE = "direct-explicit-held-out-v1";
export const TORRENT_HELD_OUT_PROVENANCE = "torrent-middle-held-out-v1";
export const TORRENT_EXPLICIT_HELD_OUT_PROVENANCE = "torrent-explicit-held-out-v1";
const DEFAULT_VALIDATION_WINDOWS = ["validation-middle-a", "validation-middle-b"] as const;
const RANGE_EPSILON_SEC = 0.002;

export type NativeScoredWindow = QualityValidationWindow;

export type NativeDirectScore = AlignmentQuality & {
  windowIds?: string[];
  windows?: NativeScoredWindow[];
  provenance?: string;
  requestProvenance?: string;
};

export function directScoreInvokeArgs(
  ctx: PipelineContext,
  transform: SyncTransform,
  request?: QualityMeasurementRequest,
): Record<string, unknown> {
  return {
    url: ctx.mediaUrl,
    headers: ctx.headers ?? null,
    cues: ctx.cues,
    durationSec: ctx.durationSec,
    transform,
    validation: request?.purpose === "validation",
    excludeWindowIds: request?.excludeWindowIds ?? [],
    validationWindows: request?.validationWindows ?? [],
    validationProvenance: request?.validationProvenance ?? null,
  };
}

export function torrentScoreInvokeArgs(
  ctx: PipelineContext,
  transform: Extract<SyncTransform, { kind: "affine" }>,
  infoHash: string,
  fileIdx: number,
  positionSec: number | null,
  request?: QualityMeasurementRequest,
): Record<string, unknown> {
  return {
    infoHash,
    fileIdx,
    url: ctx.mediaUrl,
    headers: ctx.headers ?? null,
    cues: ctx.cues,
    durationSec: ctx.durationSec,
    offsetSec: transform.offsetSec,
    ratio: transform.ratio,
    positionSec,
    validation: request?.purpose === "validation",
    excludeWindowIds: request?.excludeWindowIds ?? [],
    validationWindows: request?.validationWindows ?? [],
    validationProvenance: request?.validationProvenance ?? null,
  };
}

function sameWindow(actual: NativeScoredWindow, expected: QualityValidationWindow): boolean {
  return (
    actual.id === expected.id &&
    Number.isFinite(actual.fromSec) &&
    Number.isFinite(actual.toSec) &&
    Math.abs(actual.fromSec - expected.fromSec) <= RANGE_EPSILON_SEC &&
    Math.abs(actual.toSec - expected.toSec) <= RANGE_EPSILON_SEC
  );
}

function expectedProvenance(source: "direct" | "torrent", explicit: boolean): string {
  if (source === "torrent") {
    return explicit ? TORRENT_EXPLICIT_HELD_OUT_PROVENANCE : TORRENT_HELD_OUT_PROVENANCE;
  }
  return explicit ? DIRECT_EXPLICIT_HELD_OUT_PROVENANCE : DIRECT_HELD_OUT_PROVENANCE;
}

function trustworthyHeldOut(
  native: NativeDirectScore,
  request: QualityMeasurementRequest,
  source: "direct" | "torrent",
): { windowIds: string[]; windows?: QualityValidationWindow[] } | null {
  const ids = native.windowIds ?? [];
  const idSet = new Set(ids);
  if (ids.length === 0 || idSet.size !== ids.length) return null;

  const requested = request.validationWindows ?? [];
  const explicit = requested.length > 0;
  if (native.provenance !== expectedProvenance(source, explicit)) return null;
  if (
    request.validationProvenance !== undefined &&
    native.requestProvenance !== request.validationProvenance
  ) {
    return null;
  }

  let windows: QualityValidationWindow[] | undefined;
  if (explicit) {
    const nativeWindows = native.windows ?? [];
    const expectedIds = new Set(requested.map((window) => window.id));
    if (
      requested.length !== ids.length ||
      expectedIds.size !== requested.length ||
      nativeWindows.length !== requested.length ||
      requested.some((window) => !idSet.has(window.id))
    ) {
      return null;
    }
    const byId = new Map(nativeWindows.map((window) => [window.id, window]));
    if (
      requested.some((window) => {
        const actual = byId.get(window.id);
        return !actual || !sameWindow(actual, window);
      })
    ) {
      return null;
    }
    windows = requested.map((window) => ({ ...window }));
  } else if (
    ids.length !== DEFAULT_VALIDATION_WINDOWS.length ||
    DEFAULT_VALIDATION_WINDOWS.some((id) => !idSet.has(id))
  ) {
    return null;
  }

  const excluded = new Set(request.excludeWindowIds ?? []);
  return ids.some((id) => excluded.has(id)) ? null : { windowIds: ids, windows };
}

export function nativeScoreMeasurement(
  native: NativeDirectScore | null,
  request: QualityMeasurementRequest | undefined,
  method: string,
  source: "direct" | "torrent",
): QualityMeasurement {
  if (!native) return unknownQuality("insufficient-data", method);
  const quality = { ncc: native.ncc, coverage: native.coverage, z: native.z };
  if (request?.purpose !== "validation") return measuredQuality(quality, method);
  const trusted = trustworthyHeldOut(native, request, source);
  return trusted
    ? measuredQuality(quality, method, {
        kind: "held-out",
        windowIds: trusted.windowIds,
        windows: trusted.windows,
        provenance: native.provenance,
        requestProvenance: native.requestProvenance,
      })
    : unknownQuality("insufficient-data", method);
}

export function directScoreMeasurement(
  native: NativeDirectScore | null,
  request?: QualityMeasurementRequest,
  method = "subsync-score-transform",
): QualityMeasurement {
  return nativeScoreMeasurement(native, request, method, "direct");
}
