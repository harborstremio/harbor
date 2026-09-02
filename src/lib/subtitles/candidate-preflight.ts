import { invoke } from "@tauri-apps/api/core";
import type { PreparedSubtitle, PreparedCandidateResult } from "./prepare";

type TimingQuality = { ncc: number; coverage: number; z: number };
type TimingTransform = { offsetSec: number; ratio: number };

export type TimingMeasurement =
  | {
      status: "measured";
      value: TimingQuality;
      best?: TimingQuality;
      bestTransform?: TimingTransform;
      method: "identity-audio-preflight" | "bounded-audio-preflight";
    }
  | {
      status: "unknown";
      reason:
        | "timeout"
        | "ffmpeg-unavailable"
        | "audio-unavailable"
        | "not-supported"
        | "insufficient-data"
        | "provider-error";
    };

export type SubtitleTimingStatus =
  | "not-tested"
  | "aligned"
  | "fixed-offset"
  | "drifting"
  | "different-cut"
  | "unmeasurable"
  | "invalid";

export type SubtitleMatchExplanation = {
  compatibilityPercent: number;
  releaseConfidence: string;
  timingStatus: SubtitleTimingStatus;
  reasons: string[];
};

export type PreparedSubtitlePreflight<T> = {
  candidate: T;
  prepared: PreparedSubtitle;
  rank: number;
  measurement: TimingMeasurement;
  timingStatus: SubtitleTimingStatus;
  cueSpanSane: boolean;
  outputFormatSafe: boolean;
  explanation: SubtitleMatchExplanation;
};

export type CandidatePreflightContext = {
  mediaUrl: string;
  headers?: Record<string, string>;
  durationSec: number;
  timeoutMs?: number;
};

export type CandidatePreflightProbe = (
  prepared: PreparedSubtitle,
  context: CandidatePreflightContext,
) => Promise<TimingMeasurement>;

type NativePreflightScore = {
  id: string;
  invalid: boolean;
  identity?: TimingQuality | null;
  best?: TimingQuality | null;
  offsetSec?: number | null;
  ratio?: number | null;
  windowIds?: string[];
  provenance?: string;
};

const ALIGNED_NCC = 0.75;
const ALIGNED_COVERAGE = 0.65;
const ALIGNED_Z = 4;
const FIT_NCC = 0.55;
const FIT_COVERAGE = 0.55;
const FIT_Z = 4;
const MIN_FIT_GAIN = 0.08;
const OFFSET_EPSILON_SEC = 0.25;
const RATIO_EPSILON = 0.0015;
const MAX_PREFLIGHT_RATIO_DEVIATION = 0.08;
const PREFLIGHT_HELD_OUT_PROVENANCE = "direct-middle-held-out-v2";
const PREFLIGHT_HELD_OUT_WINDOWS = ["validation-middle-a", "validation-middle-b"] as const;

function unknownReason(
  error: unknown,
): Extract<TimingMeasurement, { status: "unknown" }>["reason"] {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/timeout|deadline|abort/i.test(message)) return "timeout";
  if (/ffmpeg/i.test(message)) return "ffmpeg-unavailable";
  if (/audio/i.test(message)) return "audio-unavailable";
  if (/unsupported|not supported/i.test(message)) return "not-supported";
  if (/insufficient|too few|duration|cues/i.test(message)) return "insufficient-data";
  return "provider-error";
}

function qualityValid(value: TimingQuality | null | undefined): value is TimingQuality {
  return (
    !!value &&
    Number.isFinite(value.ncc) &&
    Number.isFinite(value.coverage) &&
    Number.isFinite(value.z) &&
    value.ncc >= -1 &&
    value.ncc <= 1 &&
    value.coverage >= 0 &&
    value.coverage <= 1
  );
}

function heldOutEvidenceValid(score: NativePreflightScore): boolean {
  return (
    score.provenance === PREFLIGHT_HELD_OUT_PROVENANCE &&
    score.windowIds?.length === PREFLIGHT_HELD_OUT_WINDOWS.length &&
    score.windowIds.every((id, index) => id === PREFLIGHT_HELD_OUT_WINDOWS[index])
  );
}

