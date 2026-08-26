import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlayerBridge } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { SubCue } from "@/lib/subtitles/parser";
import { getCuesAnySource } from "@/lib/subtitles/extract";
import { toSrt, toVtt } from "@/lib/subtitles/serialize";
import { applyLinear, deltaFn, type SyncPoint, type SyncSegment } from "@/lib/subtitles/text-sync";

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
};

export type SaveResult = { ok: true } | { ok: false; reason: string };

export function useTextSync(bridge: PlayerBridge | null, metaId: string) {
  const [state, setState] = useState<State>(INITIAL);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const metaIdRef = useRef(metaId);
  metaIdRef.current = metaId;
  const stateRef = useRef(state);
  stateRef.current = state;
  const regenTimer = useRef<number | null>(null);

  const constant = state.points.length <= 1 && state.segments.length === 0;

  useEffect(() => {
    if (state.syncMode !== "active" || !state.cues) return;
    const b = bridgeRef.current;
    if (!b) return;
    if (constant) {
      b.setSubDelay(deltaFn(state.points, state.nudge)(0));
      return;
    }
    if (regenTimer.current) window.clearTimeout(regenTimer.current);
    const { cues, points, nudge, segments, sourceFormat } = state;
    regenTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          const corrected = applyLinear(cues, points, nudge, segments);
          const text = sourceFormat === "vtt" ? toVtt(corrected) : toSrt(corrected);
          const path = await writeTemp(text, sourceFormat);
          if (path) {
            await b.addSubtitle(path, undefined, "Preview", true);
            b.setSubDelay(0);
          }
        } catch {
          /* preview best-effort */
        }
      })();
    }, 220);
    return () => {
      if (regenTimer.current) window.clearTimeout(regenTimer.current);
    };
  }, [state.syncMode, state.points, state.nudge, state.segments, state.cues, constant]);

  const enter = useCallback(async (sourceUrl: string | null, headers?: Record<string, string>): Promise<string | null> => {
    const b = bridgeRef.current;
    if (!b) return "player-unavailable";
    setState({ ...INITIAL, syncMode: "loading" });
    let baseOffset = 0;
    const unsub = b.subscribe((s) => {
      baseOffset = s.subDelaySec;
    });
    unsub();
    try {
      const res = await getCuesAnySource(b, sourceUrl, headers);
      if (!res.ok) {
        setState({ ...INITIAL, error: res.reason });
        return res.reason;
      }
      setState({
        ...INITIAL,
        syncMode: "active",
        cues: res.source.cues,
        baseOffset,
        nudge: baseOffset,
        sourceFormat: res.source.format,
      });
      return null;
    } catch (e) {
      const reason = e instanceof Error ? e.message : "subtitle-read-failed";
      setState({ ...INITIAL, error: reason });
      return reason;
    }
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
    setState((prev) => ({ ...prev, rangeStart: i, rangeEnd: i }));
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
    setState((prev) => ({ ...prev, points: [], nudge: 0, segments: [], rangeStart: null, rangeEnd: null }));
  }, []);

  const seekTo = useCallback((cueIndex: number) => {
    const cue = stateRef.current.cues?.[cueIndex];
    if (cue) bridgeRef.current?.seek(cue.start);
  }, []);

  const exit = useCallback(() => {
    setState(INITIAL);
  }, []);

  const discard = useCallback(() => {
    const b = bridgeRef.current;
    b?.setSubDelay(stateRef.current.baseOffset);
    exit();
  }, [exit]);

  const save = useCallback(async (): Promise<SaveResult> => {
    const b = bridgeRef.current;
    const cur = stateRef.current;
    if (cur.syncMode !== "active" || !cur.cues) return { ok: false, reason: "not-active" };
    try {
      const corrected = applyLinear(cur.cues, cur.points, cur.nudge, cur.segments);
      const text = cur.sourceFormat === "vtt" ? toVtt(corrected) : toSrt(corrected);
      const path = await writeTemp(text, cur.sourceFormat, `synced-${Date.now()}`);
      let applied = false;
      if (path) {
        const ok = await b?.addSubtitle(path, undefined, `Synced (${cur.sourceFormat.toUpperCase()})`, true);
        applied = ok === true;
      }
      if (!applied) {
        const { downloadText } = await import("@/lib/download-text");
        const saved = await downloadText(`subtitle.synced.${cur.sourceFormat}`, text, [cur.sourceFormat], "Subtitle");
        if (!saved) return { ok: false, reason: "save-cancelled" };
      }
      b?.setSubDelay(0);
      exit();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
  }, [exit]);

  const dirty = state.points.length > 0 || state.nudge !== state.baseOffset || state.segments.length > 0;

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

async function writeTemp(text: string, ext: "srt" | "vtt", name?: string): Promise<string | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  try {
    const pathMod = await import("@tauri-apps/api/path");
    const tmpDir = await pathMod.tempDir();
    const dir = await pathMod.join(tmpDir, "harbor-subs");
    const fileName = `${name ?? "preview"}.${ext}`;
    const filePath = await pathMod.join(dir, fileName);
    await invoke("save_text_file", { path: filePath, contents: text });
    return filePath;
  } catch {
    return null;
  }
}
