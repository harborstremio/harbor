import type { Settings } from "@/lib/settings/types";
import type { PlayerSrc } from "@/lib/view";
import { analyzeArabicSubtitleQuality } from "@/lib/subtitles/arabic-quality";
import { rankSubtitleCandidates, streamMatchDetail } from "@/lib/subtitles/candidate-ranking";
import { normalizeLang } from "@/lib/subtitles/language";
import { releaseOf, subtitleStreamDescriptor } from "@/lib/subtitles/provider-label";
import { providerSubtitleDownloadHeaders } from "@/lib/subtitles/provider-auth";
import type { StreamHints } from "@/lib/subtitles/stream-hints";
import type { ProviderCtx } from "@/lib/subtitles/autosync/sub-sources";
import type { SubResult, SubSearchQuery } from "@/lib/subtitles/types";
import { DEFAULT_BUNDLE, isReleaseReady, type CalibrationBundle } from "./calibration";
import {
  outcomeRank,
  THRESHOLDS,
  type AlignmentQuality,
  type HeldOutValidation,
  type QualityMeasurement,
  type QualityMeasurementRequest,
  type SyncTransform,
} from "./fp-gate";
import { DIRECT_HELD_OUT_PROVENANCE, TORRENT_HELD_OUT_PROVENANCE } from "./direct-validation";
import type { PipelineContext, PipelineOutcome, TierPorts } from "./pipeline";
import type { StructuralCue } from "./monotonic-align";
import {
  runPivotWorkflow,
  type PivotAudioValidation,
  type PivotCandidate,
  type PivotHeldOutWindow,
  type PivotWorkflowResult,
  type TargetAudioValidation,
} from "./pivot";

const IDENTITY: SyncTransform = { kind: "affine", offsetSec: 0, ratio: 1 };
const SEARCH_TIMEOUT_MS = 8_000;
const ADDON_DISCOVERY_TIMEOUT_MS = 4_000;
const DEFAULT_MAX_CANDIDATES = 3;
const MIN_HEALTHY_CUES = 8;
const MIN_HELD_OUT_WINDOWS = 3;
const MIN_PIVOT_AUDIO_NCC = 0.55;
const MIN_PIVOT_AUDIO_COVERAGE = 0.55;
const QUALITY_DELTA_EPSILON = 1e-9;
export const PIVOT_HELD_OUT_PROVENANCE = "pivot-anchor-held-out-v1";
export const PIVOT_VAD_HELD_OUT_PROVENANCE = "pivot-vad-held-out-v1";
const TRUSTED_VAD_HELD_OUT_PROVENANCE = new Set([
  DIRECT_HELD_OUT_PROVENANCE,
  TORRENT_HELD_OUT_PROVENANCE,
]);

export type PivotRuntimeSettings = Pick<
  Settings,
  | "subtitleAutoSyncPivot"
  | "autoSyncApplyStructural"
  | "subProvidersEnabled"
  | "subdlApiKey"
  | "subsourceApiKey"
>;

export type PivotRuntimeDependencies = {
  searchSubtitles?: typeof import("@/lib/subtitles/search").searchSubtitles;
  gatherSubtitleAddons?: typeof import("@/lib/subtitles/addon-source").gatherSubtitleAddons;
  prepareSubtitle?: typeof import("@/lib/subtitles/prepare").prepareSubtitle;
  calibration?: CalibrationBundle;
  maxCandidates?: number;
};

export type ExperimentalPivotArgs = {
  ctx: PipelineContext;
  ports: TierPorts;
  settings: PivotRuntimeSettings;
  src: PlayerSrc;
  authKey?: string | null;
};

