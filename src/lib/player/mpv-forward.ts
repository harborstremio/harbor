import { invoke } from "@tauri-apps/api/core";
import {
  emptySnapshot,
  type PlayerBridge,
  type PlayerCapabilities,
  type PlayerSnapshot,
} from "./bridge";
import { isWindowsDesktop } from "@/lib/platform";
import { subtitleDownloadArgs } from "./subtitle-load";

export type ForwardingBridge = PlayerBridge & {
  pushSnapshot: (snap: PlayerSnapshot) => void;
};

export function createForwardingMpvBridge(): ForwardingBridge {
  let snap: PlayerSnapshot = { ...emptySnapshot };
  const listeners = new Set<(s: PlayerSnapshot) => void>();
  const emit = () => {
    const next = { ...snap };
    listeners.forEach((l) => l(next));
  };
  const set = (name: string, value: unknown) =>
    invoke("mpv_set_property", { name, value }).catch(() => {});
  const cmd = (c: Array<string | number>) => invoke("mpv_command", { cmd: c }).catch(() => {});

  return {
    pushSnapshot(next) {
      snap = next;
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
    seek(sec) {
      void cmd(["seek", sec, "absolute", "exact"]);
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
      void set("sid", id == null ? "no" : Number(id) || id);
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
      void set("glsl-shaders", shaders.filter(Boolean).join(sep));
    },
    async addSubtitle(url, lang, title, select, metadata) {
      try {
        const resolvedUrl = /^https?:/i.test(url)
          ? await invoke<string>("sub_download", subtitleDownloadArgs(url, { ...metadata, lang }))
          : url;
        await invoke("mpv_sub_add", {
          url: resolvedUrl,
          lang: lang ?? null,
          title: title ?? null,
          select: select ?? true,
        });
        return true;
      } catch {
        return false;
      }
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
      l(snap);
      return () => {
        listeners.delete(l);
      };
    },
    destroy() {
      listeners.clear();
    },
  };
}
