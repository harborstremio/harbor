import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import type { PlayerSrc } from "@/lib/view";
import type { Settings } from "@/lib/settings";
import { dwarn } from "@/lib/debug";
import { fetchAndParse, type SubCue } from "@/lib/subtitles/parser";
import { toSrt, toVtt } from "@/lib/subtitles/serialize";
import {
  runAutoSync,
  type PipelineContext,
  type PipelineOutcome,
} from "@/lib/subtitles/autosync/pipeline";
import { buildTierPorts, defaultOsConfig } from "@/lib/subtitles/autosync/context";
import {
  crowdConfigFromSettings,
  reportCrowdFeedback,
  reportVerifiedSync,
} from "@/lib/subtitles/autosync/crowd-db";
import {
  classifyTorrentSource,
  scheduleProgressiveTorrentSync,
  sourceKindFor,
  type ProgressiveHandle,
} from "@/lib/subtitles/autosync/torrent-sync";
import { resolveSwapCues, type OsConfig } from "@/lib/subtitles/autosync/opensubtitles";
import { type SyncTransform } from "@/lib/subtitles/autosync/fp-gate";
import { transformCues } from "@/lib/subtitles/autosync/html5-sync";
import {
  DriftMonitor,
  makeTauriDriftPorts,
  type DriftDeps,
} from "@/lib/subtitles/autosync/drift-monitor";
import { resetMpvSubtitleFpsForTransition } from "@/lib/player/mpv-properties";
import {
  buildSubtitleTimingMediaKey,
  isAutoSyncScopeCurrent,
  runAfterSubtitleFpsReset,
} from "@/lib/player/subtitle-fps";
import {
  buildContext,
  isLoopback,
  outcomeScore,
  subLanguages,
  toDriftState,
} from "./use-auto-sync.helpers";

export type AutoSyncStatus =
  | "idle"
  | "analyzing"
  | "synced"
  | "best-effort"
  | "offer"
  | "declined"
  | "error";

export type AutoSyncHandle = {
  status: AutoSyncStatus;
  offer: PipelineOutcome | null;
  applyOffer: () => void;
  revert: () => void;
  retry: () => void;
  run: () => void;
  stop: () => void;
  feedback: (good: boolean) => void;
};

type SubFmt = "srt" | "vtt";
type AutoSyncScope = { mediaKey: string; trackId: string };
type AppliedState = {
  transform: SyncTransform | null;
  originalTrackId: string | null;
  subDelayBefore: number;
  scope: AutoSyncScope | null;
  changed: boolean;
};
type AutoSyncFlags = { autoSyncDrift?: boolean; subtitleAutoSyncAsr?: boolean };

const MIN_DURATION_SEC = 60;
const MIN_CUES = 4;
const OFFSET_EPS = 0.25;
const RATIO_EPS = 0.003;
const DRIFT_TICK_MS = 4000;
const SWAP_AUTO_APPLY = false;

function isSyncedTrack(t: { title?: string } | null | undefined): boolean {
  return /^Synced \((?:SRT|VTT)\)/.test(t?.title ?? "");
}

function autoSyncMediaKey(src: PlayerSrc): string {
  return buildSubtitleTimingMediaKey({
    sourceUrl: src.url,
    mediaId: src.meta.id,
    season: src.episode?.season,
    episode: src.episode?.episode,
  });
}

function autoSyncRunKey(mediaKey: string, trackId: string): string {
  return JSON.stringify([mediaKey, trackId]);
}