type CueHealth = {
  healthy: boolean;
  diagnostics: string[];
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function baseLanguage(value: string | null | undefined): string {
  return normalizeLang(value ?? "").split("-")[0];
}

export function isExperimentalPivotEligible(
  ctx: PipelineContext,
  settings: Pick<PivotRuntimeSettings, "subtitleAutoSyncPivot">,
): boolean {
  const audioLanguage = baseLanguage(ctx.audioLanguage);
  const subtitleLanguage = baseLanguage(ctx.subtitleLanguage);
  return (
    settings.subtitleAutoSyncPivot === true &&
    audioLanguage.length > 0 &&
    subtitleLanguage.length > 0 &&
    audioLanguage !== subtitleLanguage &&
    Array.isArray(ctx.cueText) &&
    ctx.cues.length >= MIN_HEALTHY_CUES &&
    ctx.cueText.length === ctx.cues.length &&
    (ctx.subtitleFormat === "srt" || ctx.subtitleFormat === "vtt")
  );
}

function streamHints(src: PlayerSrc): StreamHints {
  return {
    release: src.streamRef?.title ?? src.streamRef?.parsedTitle ?? null,
    source: src.streamRef?.source ?? null,
    resolution: src.streamRef?.resolution ?? null,
    season: src.episode?.imdbSeason ?? src.episode?.season ?? null,
    episode: src.episode?.imdbEpisode ?? src.episode?.episode ?? null,
  };
}

function tmdbId(src: PlayerSrc, ctx: PipelineContext): string | undefined {
  if (ctx.meta?.tmdbId != null) return String(ctx.meta.tmdbId);
  const match = /^tmdb:(\d+)$/iu.exec(src.meta.id);
  return match?.[1];
}

export function buildPivotSearchQuery(
  src: PlayerSrc,
  ctx: PipelineContext,
  audioLanguage: string,
): SubSearchQuery {
  const season = src.episode?.imdbSeason ?? src.episode?.season ?? ctx.meta?.season;
  const episode = src.episode?.imdbEpisode ?? src.episode?.episode ?? ctx.meta?.episode;
  const series = season != null && episode != null;
  return {
    imdbId: src.imdbId ?? ctx.meta?.imdbId,
    tmdbId: tmdbId(src, ctx),
    stremioId: src.meta.id,
    type: series || src.meta.type === "series" ? "series" : "movie",
    title: src.meta.name,
    season,
    episode,
    langs: [audioLanguage],
    videoHash: ctx.moviehash,
    videoSize: ctx.moviebytesize,
    filename: subtitleStreamDescriptor(src.streamRef),
  };
}

function extraProviderContext(settings: PivotRuntimeSettings): ProviderCtx | undefined {
  const enabled = settings.subProvidersEnabled ?? {};
  const subdl = enabled.subdl === true && settings.subdlApiKey.trim().length > 0;
  const subsource = enabled.subsource === true && settings.subsourceApiKey.trim().length > 0;
  if (!subdl && !subsource) return undefined;
  return {
    userAgent: "Harbor",
    netAllowed: true,
    subdlApiKey: subdl ? settings.subdlApiKey : null,
    subsourceApiKey: subsource ? settings.subsourceApiKey : null,
    enabled: { subdl, subsource },
    timeoutMs: SEARCH_TIMEOUT_MS,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function confidenceScore(confidence: string | undefined): number {
  switch (confidence) {
    case "exact":
      return 1;
    case "high":
      return 0.92;
    case "medium":
      return 0.72;
    case "low":
      return 0.42;
    case "unknown":
      return 0.25;
    default:
      return 0;
  }
}

function providerScore(result: SubResult): number {
  const raw = result.providerMatch?.score;
  if (raw == null || !Number.isFinite(raw)) return 0;
  return clamp01(raw > 1 ? raw / 100 : raw);
}

function pivotCandidateOf(result: SubResult, hints: StreamHints, index: number): PivotCandidate {
  const local = streamMatchDetail(result, hints);
  const exactRelease =
    result.hash === "moviehash" ||
    result.providerMatch?.confidence === "exact" ||
    local.exactHash ||
    local.confidence === "exact";
  const releaseScore = exactRelease
    ? 1
    : Math.max(
        providerScore(result),
        confidenceScore(result.providerMatch?.confidence),
        confidenceScore(local.confidence),
      );
  const editionPenalty =
    (local.confidence === "incompatible" ? 1 : 0) +
    (result.machineTranslated === true ? 0.15 : 0) +
    (result.episodeConfirmed === false ? 0.15 : 0);
  return {
    id: `${result.source}:${result.id}:${index}`,
    language: result.lang,
    exactRelease,
    releaseScore,
    wrongEditionRisk: clamp01(Math.max(1 - releaseScore, editionPenalty)),
    popularity: result.downloads ?? 0,
    source: result.source,
  };
}

function structuralCues(ctx: PipelineContext): StructuralCue[] {
  const text = ctx.cueText ?? [];
  return ctx.cues.map(([start, end], index) => ({
    start,
    end,
    text: text[index] ?? "",
  }));
}

function cueHealth(
  cues: readonly StructuralCue[],
  language: string,
  rawText: string,
  encodingHealth?: number,
): CueHealth {
  const invalidTiming = cues.filter(
    (cue) =>
      !Number.isFinite(cue.start) ||
      !Number.isFinite(cue.end) ||
      cue.start < 0 ||
      cue.end <= cue.start,
  ).length;
  const empty = cues.filter((cue) => cue.text.trim().length === 0).length;
  const replacementCharacters = [...rawText.matchAll(/\uFFFD/gu)].length;
  const unexpectedControls = [...rawText].filter((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint <= 0x08 ||
      codePoint === 0x0b ||
      codePoint === 0x0c ||
      (codePoint >= 0x0e && codePoint <= 0x1f) ||
      (codePoint >= 0x7f && codePoint <= 0x9f)
    );
  }).length;
  const diagnostics: string[] = [];
  if (cues.length < MIN_HEALTHY_CUES) diagnostics.push("too-few-cues");
  if (invalidTiming > 0) diagnostics.push("invalid-cue-timing");
  if (empty > Math.max(1, Math.floor(cues.length * 0.05))) diagnostics.push("empty-cues");
  if (replacementCharacters > 0) diagnostics.push("replacement-characters");
  if (unexpectedControls > 0) diagnostics.push("unexpected-controls");
  if (encodingHealth !== undefined && encodingHealth < 0.72) {
    diagnostics.push("decode-health-low");
  }

  if (baseLanguage(language) === "ar") {
    const quality = analyzeArabicSubtitleQuality(rawText, cues, {
      encodingHealthy: encodingHealth === undefined ? undefined : encodingHealth >= 0.72,
    });
    if (!quality.healthy) diagnostics.push("arabic-quality-unhealthy");
    if (quality.arabicCueRatio < 0.5) diagnostics.push("arabic-script-coverage-low");
  }
  return { healthy: diagnostics.length === 0, diagnostics };
}

type TrustedHeldOutMeasurement = {
  quality: AlignmentQuality;
  validation: HeldOutValidation;
};

function trustedVadHeldOutMeasurement(
  measurement: QualityMeasurement,
  request: QualityMeasurementRequest,
): TrustedHeldOutMeasurement | null {
  if (measurement.status !== "measured" || measurement.validation?.kind !== "held-out") {
    return null;
  }
  const validation = measurement.validation;
  if (
    !validation.provenance ||
    !TRUSTED_VAD_HELD_OUT_PROVENANCE.has(validation.provenance) ||
    validation.requestProvenance !== request.validationProvenance
  ) {
    return null;
  }
  const windowIds = validation.windowIds;
  const uniqueWindowIds = new Set(windowIds);
  const excludedWindowIds = new Set(request.excludeWindowIds ?? []);
  if (
    windowIds.length === 0 ||
    uniqueWindowIds.size !== windowIds.length ||
    windowIds.some((id) => excludedWindowIds.has(id))
  ) {
    return null;
  }
  return { quality: measurement.value, validation };
}

function sameHeldOutEvidence(
  identity: TrustedHeldOutMeasurement,
  fitted: TrustedHeldOutMeasurement,
): boolean {
  if (identity.validation.provenance !== fitted.validation.provenance) return false;
  const identityIds = new Set(identity.validation.windowIds);
  const fittedIds = fitted.validation.windowIds;
  return fittedIds.length === identityIds.size && fittedIds.every((id) => identityIds.has(id));
}

function validFitWindowIds(windowIds: readonly string[] | undefined): string[] | null {
  if (!windowIds?.length || windowIds.some((id) => id.trim().length === 0)) return null;
  const unique = new Set(windowIds);
  return unique.size === windowIds.length ? [...windowIds] : null;
}

async function validatePivotAudio(
  ctx: PipelineContext,
  ports: TierPorts,
): Promise<PivotAudioValidation> {
  const fitted = ports.vadAffine
    ? await ports.vadAffine(ctx, { earlyWindow: true, lateWindow: true })
    : null;
  const fitWindowIds = validFitWindowIds(fitted?.fitWindowIds);
  const request: QualityMeasurementRequest = {
    purpose: "validation",
    validationProvenance: PIVOT_VAD_HELD_OUT_PROVENANCE,
    ...(fitWindowIds ? { excludeWindowIds: fitWindowIds } : {}),
  };
  const [identityMeasurement, fittedMeasurement] = await Promise.all([
    ports.measureQuality(ctx, IDENTITY, request),
    fitted && fitWindowIds ? ports.measureQuality(ctx, fitted.transform, request) : null,
  ]);
  const identity = trustedVadHeldOutMeasurement(identityMeasurement, request);
  const fittedHeldOut = fittedMeasurement
    ? trustedVadHeldOutMeasurement(fittedMeasurement, request)
    : null;
  let best = identity
    ? { transform: IDENTITY as SyncTransform, quality: identity.quality, fitted: false }
    : null;
  if (
    identity &&
    fitted &&
    fitWindowIds &&
    fittedHeldOut &&
    sameHeldOutEvidence(identity, fittedHeldOut) &&
    fittedHeldOut.quality.ncc - identity.quality.ncc + QUALITY_DELTA_EPSILON >=
      THRESHOLDS.minImprovement &&
    fittedHeldOut.quality.ncc >= MIN_PIVOT_AUDIO_NCC &&
    fittedHeldOut.quality.coverage >= MIN_PIVOT_AUDIO_COVERAGE
  ) {
    best = { transform: fitted.transform, quality: fittedHeldOut.quality, fitted: true };
  }
  if (!best) {
    return {
      validated: false,
      transform: IDENTITY,
      score: 0,
      coverage: 0,
      diagnostics: ["pivot-audio-quality-unknown"],
    };
  }
  return {
    validated:
      best.quality.ncc >= MIN_PIVOT_AUDIO_NCC && best.quality.coverage >= MIN_PIVOT_AUDIO_COVERAGE,
    transform: best.transform,
    score: best.quality.ncc,
    coverage: best.quality.coverage,
    wrongCut: best.quality.ncc < 0.25 || best.quality.coverage < 0.2,
    diagnostics: [
      "pivot-audio-quality-measured",
      best.fitted ? "pivot-vad-held-out-improvement" : "pivot-identity-held-out-preferred",
    ],
  };
}

function heldOutCueContext(
  ctx: PipelineContext,
  windows: readonly PivotHeldOutWindow[],
): PipelineContext | null {
  if (windows.length < MIN_HELD_OUT_WINDOWS) return null;
  const cues = structuralCues(ctx);
  const selected = new Set<number>();
  for (const window of windows) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < cues.length; index += 1) {
      const center = (cues[index].start + cues[index].end) / 2;
      const distance = Math.abs(center - window.sourceSec);
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }
    if (bestIndex < 0 || bestDistance > 8) return null;
    selected.add(bestIndex);
  }
  if (selected.size < MIN_HELD_OUT_WINDOWS) return null;
  const indexes = [...selected].sort((left, right) => left - right);
  return {
    ...ctx,
    cues: indexes.map((index) => [cues[index].start, cues[index].end] as [number, number]),
    cueText: indexes.map((index) => cues[index].text),
  };
}

