import { invoke } from "@tauri-apps/api/core";
import type { PlayerBridge } from "@/lib/player/bridge";
import type { SubCue } from "@/lib/subtitles/parser";
import { fetchAndParse } from "@/lib/subtitles/parser";
import { detectFormatFromUrl, resolveReadableUrl } from "@/lib/subtitles/extract";
import { toSrt, toVtt } from "@/lib/subtitles/serialize";
import type { Outcome, SyncTransform } from "./fp-gate";
import type { SourceKind } from "./pipeline";
import { classifyTorrentSource, sourceKindFor } from "./torrent-sync";

export type SubFmt = "srt" | "vtt";

type Html5CueBridge = PlayerBridge & {
  addSubtitleFromCues?: (
    cues: SubCue[],
    opts?: { lang?: string; title?: string; select?: boolean },
  ) => Promise<string | null>;
};

export type EngineReadiness = {
  ok: boolean;
  reason: string;
  vadCapable: boolean;
  hashCapable: boolean;
  crowdCapable: boolean;
  sourceKind: SourceKind;
  hlsAdRisk: boolean;
  native: boolean;
};

export type TriggerInput = {
  engine: "html5" | "mpv";
  url: string;
  isLive?: boolean;
  notWebReady?: boolean;
  infoHash?: string | null;
  durationSec: number;
  autoSyncOn: boolean;
  crowdOptOut?: boolean;
};

export type TriggerResolution = {
  run: boolean;
  reason: string;
  readiness: EngineReadiness;
  trackId: string | null;
};

export type ApplyRequest = {
  cues: SubCue[];
  transform?: SyncTransform | null;
  subSwap?: { url: string; format: SubFmt } | null;
  format: SubFmt;
  previousTrackId: string | null;
  previousDelaySec: number;
};

export type AppliedSync = {
  engine: "html5" | "mpv";
  installedVia: "in-memory" | "temp-file" | "blob" | "sub-swap";
  revert: () => void;
};

const OPAQUE_SCHEMES = /^(blob:|mediasource:|data:)/i;
const MIN_DURATION_SEC = 60;
const SYNCED_TITLE = "Synced";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function noop(): void {}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function evaluateEngineReadiness(input: TriggerInput): EngineReadiness {
  const native = isTauriRuntime();
  const cls = classifyTorrentSource(input.url, { infoHash: input.infoHash ?? null });
  const sourceKind = sourceKindFor(cls, input.url);
  const hlsAdRisk = sourceKind === "hls";
  const lower = input.url.toLowerCase();
  const opaque = OPAQUE_SCHEMES.test(lower);
  const rangeHttp = /^https?:/.test(lower);
  const vadCapable = native && !opaque;
  const hashCapable = native && rangeHttp && sourceKind !== "hls";
  const crowdCapable = input.crowdOptOut !== true;
  const base = { vadCapable, hashCapable, crowdCapable, sourceKind, hlsAdRisk, native };

  if (!input.autoSyncOn) return { ok: false, reason: "disabled", ...base };
  if (input.isLive === true || input.notWebReady === true) return { ok: false, reason: "live", ...base };
  if (!(input.durationSec >= MIN_DURATION_SEC)) return { ok: false, reason: "too-short", ...base };
  if (!vadCapable && !hashCapable && !crowdCapable) return { ok: false, reason: "no-analyzable-signal", ...base };
  return { ok: true, reason: vadCapable ? "ready" : "network-tiers-only", ...base };
}

export function resolveAutoSyncTrigger(
  input: TriggerInput & { subtitleTracks: Array<{ id: string; selected: boolean; external?: boolean }> },
): TriggerResolution {
  const readiness = evaluateEngineReadiness(input);
  const selected = input.subtitleTracks.find((t) => t.selected) ?? null;
  const trackId = selected?.id ?? null;
  if (!readiness.ok) return { run: false, reason: readiness.reason, readiness, trackId };
  if (!selected || selected.external !== true) return { run: false, reason: "no-external-track", readiness, trackId };
  return { run: true, reason: "ready", readiness, trackId };
}

export async function loadSelectedCues(bridge: PlayerBridge): Promise<SubCue[] | null> {
  const inline = bridge.getSelectedTrackCues();
  if (inline && inline.length > 0) return inline;
  const raw = bridge.getSelectedTrackUrl();
  if (!raw) return null;
  const readable = await resolveReadableUrl(raw);
  if (!readable) return null;
  try {
    return await fetchAndParse(readable);
  } catch {
    return null;
  }
}

export function selectedTrackFormat(bridge: PlayerBridge): SubFmt {
  return detectFormatFromUrl(bridge.getSelectedTrackUrl() ?? "");
}

export type VadInput = {
  url: string;
  headers?: Record<string, string>;
  cues: Array<[number, number]>;
  durationSec: number;
  infoHash?: string | null;
  readiness: Pick<EngineReadiness, "vadCapable" | "sourceKind">;
  confMin?: number;
};