export function useAutoSync(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  src: PlayerSrc;
  snap: PlayerSnapshot;
  engine: "html5" | "mpv";
  settings: Settings;
}): AutoSyncHandle {
  const { bridgeRef, src, snap, engine, settings } = params;
  const [status, setStatus] = useState<AutoSyncStatus>("idle");
  const [offer, setOffer] = useState<PipelineOutcome | null>(null);

  const doneKeyRef = useRef<string | null>(null);
  const firedRef = useRef<{ mediaKey: string; langs: Set<string> }>({
    mediaKey: "",
    langs: new Set(),
  });
  const appliedRef = useRef<AppliedState>({
    transform: null,
    originalTrackId: null,
    subDelayBefore: 0,
    scope: null,
    changed: false,
  });
  const driftRef = useRef<DriftMonitor | null>(null);
  const driftTimerRef = useRef<number | null>(null);
  const progressiveRef = useRef<ProgressiveHandle | null>(null);
  const bestScoreRef = useRef(-1);
  const retryRef = useRef<(() => void) | null>(null);
  const activeDisposeRef = useRef<(() => void) | null>(null);
  const lastReportRef = useRef<{
    ctx: PipelineContext;
    transform: SyncTransform;
    confidence: number;
  } | null>(null);
  const statusScopeRef = useRef<AutoSyncScope | null>(null);
  const liveSnapRef = useRef(snap);
  const srcRef = useRef(src);
  const settingsRef = useRef(settings);
  liveSnapRef.current = snap;
  srcRef.current = src;
  settingsRef.current = settings;

  const flagsRef = useRef<AutoSyncFlags>({});
  flagsRef.current = settings as AutoSyncFlags;

  const selected = snap.subtitleTracks.find((t) => t.selected) ?? null;
  const selectedSynced = isSyncedTrack(selected);
  const mediaKey = autoSyncMediaKey(src);
  const ready =
    engine === "mpv" &&
    settings.subtitleAutoSync === true &&
    snap.durationSec >= MIN_DURATION_SEC &&
    selected?.external === true &&
    !selectedSynced;
  const runKey = selectedSynced
    ? doneKeyRef.current
    : ready && selected
      ? autoSyncRunKey(mediaKey, selected.id)
      : null;

  const stopDrift = useCallback(() => {
    if (driftTimerRef.current !== null) {
      window.clearInterval(driftTimerRef.current);
      driftTimerRef.current = null;
    }
    driftRef.current?.dispose();
    driftRef.current = null;
  }, []);

  const runWithSubtitleFpsReset = useCallback(
    (
      action: () => void | Promise<void>,
      cancelled?: { current: boolean },
      isCurrent: () => boolean = () => true,
    ) =>
      runAfterSubtitleFpsReset(
        () => resetMpvSubtitleFpsForTransition(),
        action,
        (error) => {
          dwarn("[auto-sync] subtitle FPS reset failed", error);
          if (!cancelled?.current) setStatus("error");
        },
        () => cancelled?.current !== true && isCurrent(),
      ),
    [],
  );

  const isCurrentAutoSyncScope = useCallback((scope: AutoSyncScope | null) => {
    const currentSelected =
      liveSnapRef.current.subtitleTracks.find((track) => track.selected) ?? null;
    return isAutoSyncScopeCurrent(scope, {
      mediaKey: autoSyncMediaKey(srcRef.current),
      trackId: currentSelected?.id ?? null,
      syncedTrack: isSyncedTrack(currentSelected),
    });
  }, []);

  const applyTransform = useCallback(
    async (
      b: PlayerBridge,
      cues: SubCue[],
      fmt: SubFmt,
      t: SyncTransform,
      isCurrent: () => boolean,
    ): Promise<boolean> => {
      if (!isCurrent()) return false;
      const a = appliedRef.current;
      if (t.kind === "affine" && Math.abs(t.ratio - 1) < RATIO_EPS) {
        if (Math.abs(t.offsetSec) < OFFSET_EPS && !a.transform) return true;
        if (!isCurrent()) return false;
        if (a.originalTrackId) b.setSubtitleTrack(a.originalTrackId);
        b.setSubDelay(t.offsetSec);
        a.changed = true;
        if (!isCurrent()) return false;
        a.transform = t;
        return true;
      }
      const finalCues = transformCues(cues, t);
      if (finalCues.length === 0 || !isCurrent()) return false;
      const text = fmt === "vtt" ? toVtt(finalCues) : toSrt(finalCues);
      if (!(await writeSyncedTrack(b, text, fmt, isCurrent))) return false;
      if (!isCurrent()) return false;
      a.changed = true;
      a.transform = t;
      return true;
    },
    [],
  );

  const startDrift = useCallback(
    (b: PlayerBridge, cues: SubCue[]) => {
      if (flagsRef.current.autoSyncDrift !== true || driftRef.current) return;
      const active = srcRef.current;
      const trackKey = doneKeyRef.current ?? active.url;
      const ports = makeTauriDriftPorts(active.url, active.headers, {
        enableAsr: flagsRef.current.subtitleAutoSyncAsr === true,
      });
      const deps: DriftDeps = {
        getState: () => toDriftState(liveSnapRef.current, cues, trackKey),
        setSubDelay: (s) => {
          const a = appliedRef.current;
          if (!isCurrentAutoSyncScope(a.scope)) return;
          b.setSubDelay(s);
          a.changed = true;
        },
      };
      const mon = new DriftMonitor(ports, deps);
      driftRef.current = mon;
      driftTimerRef.current = window.setInterval(() => mon.observe(), DRIFT_TICK_MS);
    },
    [isCurrentAutoSyncScope],
  );

  const handleOutcome = useCallback(
    (
      o: PipelineOutcome,
      cues: SubCue[],
      fmt: SubFmt,
      cancelled: { current: boolean },
      scope: AutoSyncScope,
    ) => {
      const isCurrent = () => isCurrentAutoSyncScope(scope);
      if (cancelled.current || !isCurrent()) return;
      const dec = o.decision.decision;
      dwarn(
        `[auto-sync] decision=${dec} reason="${o.decision.reason}" tiers=[${o.tiersRun.join(",")}] bestEffort=${o.bestEffort ?? false}`,
      );
      if (dec === "refuse") {
        if (!appliedRef.current.transform) setStatus("declined");
        return;
      }
      if (dec === "offer" || (o.subSwap && !SWAP_AUTO_APPLY)) {
        setOffer(o);
        if (!appliedRef.current.transform) setStatus("offer");
        return;
      }
      const score = outcomeScore(o);
      if (!o.bestEffort && score <= bestScoreRef.current) return;
      const t = o.candidate;
      const b = bridgeRef.current;
      if (!t || !b) return;
      void runWithSubtitleFpsReset(
        async () => {
          if (!isCurrent()) return;
          if (!o.bestEffort && score <= bestScoreRef.current) return;
          bestScoreRef.current = score;
          setOffer(null);
          const applied = await applyTransform(b, cues, fmt, t, isCurrent);
          if (!applied || !isCurrent()) return;
          setStatus(o.bestEffort ? "best-effort" : "synced");
          startDrift(b, cues);
        },
        cancelled,
        isCurrent,
      ).catch((error) => {
        dwarn("[auto-sync] apply failed", error);
        if (!cancelled.current && isCurrent()) setStatus("error");
      });
    },
    [applyTransform, startDrift, bridgeRef, isCurrentAutoSyncScope, runWithSubtitleFpsReset],
  );

  const beginRun = useCallback(
    (force: boolean): (() => void) | null => {
      const active = srcRef.current;
      const activeSnap = liveSnapRef.current;
      const activeSelected = activeSnap.subtitleTracks.find((t) => t.selected) ?? null;
      if (engine !== "mpv" || activeSnap.durationSec < MIN_DURATION_SEC) return null;
      if (!activeSelected || activeSelected.external !== true || isSyncedTrack(activeSelected))
        return null;

      const activeMediaKey = autoSyncMediaKey(active);
      const key = autoSyncRunKey(activeMediaKey, activeSelected.id);
      if (!force && doneKeyRef.current === key) return null;

      const cls = classifyTorrentSource(active.url, {
        infoHash: active.streamRef?.infoHash ?? null,
        fileIdx: active.streamRef?.fileIdx ?? null,
      });
      const isTorrent = cls === "torrent";
      if (!isTorrent && isLoopback(active.url)) return null;
      const sourceKind = sourceKindFor(cls, active.url);
      const fileIdx = active.streamRef?.fileIdx ?? 0;

      activeDisposeRef.current?.();

      doneKeyRef.current = key;
      const statusScope = { mediaKey: activeMediaKey, trackId: activeSelected.id };
      statusScopeRef.current = statusScope;
      appliedRef.current = {
        transform: null,
        originalTrackId: activeSelected.id,
        subDelayBefore: activeSnap.subDelaySec,
        scope: statusScope,
        changed: false,
      };
      bestScoreRef.current = -1;
      setOffer(null);
      setStatus("analyzing");

      const cancelled = { current: false };

      void runWithSubtitleFpsReset(
        async () => {
          const b = bridgeRef.current;
          if (!b) return;
          try {
            const cues = await loadCues(b);
            if (cancelled.current) return;
            if (!cues || cues.length < MIN_CUES) {
              setStatus(force ? "error" : "idle");
              return;
            }
            const fmt = formatOf(b);
            const langs = subLanguages(activeSelected.lang, settingsRef.current.preferredSubLangs);
            const ctx = buildContext(active, activeSnap, sourceKind, cues, langs);
            const os = defaultOsConfig(settingsRef.current);
            const applyAndCapture = (o: PipelineOutcome) => {
              handleOutcome(o, cues, fmt, cancelled, statusScope);
              if (
                !cancelled.current &&
                isCurrentAutoSyncScope(statusScope) &&
                o.candidate &&
                o.candidate.kind === "affine" &&
                o.decision.decision !== "refuse"
              ) {
                lastReportRef.current = {
                  ctx,
                  transform: o.candidate,
                  confidence: o.decision.pCorrect,
                };
              }
            };
            if (isTorrent && ctx.infoHash) {
              const basePorts = buildTierPorts(ctx, settingsRef.current, {
                osConfig: os,
                torrent: { fileIdx, getPositionSec: () => liveSnapRef.current.positionSec },
              });
              progressiveRef.current = scheduleProgressiveTorrentSync({
                ctx,
                fileIdx,
                basePorts,
                osConfig: os ?? undefined,
                getSnapshot: () => ({
                  positionSec: liveSnapRef.current.positionSec,
                  durationSec: liveSnapRef.current.durationSec || ctx.durationSec,
                }),
                onOutcome: (o) => applyAndCapture(o),
              });
              retryRef.current = () =>
                void runAutoSync(ctx, basePorts, { tryHarder: true }).then((o) =>
                  applyAndCapture(o),
                );
            } else {
              const ports = buildTierPorts(ctx, settingsRef.current, { osConfig: os });
              const runDirect = async (tryHarder: boolean) => {
                const outcome = await runAutoSync(ctx, ports, { tryHarder });
                applyAndCapture(outcome);
              };
              retryRef.current = () => void runDirect(true);
              await runDirect(force);
            }
          } catch (e) {
            dwarn("[auto-sync] failed", e);
            if (!cancelled.current) setStatus("error");
          }
        },
        cancelled,
        () => isCurrentAutoSyncScope(statusScope),
      );

      const dispose = () => {
        cancelled.current = true;
        progressiveRef.current?.stop();
        progressiveRef.current = null;
        stopDrift();
        retryRef.current = null;
        if (activeDisposeRef.current === dispose) activeDisposeRef.current = null;
      };
      activeDisposeRef.current = dispose;
      return dispose;
    },
    [engine, bridgeRef, handleOutcome, isCurrentAutoSyncScope, runWithSubtitleFpsReset, stopDrift],
  );

  const selKey = selectedSynced
    ? doneKeyRef.current
    : selected
      ? autoSyncRunKey(mediaKey, selected.id)
      : null;
  useEffect(() => {
    if (!runKey) return () => activeDisposeRef.current?.();
    const snapSel = liveSnapRef.current.subtitleTracks.find((t) => t.selected) ?? null;
    const currentMediaKey = autoSyncMediaKey(srcRef.current);
    const lang = snapSel?.lang ?? "";
    const fired = firedRef.current;
    if (fired.mediaKey !== currentMediaKey) {
      fired.mediaKey = currentMediaKey;
      fired.langs = new Set();
    }
    if (!fired.langs.has(lang)) {
      fired.langs.add(lang);
      return beginRun(false) ?? undefined;
    }
    return () => activeDisposeRef.current?.();
  }, [selKey, runKey, beginRun]);

  const revert = useCallback(() => {
    progressiveRef.current?.stop();
    progressiveRef.current = null;
    stopDrift();
    const b = bridgeRef.current;
    const a = appliedRef.current;
    const canRevert = a.changed && isCurrentAutoSyncScope(a.scope);
    if (b && canRevert) {
      if (a.originalTrackId) b.setSubtitleTrack(a.originalTrackId);
      b.setSubDelay(a.subDelayBefore);
    }
    appliedRef.current = {
      transform: null,
      originalTrackId: null,
      subDelayBefore: 0,
      scope: null,
      changed: false,
    };
    statusScopeRef.current = null;
    bestScoreRef.current = -1;
    setOffer(null);
    setStatus("idle");
  }, [bridgeRef, isCurrentAutoSyncScope, stopDrift]);

  const retry = useCallback(() => {
    const action = retryRef.current;
    if (!action) {
      beginRun(true);
      return;
    }
    const statusScope = statusScopeRef.current;
    setStatus("analyzing");
    void runWithSubtitleFpsReset(
      () => {
        if (retryRef.current === action) action();
      },
      undefined,
      () => isCurrentAutoSyncScope(statusScope),
    );
  }, [beginRun, isCurrentAutoSyncScope, runWithSubtitleFpsReset]);

  const run = useCallback(() => {
    beginRun(true);
  }, [beginRun]);

  const stop = useCallback(() => {
    activeDisposeRef.current?.();
    revert();
  }, [revert]);

  const feedback = useCallback((good: boolean) => {
    const s = settingsRef.current;
    if (s.subtitleAutoSyncCrowd === false) return;
    const r = lastReportRef.current;
    if (!r) return;
    const cfg = crowdConfigFromSettings(s);
    if (!cfg) return;
    void reportCrowdFeedback(r.ctx.cues, good, cfg);
    if (good) void reportVerifiedSync(r.ctx, r.transform, r.confidence, cfg);
  }, []);

  const applyOffer = useCallback(() => {
    const o = offer;
    if (!o) return;
    const statusScope = statusScopeRef.current;
    const isCurrent = () => isCurrentAutoSyncScope(statusScope);
    void runWithSubtitleFpsReset(
      async () => {
        const b = bridgeRef.current;
        if (!b || !isCurrent()) return;
        setOffer(null);
        if (o.subSwap) {
          const os = defaultOsConfig(settingsRef.current) ?? {
            apiKey: "",
            userAgent: "Harbor autosync",
          };
          const swap = o.subSwap;
          const applied = await applySwap(b, swap, os, isCurrent);
          if (applied) appliedRef.current.changed = true;
          if (isCurrent()) setStatus(applied ? "synced" : "error");
          return;
        }
        const t = o.candidate;
        const cues = b.getSelectedTrackCues();
        if (!t || !cues) return;
        const applied = await applyTransform(b, cues, formatOf(b), t, isCurrent);
        if (!applied || !isCurrent()) return;
        setStatus("synced");
        startDrift(b, cues);
      },
      undefined,
      isCurrent,
    ).catch((error) => {
      dwarn("[auto-sync] offer apply failed", error);
      if (isCurrent()) setStatus("error");
    });
  }, [
    offer,
    bridgeRef,
    applyTransform,
    isCurrentAutoSyncScope,
    runWithSubtitleFpsReset,
    startDrift,
  ]);

  const scopeCurrent = isAutoSyncScopeCurrent(statusScopeRef.current, {
    mediaKey,
    trackId: selected?.id ?? null,
    syncedTrack: selectedSynced,
  });
  return {
    status: status === "idle" || scopeCurrent ? status : "idle",
    offer: scopeCurrent ? offer : null,
    applyOffer,
    revert,
    retry,
    run,
    stop,
    feedback,
  };
}