export function pivotHeldOutQualityRequest(
  windows: readonly PivotHeldOutWindow[],
  durationSec: number,
): QualityMeasurementRequest | null {
  const validationWindows = windows
    .map((window, index) => ({
      id: `pivot-held-out-${index + 1}`,
      fromSec: Math.max(0, window.fromSec),
      toSec: Math.min(durationSec, window.toSec),
    }))
    .sort((left, right) => left.fromSec - right.fromSec || left.id.localeCompare(right.id));
  if (
    validationWindows.length < MIN_HELD_OUT_WINDOWS ||
    validationWindows.some(
      (window, index) =>
        !Number.isFinite(window.fromSec) ||
        !Number.isFinite(window.toSec) ||
        window.toSec - window.fromSec < 2 ||
        (index > 0 && validationWindows[index - 1].toSec > window.fromSec),
    )
  ) {
    return null;
  }
  return {
    purpose: "validation",
    validationWindows,
    validationProvenance: PIVOT_HELD_OUT_PROVENANCE,
  };
}

function measuredHeldOutValue(
  measurement: QualityMeasurement,
  request: QualityMeasurementRequest,
): AlignmentQuality | null {
  if (measurement.status !== "measured" || measurement.validation?.kind !== "held-out") {
    return null;
  }
  const expectedIds = new Set((request.validationWindows ?? []).map((window) => window.id));
  const actualIds = measurement.validation.windowIds;
  if (
    expectedIds.size === 0 ||
    actualIds.length !== expectedIds.size ||
    actualIds.some((id) => !expectedIds.has(id)) ||
    measurement.validation.requestProvenance !== request.validationProvenance
  ) {
    return null;
  }
  return measurement.value;
}

