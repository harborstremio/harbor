import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  emptySnapshot,
  type PlayerBridge,
  type PlayerCapabilities,
  type PlayerSeekPrecision,
  type PlayerSnapshot,
} from "./bridge";
import { isWindowsDesktop } from "@/lib/platform";
import {
  HDR_STAGE_ADD_SUBTITLE,
  HDR_STAGE_ADD_SUBTITLE_RESULT,
  HDR_STAGE_SET_SECONDARY_SUBTITLE_TRACK,
  HDR_STAGE_SET_SUBTITLE_TRACK,
  type HdrStageAddSubtitleRequest,
  type HdrStageAddSubtitleResult,
  type HdrStageSubtitleTrackRequest,
} from "@/lib/hdr-overlay";

const FORWARDED_SUBTITLE_TIMEOUT_MS = 120_000;

async function forwardSubtitleAdd(
  request: Omit<HdrStageAddSubtitleRequest, "requestId">,
): Promise<boolean> {
  const requestId = crypto.randomUUID();
  let unlisten: UnlistenFn | null = null;
  let timeoutId: number | null = null;
  let resolveResult: (ok: boolean) => void = () => {};
  const result = new Promise<boolean>((resolve) => {
    resolveResult = resolve;
  });

  try {
    unlisten = await listen<HdrStageAddSubtitleResult>(
      HDR_STAGE_ADD_SUBTITLE_RESULT,
      ({ payload }) => {
        if (payload.requestId === requestId) resolveResult(payload.ok === true);
      },
    );
    timeoutId = window.setTimeout(() => resolveResult(false), FORWARDED_SUBTITLE_TIMEOUT_MS);
    await emitTo("main", HDR_STAGE_ADD_SUBTITLE, { ...request, requestId });
    return await result;
  } catch (error) {
    console.warn("[hdr-overlay] could not forward subtitle addition", error);
    return false;
  } finally {
    if (timeoutId != null) window.clearTimeout(timeoutId);
    unlisten?.();
  }
}

export type ForwardingBridge = PlayerBridge & {
  pushSnapshot: (snap: PlayerSnapshot, mediaKey: string) => void;
};

export function createForwardingMpvBridge(): ForwardingBridge {
  let snap: PlayerSnapshot = { ...emptySnapshot };
  let mediaKey = "";
  const listeners = new Set<(s: PlayerSnapshot) => void>();
  const emit = () => {
    const next = { ...snap };
    listeners.forEach((l) => l(next));
  };
  const set = (name: string, value: unknown) =>
    invoke("mpv_set_property", { name, value }).catch(() => {});
  const cmd = (c: Array<string | number>) => invoke("mpv_command", { cmd: c }).catch(() => {});

  return {
    pushSnapshot(next, nextMediaKey) {
      snap = next;
      mediaKey = nextMediaKey;
      emit();
    },
    attach() {},
    detach() {},
    async load() {},
    async play() {
      await set("pause", false);
    },
    pause() {
      void set("pause", true);
    },
    seek(sec, precision: PlayerSeekPrecision = "exact") {
      const flags = precision === "keyframes" ? "absolute+keyframes" : "absolute+exact";
      void cmd(["seek", sec, flags]);
    },
    setVolume(v) {
      void set("volume", Math.round(v * 100));
    },
    setMuted(m) {
      void set("mute", m);
    },
    setRate(r) {
      void set("speed", r);
    },
    setAudioTrack(id) {
      void set("aid", Number(id) || id);
    },
    setSubtitleTrack(id) {
      const request: HdrStageSubtitleTrackRequest = { id, mediaKey };
      void emitTo("main", HDR_STAGE_SET_SUBTITLE_TRACK, request).catch((error) =>
        console.warn("[hdr-overlay] could not forward subtitle selection", error),
      );
    },
    setSecondarySubtitleTrack(id) {
      const request: HdrStageSubtitleTrackRequest = { id, mediaKey };
      void emitTo("main", HDR_STAGE_SET_SECONDARY_SUBTITLE_TRACK, request).catch((error) =>
        console.warn("[hdr-overlay] could not forward secondary subtitle selection", error),
      );
    },
    setSubVisible(on) {
      void set("sub-visibility", on);
    },
    setSubDelay(sec) {
      void set("sub-delay", sec);
    },
    setAudioDelay(sec) {
      void set("audio-delay", sec);
    },
    setPanscan(value) {
      void set("panscan", Math.max(0, Math.min(1, value)));
    },
    setVideoZoom(log2) {
      void set("video-zoom", log2);
    },
    setAspectOverride(ratio) {
      void set("video-aspect-override", ratio);
    },
    setStretch(on) {
      void set("keepaspect", !on);
    },
    setVideoEq(name, value) {
      void set(name, value);
    },
    setAnime4kShaders(shaders) {
      const sep = isWindowsDesktop() ? ";" : ":";
      void set(
        "glsl-shaders",
        shaders
          .filter(Boolean)
          .map((s) => s.replace(/\\/g, "/"))
          .join(sep),
      );
    },
    setShaderProps(props) {
      for (const [name, value] of Object.entries(props)) void set(name, value);
    },
    async addSubtitle(url, lang, title, select, metadata) {
      return forwardSubtitleAdd({ url, lang, title, select, metadata, mediaKey });
    },
    setAudioNormalize() {},
    setAudioProfile() {},
    setAudioDevice(name) {
      void set("audio-device", name && name !== "auto" ? name : "auto");
    },
    getSelectedTrackCues() {
      return null;
    },
    getSelectedTrackUrl() {
      return null;
    },
    setMediaInfo() {},
    async screenshot(path) {
      try {
        const out = await invoke<string>("mpv_save_screenshot", { path });
        return { ok: true, path: out };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    setAbLoop(a, b) {
      void set("ab-loop-a", a == null ? "no" : a);
      void set("ab-loop-b", b == null ? "no" : b);
    },
    async requestPiP() {},
    async exitPiP() {},
    async requestFullscreen() {},
    async exitFullscreen() {},
    capabilities(): PlayerCapabilities {
      return {
        engine: "mpv",
        pictureInPicture: true,
        airplay: false,
        chromecast: true,
        hdrPassthrough: true,
        hardwareDecode: true,
      };
    },
    subscribe(l) {
      listeners.add(l);
      l({ ...snap });
      return () => {
        listeners.delete(l);
      };
    },
    destroy() {
      listeners.clear();
    },
  };
}