async function writeSyncedTrack(
  b: PlayerBridge,
  text: string,
  fmt: SubFmt,
  isCurrent: () => boolean,
): Promise<boolean> {
  if (!isCurrent()) return false;
  const pathMod = await import("@tauri-apps/api/path");
  const dir = await pathMod.join(await pathMod.tempDir(), "harbor-subs");
  const filePath = await pathMod.join(dir, `autosync-${Date.now()}.${fmt}`);
  await invoke("save_text_file", { path: filePath, contents: text });
  if (!isCurrent()) return false;
  const added = await b.addSubtitle(filePath, undefined, `Synced (${fmt.toUpperCase()})`, true);
  if (!added || !isCurrent()) return false;
  b.setSubDelay(0);
  return true;
}

async function applySwap(
  b: PlayerBridge,
  subSwap: { url: string; format: SubFmt },
  os: OsConfig,
  isCurrent: () => boolean,
): Promise<boolean> {
  const swap = await resolveSwapCues(subSwap, os);
  if (!swap || swap.cues.length < MIN_CUES || !isCurrent()) return false;
  const cues: SubCue[] = swap.cues.map((c, i) => ({
    start: c[0],
    end: c[1],
    text: swap.cueText[i] ?? "",
  }));
  const text = subSwap.format === "vtt" ? toVtt(cues) : toSrt(cues);
  try {
    return await writeSyncedTrack(b, text, subSwap.format, isCurrent);
  } catch (e) {
    dwarn("[auto-sync] swap failed", e);
    return false;
  }
}

async function loadCues(b: PlayerBridge): Promise<SubCue[] | null> {
  const inline = b.getSelectedTrackCues();
  if (inline && inline.length > 0) return inline;
  const raw = b.getSelectedTrackUrl();
  if (!raw) return null;
  const readable = /^(https?|blob|data|tauri|asset):/i.test(raw) ? raw : safeConvert(raw);
  if (!readable) return null;
  try {
    return await fetchAndParse(readable);
  } catch {
    return null;
  }
}

function safeConvert(url: string): string | null {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      return convertFileSrc(url);
    } catch {
      return null;
    }
  }
  return null;
}

function formatOf(b: PlayerBridge): SubFmt {
  const url = b.getSelectedTrackUrl() ?? "";
  return /\.vtt(\?|#|$)/i.test(url) ? "vtt" : "srt";
}