function cueTimelineIssue(
  prepared: PreparedSubtitle,
  durationSec: number,
): "invalid" | "insufficient" | null {
  if (prepared.cues.length < 4) return "insufficient";
  let previousStart = -1;
  for (const cue of prepared.cues) {
    if (
      !Number.isFinite(cue.start) ||
      !Number.isFinite(cue.end) ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.start < previousStart ||
      (durationSec > 0 && cue.end > durationSec * 1.25 + 300)
    ) {
      return "invalid";
    }
    previousStart = cue.start;
  }
  return null;
}

function unknownMeasurements(
  count: number,
  reason: Extract<TimingMeasurement, { status: "unknown" }>["reason"],
): TimingMeasurement[] {
  return Array.from({ length: count }, () => ({ status: "unknown", reason }));
}

export async function probePreparedSubtitleBatch(
  prepared: readonly PreparedSubtitle[],
  context: CandidatePreflightContext,
): Promise<TimingMeasurement[]> {
  if (prepared.length === 0) return [];
  if (context.durationSec < 60) return unknownMeasurements(prepared.length, "insufficient-data");
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return unknownMeasurements(prepared.length, "not-supported");
  }

  const timeoutMs = context.timeoutMs ?? 12_000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const measured = await Promise.race([
      invoke<NativePreflightScore[] | null>("subsync_preflight_candidates", {
        url: context.mediaUrl,
        headers: context.headers ?? null,
        durationSec: context.durationSec,
        candidates: prepared.map((item, index) => ({
          id: String(index),
          cues: item.cues.map((cue) => [cue.start, cue.end]),
        })),
      }),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeoutMs);
      }),
    ]);
    if (measured === "timeout") return unknownMeasurements(prepared.length, "timeout");
    if (!Array.isArray(measured)) {
      return unknownMeasurements(prepared.length, "insufficient-data");
    }
    const byId = new Map(measured.map((score) => [score.id, score]));
    return prepared.map((_item, index): TimingMeasurement => {
      const score = byId.get(String(index));
      if (
        !score ||
        score.invalid ||
        !heldOutEvidenceValid(score) ||
        !qualityValid(score.identity)
      ) {
        return { status: "unknown", reason: "insufficient-data" };
      }
      const bestTransform =
        qualityValid(score.best) && Number.isFinite(score.offsetSec) && Number.isFinite(score.ratio)
          ? { offsetSec: Number(score.offsetSec), ratio: Number(score.ratio) }
          : undefined;
      return {
        status: "measured",
        value: score.identity,
        best: bestTransform && qualityValid(score.best) ? score.best : undefined,
        bestTransform,
        method: "bounded-audio-preflight",
      };
    });
  } catch (error) {
    return unknownMeasurements(prepared.length, unknownReason(error));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function probePreparedSubtitleIdentity(
  prepared: PreparedSubtitle,
  context: CandidatePreflightContext,
): Promise<TimingMeasurement> {
  return (
    (await probePreparedSubtitleBatch([prepared], context))[0] ?? {
      status: "unknown",
      reason: "insufficient-data",
    }
  );
}

export function classifyIdentityTiming(
  measurement: TimingMeasurement,
  timelineIssue: "invalid" | "insufficient" | null = null,
): SubtitleTimingStatus {
  if (timelineIssue === "invalid") return "invalid";
  if (timelineIssue === "insufficient" || measurement.status === "unknown") {
    return "unmeasurable";
  }
  const identity = measurement.value;
  if (
    identity.ncc >= ALIGNED_NCC &&
    identity.coverage >= ALIGNED_COVERAGE &&
    identity.z >= ALIGNED_Z
  ) {
    return "aligned";
  }

  const best = measurement.best;
  const transform = measurement.bestTransform;
  if (
    best &&
    transform &&
    best.ncc >= FIT_NCC &&
    best.coverage >= FIT_COVERAGE &&
    best.z >= FIT_Z &&
    best.ncc >= identity.ncc + MIN_FIT_GAIN &&
    Math.abs(transform.offsetSec) <= 60 &&
    Math.abs(transform.ratio - 1) <= MAX_PREFLIGHT_RATIO_DEVIATION
  ) {
    if (Math.abs(transform.ratio - 1) > RATIO_EPSILON) return "drifting";
    if (Math.abs(transform.offsetSec) >= OFFSET_EPSILON_SEC) return "fixed-offset";
  }
  return "different-cut";
}

function cueSpanSane(prepared: PreparedSubtitle, durationSec: number): boolean {
  if (cueTimelineIssue(prepared, durationSec) === "invalid") return false;
  const first = prepared.cues[0];
  const last = prepared.cues[prepared.cues.length - 1];
  return !!first && !!last && last.end > first.start;
}

function reasonsFor(
  timingStatus: SubtitleTimingStatus,
  measurement: TimingMeasurement,
  prepared: PreparedSubtitle,
): string[] {
  const reasons: string[] = [];
  if (prepared.archive) reasons.push(`prepared ${prepared.rawFilename ?? "subtitle"} from archive`);
  if (timingStatus === "aligned") reasons.push("audio timing verified");
  if (timingStatus === "fixed-offset") reasons.push("audio timing has a stable offset");
  if (timingStatus === "drifting") reasons.push("audio timing shows systematic drift");
  if (timingStatus === "different-cut") reasons.push("audio timing suggests a different cut");
  if (timingStatus === "invalid") reasons.push("subtitle cue timeline is invalid");
  if (measurement.status === "unknown") reasons.push("timing could not be measured");
  if (prepared.format === "ass" || prepared.format === "ssa") {
    reasons.push("styled subtitle preserved without structural rewriting");
  }
  return reasons;
}

export async function preflightPreparedCandidates<T>(
  preparedResults: PreparedCandidateResult<T>[],
  context: CandidatePreflightContext,
  options: {
    probe?: CandidatePreflightProbe;
    compatibilityPercent?: (candidate: T) => number;
    releaseConfidence?: (candidate: T) => string;
    reasons?: (candidate: T) => string[];
  } = {},
): Promise<PreparedSubtitlePreflight<T>[]> {
  const successful = preparedResults.filter(
    (result): result is Extract<PreparedCandidateResult<T>, { status: "prepared" }> =>
      result.status === "prepared",
  );
  const measurements = options.probe
    ? await Promise.all(successful.map((result) => options.probe!(result.prepared, context)))
    : await probePreparedSubtitleBatch(
        successful.map((result) => result.prepared),
        context,
      );

  return successful.map((result, index) => {
    const measurement = measurements[index] ?? {
      status: "unknown" as const,
      reason: "insufficient-data" as const,
    };
    const timingStatus = classifyIdentityTiming(
      measurement,
      cueTimelineIssue(result.prepared, context.durationSec),
    );
    const explanationReasons = [
      ...(options.reasons?.(result.candidate) ?? []),
      ...reasonsFor(timingStatus, measurement, result.prepared),
    ];
    return {
      candidate: result.candidate,
      prepared: result.prepared,
      rank: result.rank,
      measurement,
      timingStatus,
      cueSpanSane: cueSpanSane(result.prepared, context.durationSec),
      outputFormatSafe: true,
      explanation: {
        compatibilityPercent: options.compatibilityPercent?.(result.candidate) ?? 0,
        releaseConfidence: options.releaseConfidence?.(result.candidate) ?? "unknown",
        timingStatus,
        reasons: [...new Set(explanationReasons)],
      },
    };
  });
}

export function choosePreparedCandidate<T>(
  candidates: PreparedSubtitlePreflight<T>[],
  options: { rankOf?: (candidate: PreparedSubtitlePreflight<T>) => number } = {},
): PreparedSubtitlePreflight<T> | null {
  const eligible = candidates.filter(
    (candidate) =>
      candidate.cueSpanSane &&
      candidate.outputFormatSafe &&
      candidate.timingStatus !== "different-cut" &&
      candidate.timingStatus !== "invalid",
  );
  return orderPreparedCandidates(eligible, options)[0] ?? null;
}

export function orderPreparedCandidates<T>(
  candidates: PreparedSubtitlePreflight<T>[],
  options: { rankOf?: (candidate: PreparedSubtitlePreflight<T>) => number } = {},
): PreparedSubtitlePreflight<T>[] {
  return candidates.slice().sort((left, right) => {
    return (
      Number(right.timingStatus === "aligned") - Number(left.timingStatus === "aligned") ||
      (options.rankOf ? options.rankOf(left) - options.rankOf(right) : left.rank - right.rank)
    );
  });
}

export function preparedCandidateAutoSelectionEligible<T>(
  candidate: PreparedSubtitlePreflight<T>,
  options: { autoSelect: boolean; selectionLeaseValid: boolean },
): boolean {
  return (
    options.autoSelect &&
    options.selectionLeaseValid &&
    candidate.cueSpanSane &&
    candidate.outputFormatSafe &&
    candidate.timingStatus !== "different-cut" &&
    candidate.timingStatus !== "invalid"
  );
}
