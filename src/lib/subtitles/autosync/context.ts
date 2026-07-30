import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "@/lib/settings/types";
import { dinfo, dwarn } from "@/lib/debug";
import { estimateSubtitleOffset } from "@/lib/subtitles/auto-sync";

import type {
  PipelineContext,
  PiecewiseResult,
  TierPorts,
  VadResult,
  HashExactResult,
  AsrWindowSpec,
  AsrPhrase,
} from "./pipeline";
import type { AlignmentQuality, PiecewiseSegment, SyncTransform } from "./fp-gate";
import { resolveTier0, resolveSwapCues, type OsConfig } from "./opensubtitles";
import { createConsensusPort, type ConsensusConfig } from "./consensus";
import { createCrowdDbPort, crowdConfigFromSettings } from "./crowd-db";

type AsrTokenRaw = { text?: string; t0?: number; t1?: number; p?: number };
type AsrWindowRaw = { startSec?: number; lenSec?: number; lang?: string; tokens?: AsrTokenRaw[] };

const PIECE_MARGIN = 0.1;
const PIECE_OFFSETS = [-2, 0, 2];

const NEUTRAL_QUALITY: AlignmentQuality = { ncc: 0.5, coverage: 0.5, z: 0 };
const TORRENT_BASELINE: AlignmentQuality = { ncc: 0.85, coverage: 0.8, z: 6 };
const CANDIDATE_COVERAGE = 0.8;

const SCORE_TIMEOUT_MS = 4000;
const VAD_TIMEOUT_MS = 45000;
const TORRENT_SCORE_TIMEOUT_MS = 6000;
const TORRENT_VAD_TIMEOUT_MS = 60000;
const HASH_TIMEOUT_MS = 4000;
const CROWD_TIMEOUT_MS = 3000;

function bounded<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export type AutoSyncExtraPorts = {
  measureQuality?: TierPorts["measureQuality"];
  crowdDb?: TierPorts["crowdDb"];
  vadPiecewise?: TierPorts["vadPiecewise"];
  asrMatch?: TierPorts["asrMatch"];
  metadataBounds?: TierPorts["metadataBounds"];
};

export type BuildTierPortsOpts = {
  osConfig?: OsConfig | null;
  extra?: AutoSyncExtraPorts;
  torrent?: { fileIdx?: number; getPositionSec?: () => number };
};

type AutoSyncFlags = {
  subtitleAutoSyncCrowd?: boolean;
  subtitleAutoSyncAsr?: boolean;
};

function flagsOf(settings: Settings): AutoSyncFlags {
  return settings as AutoSyncFlags;
}

function isTorrentSource(ctx: PipelineContext): boolean {
  return ctx.sourceKind === "torrent" && typeof ctx.infoHash === "string" && ctx.infoHash.length > 0;
}

function affineParams(t: SyncTransform): { offsetSec: number; ratio: number } {
  if (t.kind === "affine") return { offsetSec: t.offsetSec, ratio: t.ratio };
  const s = t.segments[0];
  return s ? { offsetSec: s.offsetSec, ratio: s.ratio } : { offsetSec: 0, ratio: 1 };
}

async function directScore(ctx: PipelineContext, transform: SyncTransform): Promise<AlignmentQuality> {
  try {
    const q = await invoke<AlignmentQuality | null>("subsync_score_transform", {
      url: ctx.mediaUrl,
      headers: ctx.headers ?? null,
      cues: ctx.cues,
      durationSec: ctx.durationSec,
      transform,
    });
    if (q && Number.isFinite(q.ncc)) return { ncc: q.ncc, coverage: q.coverage, z: q.z };
  } catch {}
  return NEUTRAL_QUALITY;
}

async function torrentScore(
  ctx: PipelineContext,
  transform: SyncTransform,
  infoHash: string,
  fileIdx: number,
  positionSec: number | null,
): Promise<AlignmentQuality> {
  const a = affineParams(transform);
  try {
    const q = await invoke<AlignmentQuality | null>("torrent_score_transform", {
      infoHash,
      fileIdx,
      url: ctx.mediaUrl,
      headers: ctx.headers ?? null,
      cues: ctx.cues,
      durationSec: ctx.durationSec,
      offsetSec: a.offsetSec,
      ratio: a.ratio,
      positionSec,
    });
    if (q && Number.isFinite(q.ncc)) return { ncc: q.ncc, coverage: q.coverage, z: q.z };
  } catch {}
  return TORRENT_BASELINE;
}