export type VadAffine = { offsetSec: number; ratio: number; confidence: number };

export async function analyzeVad(input: VadInput): Promise<VadAffine | null> {
  if (!input.readiness.vadCapable) return null;
  if (input.readiness.sourceKind === "torrent" || input.readiness.sourceKind === "debrid") return null;
  if (input.cues.length < 4 || !(input.durationSec >= MIN_DURATION_SEC)) return null;
  const out = await invoke<VadAffine | null>("sync_subtitle", {
    url: input.url,
    headers: input.headers ?? null,
    cues: input.cues,
    durationSec: input.durationSec,
    infoHash: input.infoHash ?? null,
    confMin: input.confMin ?? null,
  });
  return out ?? null;
}

export function transformCues(cues: SubCue[], t: SyncTransform): SubCue[] {
  const segs =
    t.kind === "affine"
      ? [{ fromSec: 0, toSec: Infinity, offsetSec: t.offsetSec, ratio: t.ratio }]
      : [...t.segments].sort((a, b) => a.fromSec - b.fromSec);
  if (segs.length === 0) return cues.slice();
  const pick = (time: number) => {
    for (const s of segs) if (time >= s.fromSec && time < s.toSec) return s;
    return segs[segs.length - 1];
  };
  const out = cues.map((c) => {
    const s = pick(c.start);
    const start = round3(Math.max(0, s.offsetSec + s.ratio * c.start));
    const end = round3(Math.max(start + 0.001, s.offsetSec + s.ratio * c.end));
    return { start, end, text: c.text };
  });
  return out.sort((a, b) => a.start - b.start);
}

type Installed = { via: AppliedSync["installedVia"]; cleanup: () => void };

async function installSyncedTrack(
  bridge: PlayerBridge,
  cues: SubCue[],
  format: SubFmt,
  title: string,
): Promise<Installed> {
  const withCues = bridge as Html5CueBridge;
  if (typeof withCues.addSubtitleFromCues === "function") {
    await withCues.addSubtitleFromCues(cues, { title, select: true });
    return { via: "in-memory", cleanup: noop };
  }
  const text = format === "vtt" ? toVtt(cues) : toSrt(cues);
  if (isTauriRuntime()) {
    const pathMod = await import("@tauri-apps/api/path");
    const dir = await pathMod.join(await pathMod.tempDir(), "harbor-subs");
    const file = await pathMod.join(dir, `autosync-${Date.now()}.${format}`);
    await invoke("save_text_file", { path: file, contents: text });
    await bridge.addSubtitle(file, undefined, `${title} (${format.toUpperCase()})`, true);
    return { via: "temp-file", cleanup: noop };
  }
  const blob = new Blob([text], { type: format === "vtt" ? "text/vtt" : "application/x-subrip" });
  const url = URL.createObjectURL(blob);
  await bridge.addSubtitle(url, undefined, `${title} (${format.toUpperCase()})`, true);
  return {
    via: "blob",
    cleanup: () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    },
  };
}

export async function applyEngineSync(
  engine: "html5" | "mpv",
  bridge: PlayerBridge,
  req: ApplyRequest,
): Promise<AppliedSync> {
  let installedVia: AppliedSync["installedVia"];
  let cleanup: () => void = noop;

  if (req.subSwap) {
    await bridge.addSubtitle(
      req.subSwap.url,
      undefined,
      `${SYNCED_TITLE} (${req.subSwap.format.toUpperCase()})`,
      true,
    );
    installedVia = "sub-swap";
  } else {
    if (!req.transform) throw new Error("applyEngineSync: no transform and no subSwap");
    const finalCues = transformCues(req.cues, req.transform);
    if (finalCues.length === 0) throw new Error("applyEngineSync: transform produced no cues");
    const res = await installSyncedTrack(bridge, finalCues, req.format, SYNCED_TITLE);
    installedVia = res.via;
    cleanup = res.cleanup;
  }

  bridge.setSubDelay(0);

  const revert = () => {
    if (req.previousTrackId != null) bridge.setSubtitleTrack(req.previousTrackId);
    bridge.setSubDelay(req.previousDelaySec);
    cleanup();
  };

  return { engine, installedVia, revert };
}

export type HlsGuardInput = {
  decision: Outcome;
  sourceKind: SourceKind;
  independentGroups: string[];
};

export function hlsSafetyDowngrade(input: HlsGuardInput): { decision: Outcome; reason: string | null } {
  if (input.sourceKind !== "hls" || input.decision !== "apply") {
    return { decision: input.decision, reason: null };
  }
  const nonAcoustic = input.independentGroups.some((g) => g === "hash" || g === "crowd" || g === "asr");
  if (nonAcoustic) return { decision: input.decision, reason: null };
  return { decision: "offer", reason: "hls-ad-stitch-guard" };
}
