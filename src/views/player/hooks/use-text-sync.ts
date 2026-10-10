import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlayerBridge, TrackInfo } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { SubCue } from "@/lib/subtitles/parser";
import { getCuesAnySource } from "@/lib/subtitles/extract";
import { toSrt, toVtt } from "@/lib/subtitles/serialize";
import type { SubChoiceInput } from "@/lib/subtitles/subtitle-memory";
import { applyLinear, deltaFn, type SyncPoint, type SyncSegment } from "@/lib/subtitles/text-sync";
import { writePlayerPrefs } from "@/lib/player-prefs";

const round3 = (v: number) => Math.round(v * 1000) / 1000;

interface State {
  syncMode: "idle" | "loading" | "active";
  error: string | null;
  cues: SubCue[] | null;
  baseOffset: number;
  points: SyncPoint[];
  nudge: number;
  segments: SyncSegment[];
  rangeStart: number | null;
  rangeEnd: number | null;
  sourceFormat: "srt" | "vtt";
  sourceTrack: TrackInfo | null;
}

const INITIAL: State = {
  syncMode: "idle",
  error: null,
  cues: null,
  baseOffset: 0,
  points: [],
  nudge: 0,
  segments: [],
  rangeStart: null,
  rangeEnd: null,
  sourceFormat: "srt",
  sourceTrack: null,
};

export type SaveResult = { ok: true } | { ok: false; reason: string };