async function directVad(ctx: PipelineContext): Promise<VadResult | null> {
  try {
    const out = await estimateSubtitleOffset({
      mediaUrl: ctx.mediaUrl,
      headers: ctx.headers,
      cues: ctx.cues,
      durationSec: ctx.durationSec,
      infoHash: null,
    });
    if (!out) {
      dinfo("[autosync/vad] audio analyzed, no confident offset");
      return null;
    }
    dinfo(`[autosync/vad] offset=${out.offsetSec.toFixed(2)}s ratio=${out.ratio.toFixed(4)} conf=${out.confidence.toFixed(2)}`);
    const quality: AlignmentQuality = {
      ncc: out.confidence,
      coverage: CANDIDATE_COVERAGE,
      z: out.confidence >= 0.55 ? 8 : 0,
    };
    return { transform: { kind: "affine", offsetSec: out.offsetSec, ratio: out.ratio }, rawScore: out.confidence, quality };
  } catch (e) {
    dwarn("[autosync/vad] audio engine unavailable", String(e));
    return null;
  }
}

async function torrentVad(
  ctx: PipelineContext,
  wantLate: boolean,
  infoHash: string,
  fileIdx: number,
  positionSec: number | null,
): Promise<VadResult | null> {
  try {
    const out = await invoke<{ offsetSec: number; ratio: number; confidence: number } | null>("torrent_sync_subtitle", {
      infoHash,
      fileIdx,
      url: ctx.mediaUrl,
      headers: ctx.headers ?? null,
      cues: ctx.cues,
      durationSec: ctx.durationSec,
      confMin: null,
      wantLate,
      positionSec,
    });
    if (!out) return null;
    const quality: AlignmentQuality = {
      ncc: out.confidence,
      coverage: CANDIDATE_COVERAGE,
      z: out.confidence >= 0.55 ? 8 : 0,
    };
    return { transform: { kind: "affine", offsetSec: out.offsetSec, ratio: out.ratio }, rawScore: out.confidence, quality };
  } catch {
    return null;
  }
}

function hashExactPort(os: OsConfig): NonNullable<TierPorts["hashExact"]> {
  return async (ctx) => {
    const t0 = await resolveTier0({
      url: ctx.mediaUrl,
      headers: ctx.headers,
      size: ctx.moviebytesize,
      langs: ctx.languages,
      imdbId: ctx.meta?.imdbId,
      cfg: os,
    });
    if (t0.status !== "exact" || !t0.exact) return null;
    const file = t0.exact.files[0];
    const result: HashExactResult = {
      transform: { kind: "affine", offsetSec: 0, ratio: 1 },
      rawScore: t0.exact.fromTrusted ? 1 : Math.min(1, t0.exact.downloadCount / 200),
      subSwap: file
        ? { url: `os:file:${file.fileId}`, format: "srt", downloadCount: t0.exact.downloadCount }
        : undefined,
    };
    return result;
  };
}