async function validateHeldOutTargetAudio(
  ctx: PipelineContext,
  ports: TierPorts,
  transform: SyncTransform,
  windows: readonly PivotHeldOutWindow[],
): Promise<TargetAudioValidation> {
  const heldOut = heldOutCueContext(ctx, windows);
  if (!heldOut) throw new Error("held-out target cues are unavailable");
  const request = pivotHeldOutQualityRequest(windows, ctx.durationSec);
  if (!request) throw new Error("held-out target ranges are invalid or overlapping");
  const [beforeMeasurement, afterMeasurement] = await Promise.all([
    ports.measureQuality(heldOut, IDENTITY, request),
    ports.measureQuality(heldOut, transform, request),
  ]);
  const before = measuredHeldOutValue(beforeMeasurement, request);
  const after = measuredHeldOutValue(afterMeasurement, request);
  if (!before || !after) throw new Error("held-out target audio measurement is unavailable");
  return {
    qualityBefore: before.ncc,
    qualityAfter: after.ncc,
    coverage: after.coverage,
    heldOutAudioMeasured: true,
    wrongCut: after.ncc < 0.3 || after.coverage < 0.25,
  };
}

function resultConfidence(result: PivotWorkflowResult): number {
  const release = result.candidate?.releaseScore ?? 0;
  const alignment = result.alignment?.confidence ?? 0;
  const audio = result.evidence?.pivotAudioScore ?? 0;
  const raw = clamp01(release * 0.3 + alignment * 0.4 + audio * 0.3);
  if (result.decision.decision === "apply") return Math.max(0.9, raw);
  if (result.decision.decision === "offer") return Math.min(0.89, raw);
  return Math.min(0.64, raw);
}