export function useTextSync(
  bridge: PlayerBridge | null,
  metaId: string,
  onSavedTrack?: (choice: SubChoiceInput) => void,
) {
  const [state, setState] = useState<State>(INITIAL);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const metaIdRef = useRef(metaId);
  metaIdRef.current = metaId;
  const stateRef = useRef(state);
  stateRef.current = state;
  const regenTimer = useRef<number | null>(null);
  const previewGeneration = useRef(0);
  const sessionGeneration = useRef(0);
  const previewSelected = useRef(false);
  const onSavedTrackRef = useRef(onSavedTrack);
  onSavedTrackRef.current = onSavedTrack;

  const constant = state.points.length <= 1 && state.segments.length === 0;

  useEffect(() => {
    if (state.syncMode !== "active" || !state.cues) return;
    const b = bridgeRef.current;
    if (!b) return;
    if (constant) {
      previewGeneration.current += 1;
      if (previewSelected.current && state.sourceTrack) {
        b.setSubtitleTrack(state.sourceTrack.id);
        previewSelected.current = false;
      }
      b.setSubDelay(deltaFn(state.points, state.nudge)(0));
      return;
    }
    if (regenTimer.current) window.clearTimeout(regenTimer.current);
    const { cues, points, nudge, segments, sourceFormat } = state;
    const generation = ++previewGeneration.current;
    regenTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          const corrected = applyLinear(cues, points, nudge, segments);
          const text = sourceFormat === "vtt" ? toVtt(corrected) : toSrt(corrected);
          const path = await writeSubtitleFile(
            text,
            sourceFormat,
            `preview-${crypto.randomUUID()}`,
          );
          if (path && generation === previewGeneration.current) {
            previewSelected.current = true;
            await b.addSubtitle(path, state.sourceTrack?.lang, "Preview", true, {
              provider: "Harbor Live Sync",
              providerDerived: false,
            });
            if (generation === previewGeneration.current) b.setSubDelay(0);
          }
        } catch {
          /* preview best-effort */
        }
      })();
    }, 220);
    return () => {
      previewGeneration.current += 1;
      if (regenTimer.current) window.clearTimeout(regenTimer.current);
    };
  }, [
    state.syncMode,
    state.points,
    state.nudge,
    state.segments,
    state.cues,
    state.sourceTrack,
    state.sourceFormat,
    constant,
  ]);

  const enter = useCallback(async (sourceUrl: string | null, headers?: Record<string, string>) => {
    const b = bridgeRef.current;
    if (!b) return;
    const session = ++sessionGeneration.current;
    previewGeneration.current += 1;
    previewSelected.current = false;
    let baseOffset = 0;
    let sourceTrack: TrackInfo | null = null;
    const unsub = b.subscribe((s) => {
      baseOffset = s.subDelaySec;
      sourceTrack = s.subtitleTracks.find((track) => track.selected) ?? null;
    });
    unsub();
    setState({ ...INITIAL, syncMode: "loading", baseOffset, sourceTrack });
    const res = await getCuesAnySource(b, sourceUrl, headers);
    if (session !== sessionGeneration.current || b !== bridgeRef.current) return;
    if (!res.ok) {
      setState({ ...INITIAL, syncMode: "active", baseOffset, sourceTrack, error: res.reason });
      return;
    }
    let selectedId: string | null = null;
    b.subscribe((s) => {
      selectedId = s.subtitleTracks.find((track) => track.selected)?.id ?? null;
    })();
    if (selectedId !== (sourceTrack as TrackInfo | null)?.id) {
      setState(INITIAL);
      return;
    }
    setState({
      ...INITIAL,
      syncMode: "active",
      cues: res.source.cues,
      baseOffset,
      nudge: baseOffset,
      sourceFormat: res.source.format,
      sourceTrack,
    });
  }, []);

  const syncFromHere = useCallback((cueIndex: number) => {
    setState((prev) => {
      if (prev.syncMode !== "active" || !prev.cues) return prev;
      const cue = prev.cues[cueIndex];
      if (!cue) return prev;
      const at = getPlaybackPosition();
      if (prev.rangeStart != null && prev.rangeEnd != null) {
        const lo = Math.min(prev.rangeStart, prev.rangeEnd);
        const hi = Math.max(prev.rangeStart, prev.rangeEnd);
        const cur = deltaFn(prev.points, prev.nudge)(cue.start);
        const segments = prev.segments
          .filter((s) => !(s.startIdx === lo && s.endIdx === hi))
          .concat({ startIdx: lo, endIdx: hi, offsetSec: round3(at - cue.start - cur) });
        return { ...prev, segments, rangeStart: null, rangeEnd: null };
      }
      const point: SyncPoint = { t: cue.start, at };
      const points = prev.points.length < 2 ? [...prev.points, point] : [prev.points[0], point];
      return { ...prev, points, nudge: 0 };
    });
  }, []);

  const setRangeStart = useCallback((i: number) => {
    setState((prev) => ({ ...prev, rangeStart: i, rangeEnd: null }));
  }, []);
  const setRangeEnd = useCallback((i: number) => {
    setState((prev) => (prev.rangeStart == null ? prev : { ...prev, rangeEnd: i }));
  }, []);
  const clearRange = useCallback(() => {
    setState((prev) => ({ ...prev, rangeStart: null, rangeEnd: null }));
  }, []);
  const clearSegments = useCallback(() => {
    setState((prev) => ({ ...prev, segments: [], rangeStart: null, rangeEnd: null }));
  }, []);

  const nudgeBy = useCallback((delta: number) => {
    setState((prev) => ({ ...prev, nudge: round3(prev.nudge + delta) }));
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      points: [],
      nudge: 0,
      segments: [],
      rangeStart: null,
      rangeEnd: null,
    }));
  }, []);

  const seekTo = useCallback((cueIndex: number) => {
    const cue = stateRef.current.cues?.[cueIndex];
    if (cue) bridgeRef.current?.seek(cue.start);
  }, []);

  const exit = useCallback(() => {
    sessionGeneration.current += 1;
    previewGeneration.current += 1;
    if (regenTimer.current) window.clearTimeout(regenTimer.current);
    regenTimer.current = null;
    setState(INITIAL);
  }, []);

  const discard = useCallback(() => {
    const b = bridgeRef.current;
    if (stateRef.current.sourceTrack) {
      b?.setSubtitleTrack(stateRef.current.sourceTrack.id);
      previewSelected.current = false;
    }
    b?.setSubDelay(stateRef.current.baseOffset);
    exit();
  }, [exit]);

  const save = useCallback(async (): Promise<SaveResult> => {
    const b = bridgeRef.current;
    const cur = stateRef.current;
    const session = sessionGeneration.current;
    if (!b || cur.syncMode !== "active" || !cur.cues) {
      return { ok: false, reason: "not-active" };
    }
    try {
      previewGeneration.current += 1;
      if (regenTimer.current) window.clearTimeout(regenTimer.current);
      regenTimer.current = null;
      const corrected = applyLinear(cur.cues, cur.points, cur.nudge, cur.segments);
      const text = cur.sourceFormat === "vtt" ? toVtt(corrected) : toSrt(corrected);
      const fileName = `${syncedFileName(metaIdRef.current, cur.sourceTrack)}-${crypto.randomUUID()}`;
      const path = await writeSubtitleFile(text, cur.sourceFormat, fileName, true);
      if (session !== sessionGeneration.current || b !== bridgeRef.current) {
        return { ok: false, reason: "cancelled" };
      }
      if (!path) return { ok: false, reason: "saved-write-failed" };

      const source = cur.sourceTrack;
      const release = source?.release?.trim() || undefined;
      const sourceName = release || source?.title?.trim() || undefined;
      const title = sourceName
        ? `Synced (${cur.sourceFormat.toUpperCase()}) · ${sourceName}`
        : `Synced (${cur.sourceFormat.toUpperCase()})`;
      const previewDelay =
        cur.points.length <= 1 && cur.segments.length === 0 ? deltaFn(cur.points, cur.nudge)(0) : 0;

      // The timing is baked into the saved file, so clear the temporary mpv
      // delay before selecting it. Restore the preview if loading fails.
      b.setSubDelay(0);
      const syncedSubId = source?.subId
        ? `synced:${source.subId}`
        : `synced:${fileName}.${cur.sourceFormat}`;
      const applied = await b.addSubtitle(path, source?.lang, title, true, {
        format: cur.sourceFormat,
        release,
        provider: "Harbor Live Sync",
        providerDerived: false,
        fps: source?.fps,
        downloads: source?.downloads,
        author: source?.author,
        matchScore: 10_000,
        matchConfidence: "exact",
        matchReasons: ["timing synchronized to this video"],
        subId: syncedSubId,
      });
      if (session !== sessionGeneration.current || b !== bridgeRef.current) {
        return { ok: false, reason: "cancelled" };
      }
      if (!applied) {
        b.setSubDelay(previewDelay);
        return { ok: false, reason: "subtitle-load-failed" };
      }
      onSavedTrackRef.current?.({
        source: path,
        url: path,
        external: true,
        imported: true,
        lang: source?.lang,
        title,
        subId: syncedSubId,
        provider: "Harbor Live Sync",
        providerDerived: false,
        release,
        format: cur.sourceFormat,
        matchScore: 10_000,
        matchConfidence: "exact",
      });
      writePlayerPrefs(metaIdRef.current, { subDelaySec: 0 });
      exit();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
  }, [exit]);

  useEffect(
    () => () => {
      sessionGeneration.current += 1;
      previewGeneration.current += 1;
      if (regenTimer.current) window.clearTimeout(regenTimer.current);
    },
    [bridge, metaId],
  );

  const dirty =
    state.points.length > 0 || state.nudge !== state.baseOffset || state.segments.length > 0;

  return {
    ...state,
    dirty,
    pointCount: state.points.length,
    enter,
    syncFromHere,
    setRangeStart,
    setRangeEnd,
    clearRange,
    clearSegments,
    nudgeBy,
    reset,
    seekTo,
    save,
    discard,
    exit,
  };
}

function syncedFileName(metaId: string, track: TrackInfo | null): string {
  const value = `${metaId}|${track?.subId ?? ""}|${track?.url ?? track?.externalFilename ?? ""}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `synced-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

async function writeSubtitleFile(
  text: string,
  ext: "srt" | "vtt",
  name?: string,
  persistent = false,
): Promise<string | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  try {
    const pathMod = await import("@tauri-apps/api/path");
    const root = persistent ? await pathMod.appDataDir() : await pathMod.tempDir();
    const dir = await pathMod.join(root, "harbor-subs", persistent ? "saved" : "preview");
    const fileName = `${name ?? "preview"}.${ext}`;
    const filePath = await pathMod.join(dir, fileName);
    await invoke("save_text_file", { path: filePath, contents: text });
    return filePath;
  } catch {
    return null;
  }
}
