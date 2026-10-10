import { emptySnapshot, type PlayerBridge, type PlayerSnapshot, type PlayerSource } from "../bridge";

/**
 * Plays through the Android TV app's native ExoPlayer (`window.JLNativePlayer`, see
 * android-tv/README.md) instead of the WebView's <video>. The native video is drawn over the
 * WebView: full screen in the full player, or inside the hero box when the player is docked.
 */

type NativePlayer = {
  isAvailable(): boolean;
  play(url: string, headersJson: string, title: string, startMs: number): boolean;
  setMode(mode: "full" | "hero" | "hidden"): void;
  setRect(x: number, y: number, w: number, h: number): void;
  pause(): void;
  resume(): void;
  seek(ms: number): void;
  stop(): void;
};

type NativeEvent = {
  type: "ready" | "playing" | "paused" | "buffering" | "ended" | "error" | "stopped" | "position" | "exit-full";
  mode?: string;
  positionMs?: number;
  durationMs?: number;
  message?: string;
};

/** Height of the web control bar kept under the native video in the hero. */
export const NATIVE_HERO_BAR_PX = 56;

function native(): NativePlayer | null {
  if (typeof window === "undefined") return null;
  const p = (window as unknown as { JLNativePlayer?: NativePlayer }).JLNativePlayer;
  try {
    return p && p.isAvailable() ? p : null;
  } catch {
    return null;
  }
}

/** True inside the JL Media Vision TV app on one of its own pages. */
export function nativeTvAvailable(): boolean {
  return native() !== null;
}

export function createNativeTvBridge(): PlayerBridge {
  const listeners = new Set<(s: PlayerSnapshot) => void>();
  let snap: PlayerSnapshot = { ...emptySnapshot };
  let host: HTMLElement | null = null;
  let source: PlayerSource | null = null;
  let destroyed = false;
  let ro: ResizeObserver | null = null;
  let mo: MutationObserver | null = null;
  let frame = 0;

  const set = (patch: Partial<PlayerSnapshot>) => {
    snap = { ...snap, ...patch };
    for (const l of listeners) l(snap);
  };

  const docked = () => !!host?.closest("[data-hero-docked]");

  // Full player: the native view fills the screen. Docked: it takes the hero box above the
  // web control bar.
  const place = () => {
    frame = 0;
    const p = native();
    if (!p || !host || destroyed) return;
    if (docked()) {
      const r = host.getBoundingClientRect();
      p.setRect(r.left, r.top, r.width, Math.max(0, r.height - NATIVE_HERO_BAR_PX));
      p.setMode("hero");
    } else {
      // On the TV, Back from full screen moves the video into the hub hero, so the native side
      // needs a hero box to drop into; the docked player sends the real one a frame later.
      p.setRect(0, 80, window.innerWidth, Math.round(window.innerHeight * 0.4));
      p.setMode("full");
    }
  };
  const schedulePlace = () => {
    if (!frame) frame = window.requestAnimationFrame(place);
  };

  const onNative = (e: Event) => {
    const d = (e as CustomEvent<NativeEvent>).detail;
    if (!d || destroyed) return;
    const timing: Partial<PlayerSnapshot> = {};
    if (typeof d.positionMs === "number") timing.positionSec = d.positionMs / 1000;
    if (typeof d.durationMs === "number" && !source?.isLive) timing.durationSec = d.durationMs / 1000;
    switch (d.type) {
      case "ready":
        set({ ...timing, status: "ready", buffering: false, errorCode: null, errorMessage: null });
        break;
      case "playing":
        set({ ...timing, status: "playing", buffering: false });
        break;
      case "paused":
        set({ ...timing, status: "paused" });
        break;
      case "buffering":
        set({ ...timing, buffering: true });
        break;
      case "position":
        set({ ...timing, bufferedSec: timing.positionSec ?? snap.bufferedSec });
        break;
      case "ended":
        set({ ...timing, status: "ended", buffering: false });
        break;
      case "error":
        set({ status: "error", buffering: false, errorCode: "source", errorMessage: d.message ?? "Playback failed" });
        break;
      case "exit-full":
        // The remote's Back left full screen: let the player decide (back to the hero, or close).
        window.dispatchEvent(new CustomEvent("harbor:local-back", { cancelable: true }));
        break;
      case "stopped":
        if (d.message === "background") set({ status: "paused" });
        break;
    }
  };

  const detach = () => {
    window.removeEventListener("jl-native-player", onNative);
    window.removeEventListener("resize", schedulePlace);
    window.removeEventListener("harbor:mpv-refresh-geom", schedulePlace);
    ro?.disconnect();
    mo?.disconnect();
    ro = null;
    mo = null;
    host = null;
  };

  return {
    attach(el) {
      host = el;
      window.addEventListener("jl-native-player", onNative);
      window.addEventListener("resize", schedulePlace);
      window.addEventListener("harbor:mpv-refresh-geom", schedulePlace);
      ro = new ResizeObserver(schedulePlace);
      ro.observe(el);
      const stage = el.closest("[data-harbor-player]");
      if (stage) {
        mo = new MutationObserver(schedulePlace);
        mo.observe(stage, { attributes: true, attributeFilter: ["data-hero-docked", "style", "class"] });
      }
      schedulePlace();
    },
    detach,
    async load(src) {
      source = src;
      const p = native();
      if (!p) {
        set({ status: "error", errorCode: "unknown", errorMessage: "The TV player isn't available." });
        return;
      }
      set({ ...emptySnapshot, status: "loading", buffering: true });
      place();
      const startMs = Math.max(0, Math.round((src.startAtSec ?? 0) * 1000));
      const ok = p.play(src.url, JSON.stringify(src.headers ?? {}), "", startMs);
      if (!ok) set({ status: "error", buffering: false, errorCode: "source", errorMessage: "This stream can't be played." });
    },
    async play() {
      native()?.resume();
    },
    pause() {
      native()?.pause();
    },
    seek(sec) {
      native()?.seek(Math.max(0, Math.round(sec * 1000)));
      set({ positionSec: sec });
    },
    setVolume(v) {
      set({ volume: v });
    },
    setMuted(m) {
      set({ muted: m });
    },
    setRate() {},
    setAudioTrack() {},
    setSubtitleTrack() {},
    setSecondarySubtitleTrack() {},
    setSubVisible() {},
    setSubDelay() {},
    setAudioDelay() {},
    setPanscan() {},
    setVideoZoom() {},
    setAspectOverride() {},
    setStretch() {},
    setVideoEq() {},
    setAnime4kShaders() {},
    async addSubtitle() {
      return false;
    },
    getSelectedTrackCues: () => null,
    getSelectedTrackUrl: () => null,
    setAudioNormalize() {},
    async screenshot() {
      return { ok: false, error: "Not available on the TV app" };
    },
    setAbLoop() {},
    async requestPiP() {},
    async exitPiP() {},
    async requestFullscreen() {},
    async exitFullscreen() {},
    capabilities: () => ({
      engine: "html5",
      pictureInPicture: false,
      airplay: false,
      chromecast: false,
      hdrPassthrough: true,
      hardwareDecode: true,
    }),
    subscribe(listener) {
      listeners.add(listener);
      listener(snap);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame) window.cancelAnimationFrame(frame);
      native()?.stop();
      detach();
      listeners.clear();
    },
  };
}