function toPipelineOutcome(result: PivotWorkflowResult): PipelineOutcome | null {
  if (!result.transform) return null;
  return {
    decision: {
      decision: result.decision.decision,
      reason: result.decision.reason,
      bindingRule: result.decision.bindingRule,
      pCorrect: resultConfidence(result),
      transform: result.transform,
    },
    candidate: result.transform,
    evidence: [],
    tiersRun: [],
  };
}

export function preferAutoSyncOutcome(
  base: PipelineOutcome,
  pivot: PipelineOutcome | null,
): PipelineOutcome {
  if (!pivot) return base;
  const baseRank = outcomeRank(base.decision.decision);
  const pivotRank = outcomeRank(pivot.decision.decision);
  if (pivotRank !== baseRank) return pivotRank > baseRank ? pivot : base;
  return pivot.decision.pCorrect > base.decision.pCorrect + 0.02 ? pivot : base;
}

export async function runExperimentalPivotAutoSync(
  args: ExperimentalPivotArgs,
  dependencies: PivotRuntimeDependencies = {},
): Promise<PipelineOutcome | null> {
  const { ctx, ports, settings, src, authKey } = args;
  if (!isExperimentalPivotEligible(ctx, settings)) return null;

  const audioLanguage = baseLanguage(ctx.audioLanguage);
  const subtitleLanguage = baseLanguage(ctx.subtitleLanguage);
  const targetCues = structuralCues(ctx);
  const targetHealth = cueHealth(
    targetCues,
    subtitleLanguage,
    targetCues.map((cue) => cue.text).join("\n"),
  );
  if (!targetHealth.healthy) return null;

  const search =
    dependencies.searchSubtitles ?? (await import("@/lib/subtitles/search")).searchSubtitles;
  const discoverAddons =
    dependencies.gatherSubtitleAddons ??
    (await import("@/lib/subtitles/addon-source")).gatherSubtitleAddons;
  const prepare =
    dependencies.prepareSubtitle ?? (await import("@/lib/subtitles/prepare")).prepareSubtitle;
  const calibration = dependencies.calibration ?? DEFAULT_BUNDLE;
  const hints = streamHints(src);
  const query = buildPivotSearchQuery(src, ctx, audioLanguage);
  const byCandidateId = new Map<string, SubResult>();
  const cleanups: Array<() => void> = [];

  try {
    const workflow = await runPivotWorkflow(
      {
        audioLanguage,
        subtitleLanguage,
        targetCues,
        targetHealthy: targetHealth.healthy,
        targetFormatSafe: ctx.subtitleFormat === "srt" || ctx.subtitleFormat === "vtt",
        calibrationReady: settings.autoSyncApplyStructural === true && isReleaseReady(calibration),
        maxCandidates: dependencies.maxCandidates ?? DEFAULT_MAX_CANDIDATES,
      },
      {
        searchPivotCandidates: async () => {
          const addons =
            settings.subProvidersEnabled.addons === false
              ? []
              : await withTimeout(discoverAddons(authKey ?? null), ADDON_DISCOVERY_TIMEOUT_MS, []);
          const found = await search(query, {
            timeoutMs: SEARCH_TIMEOUT_MS,
            providers: {
              wyzie: settings.subProvidersEnabled.wyzie === true,
              addons: settings.subProvidersEnabled.addons !== false,
              opensubtitles: settings.subProvidersEnabled.opensubtitles !== false,
            },
            addons,
            preferredLangs: [audioLanguage],
            streamHints: hints,
            extra: extraProviderContext(settings),
          });
          return rankSubtitleCandidates(found, [audioLanguage], hints).map((result, index) => {
            const candidate = pivotCandidateOf(result, hints, index);
            byCandidateId.set(candidate.id, result);
            return candidate;
          });
        },
        preparePivotCandidate: async (candidate) => {
          const result = byCandidateId.get(candidate.id);
          if (!result?.url) throw new Error("pivot candidate URL is unavailable");
          const prepared = await prepare({
            url: result.url,
            format: result.format,
            encoding: result.encoding,
            language: result.lang,
            season: query.season,
            episode: query.episode,
            release: releaseOf(result) ?? hints.release ?? undefined,
            filename: result.rawFilename ?? query.filename,
            durationSec: ctx.durationSec,
            requestHeaders: providerSubtitleDownloadHeaders(result.downloadAuth, result.url),
          });
          cleanups.push(prepared.cleanup);
          const health = cueHealth(
            prepared.cues,
            result.lang,
            prepared.text,
            prepared.encodingHealth,
          );
          return {
            cues: prepared.cues,
            healthy: health.healthy,
            formatSafe: true,
            diagnostics: [
              ...health.diagnostics,
              ...prepared.encodingDiagnostics.map((diagnostic) => diagnostic.code),
            ],
          };
        },
        validatePivotAgainstAudio: async (_candidate, prepared) => {
          const pivotCtx: PipelineContext = {
            ...ctx,
            cues: prepared.cues.map((cue) => [cue.start, cue.end] as [number, number]),
            cueText: prepared.cues.map((cue) => cue.text),
            audioLanguage,
            subtitleLanguage: audioLanguage,
            preferredSubtitleLanguages: [audioLanguage],
            languages: [audioLanguage],
          };
          return validatePivotAudio(pivotCtx, ports);
        },
        validateTargetAgainstAudio: (_cues, transform, heldOutWindows) =>
          validateHeldOutTargetAudio(ctx, ports, transform, heldOutWindows),
      },
    );
    return toPipelineOutcome(workflow);
  } finally {
    for (const cleanup of cleanups) cleanup();
  }
}