export function defaultOsConfig(settings: Settings): OsConfig | null {
  if (settings.subProvidersEnabled?.opensubtitles === false) return null;
  const apiKey = settings.opensubtitlesApiKey || "";
  if (!apiKey) return null;
  return { apiKey, userAgent: "Harbor autosync" };
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function makePiecewisePort(score: TierPorts["measureQuality"]): NonNullable<TierPorts["vadPiecewise"]> {
  return async (ctx, seed) => {
    if (ctx.cues.length < 8) return null;
    const starts = ctx.cues.map((c) => c[0]);
    const mid = median(starts);
    if (!Number.isFinite(mid) || mid <= starts[0] || mid >= starts[starts.length - 1]) return null;
    const a = affineParams(seed);
    const base = await score(ctx, { kind: "affine", offsetSec: a.offsetSec, ratio: a.ratio });
    let best: { q: AlignmentQuality; t: SyncTransform } = {
      q: base,
      t: { kind: "affine", offsetSec: a.offsetSec, ratio: a.ratio },
    };
    for (const d of PIECE_OFFSETS) {
      if (d === 0) continue;
      const segments: PiecewiseSegment[] = [
        { fromSec: 0, toSec: mid, offsetSec: a.offsetSec, ratio: a.ratio },
        { fromSec: mid, toSec: Infinity, offsetSec: a.offsetSec + d, ratio: a.ratio },
      ];
      const t: SyncTransform = { kind: "piecewise", segments };
      const q = await score(ctx, t);
      if (q.ncc > best.q.ncc) best = { q, t };
    }
    if (best.t.kind !== "piecewise" || best.q.ncc < base.ncc + PIECE_MARGIN) return null;
    const result: PiecewiseResult = { transform: best.t, rawScore: best.q.ncc, quality: best.q };
    return result;
  };
}

function flattenAsr(out: AsrWindowRaw[] | null): AsrPhrase[] {
  if (!Array.isArray(out)) return [];
  const segs: AsrPhrase[] = [];
  for (const w of out) {
    for (const tk of w.tokens ?? []) {
      const text = String(tk.text ?? "").trim();
      if (text && Number.isFinite(tk.t0) && Number.isFinite(tk.t1)) {
        segs.push({ start: Number(tk.t0), end: Number(tk.t1), text });
      }
    }
  }
  segs.sort((x, y) => x.start - y.start);
  return segs;
}

async function ensureAsrModel(): Promise<string | null> {
  try {
    return await invoke<string | null>("asr_ensure_model");
  } catch (e) {
    dwarn("[autosync/asr] model unavailable", String(e));
    return null;
  }
}

function makeAsrTranscribePort(): NonNullable<TierPorts["asrTranscribe"]> {
  return async (ctx, windows) => {
    const modelPath = await ensureAsrModel();
    if (!modelPath) return [];
    const spans: AsrWindowSpec[] = Array.isArray(windows)
      ? windows.filter((w) => w != null && Number.isFinite(w.lenSec))
      : [];
    const probeCount = spans.length > 0 ? spans.length : 3;
    const windowSec = spans.length > 0 ? median(spans.map((w) => Math.max(5, w.lenSec))) : null;
    try {
      const out = await invoke<AsrWindowRaw[]>("asr_transcribe_windows", {
        url: ctx.mediaUrl,
        headers: ctx.headers ?? null,
        durationSec: ctx.durationSec,
        subLang: ctx.languages[0] || null,
        probeCount,
        windowSec,
        modelPath,
        mapSpec: null,
      });
      return flattenAsr(out);
    } catch {
      return [];
    }
  };
}

function consensusConfig(ctx: PipelineContext, settings: Settings): ConsensusConfig {
  const enabled = settings.subProvidersEnabled;
  const langs =
    settings.preferredSubLangs && settings.preferredSubLangs.length > 0
      ? settings.preferredSubLangs
      : ctx.languages;
  return {
    providers: {
      wyzie: enabled?.wyzie === true,
      addons: enabled?.addons !== false,
      opensubtitles: enabled?.opensubtitles !== false,
    },
    preferredLangs: langs,
    netAllowed: true,
  };
}

export function buildTierPorts(
  ctx: PipelineContext,
  settings: Settings,
  opts: BuildTierPortsOpts = {},
): TierPorts {
  const os = opts.osConfig ?? defaultOsConfig(settings);
  const extra = opts.extra ?? {};
  const flags = flagsOf(settings);
  const routeTorrent = isTorrentSource(ctx);
  const infoHash = ctx.infoHash ?? "";
  const fileIdx = opts.torrent?.fileIdx ?? 0;
  const getPositionSec = opts.torrent?.getPositionSec;
  const positionOf = (): number | null => getPositionSec?.() ?? null;

  const scoreTimeout = routeTorrent ? TORRENT_SCORE_TIMEOUT_MS : SCORE_TIMEOUT_MS;
  const scoreFallback = routeTorrent ? TORRENT_BASELINE : NEUTRAL_QUALITY;
  const measureQuality: TierPorts["measureQuality"] = (mctx, transform) =>
    bounded(
      routeTorrent
        ? torrentScore(mctx, transform, infoHash, fileIdx, positionOf())
        : directScore(mctx, transform),
      scoreTimeout,
      scoreFallback,
    );

  const vadAffine: NonNullable<TierPorts["vadAffine"]> = (mctx, win) =>
    bounded(
      routeTorrent
        ? torrentVad(mctx, win.lateWindow, infoHash, fileIdx, positionOf())
        : directVad(mctx),
      routeTorrent ? TORRENT_VAD_TIMEOUT_MS : VAD_TIMEOUT_MS,
      null,
    );

  const rawMeasure = extra.measureQuality;
  const effectiveMeasure: TierPorts["measureQuality"] = rawMeasure
    ? (mctx, transform) => bounded(rawMeasure(mctx, transform), scoreTimeout, scoreFallback)
    : measureQuality;
  const ports: TierPorts = {
    measureQuality: effectiveMeasure,
    vadAffine,
  };
  if (os) {
    const rawHash = hashExactPort(os);
    ports.hashExact = (hctx) => bounded(rawHash(hctx), HASH_TIMEOUT_MS, null);
    ports.resolveSwapCues = (_ctx, swap) => resolveSwapCues(swap, os);
  }
  if (flags.subtitleAutoSyncCrowd !== false) {
    const crowdCfg = crowdConfigFromSettings(settings);
    const crowdPort = extra.crowdDb ?? (crowdCfg ? createCrowdDbPort(crowdCfg) : undefined);
    if (crowdPort) ports.crowdDb = (cctx) => bounded(crowdPort(cctx), CROWD_TIMEOUT_MS, null);
  }
  const piecewise = extra.vadPiecewise ?? (routeTorrent ? undefined : makePiecewisePort(effectiveMeasure));
  if (piecewise) ports.vadPiecewise = piecewise;
  if (flags.subtitleAutoSyncAsr === true) {
    if (extra.asrMatch) ports.asrMatch = extra.asrMatch;
    ports.asrTranscribe = makeAsrTranscribePort();
  }
  if (extra.metadataBounds) ports.metadataBounds = extra.metadataBounds;
  ports.consensus = createConsensusPort(consensusConfig(ctx, settings));
  return ports;
}
