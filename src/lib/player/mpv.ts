import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { pickBestTrack } from "@/lib/subtitles/language";
import {
  emptySnapshot,
  type PlayerBridge,
  type PlayerCapabilities,
  type PlayerSnapshot,
  type PlayerSource,
  type TrackInfo,
} from "./bridge";

export type MpvProbe = {
  available: boolean;
  binary: string | null;
  version: string | null;
  error: string | null;
};

export async function probeMpv(): Promise<MpvProbe> {
  try {
    return await invoke<MpvProbe>("mpv_probe");
  } catch (e) {
    return {
      available: false,
      binary: null,
      version: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

type MpvEvent =
  | {
      event: "property-change";
      id?: number;
      name: string;
      data: unknown;
    }
  | { event: "end-file"; reason?: string }
  | { event: "playback-restart" }
  | { event: "file-loaded" }
  | { event: string; [k: string]: unknown };

export type MpvRect = { screenX: number; screenY: number; w: number; h: number };

export type MpvOptions = {
  anime4k: boolean;
  hdrToSdr: boolean;
  embed?: boolean;
  anime4kShaders?: string[];
  d3d11Flip?: boolean;
  getEmbedRect?: () => Promise<MpvRect | null> | MpvRect | null;
  preferredLangs?: string[]; 
};

export function createMpvBridge(mpvOptions?: MpvOptions): PlayerBridge {
  let host: HTMLElement | null = null;
  let snap: PlayerSnapshot = { ...emptySnapshot };
  const listeners = new Set<(s: PlayerSnapshot) => void>();
  let unlistenEvent: UnlistenFn | null = null;
  let unlistenLog: UnlistenFn | null = null;
  let pendingTracks: Record<string, unknown[]> = {};
  let geomTimer: number | null = null;
  let geomKickHandler: ((e?: Event) => void) | null = null;
  let geomForceHandler: (() => void) | null = null;
  let geomResizeObserver: ResizeObserver | null = null;
  let geomTauriUnlisten: Array<() => void> = [];
  let mpvStarted = false;
  let suppressEndFileUntil = 0;

  const emit = () => {
    const next: PlayerSnapshot = { ...snap };
    listeners.forEach((l) => l(next));
  };

  const handleEvent = (raw: MpvEvent) => {
    if (raw.event === "property-change") {
      const name = raw.name;
      const data = raw.data;
      if (name === "time-pos" && typeof data === "number") snap.positionSec = data;
      if (name === "duration" && typeof data === "number") snap.durationSec = data;
      if (name === "pause" && typeof data === "boolean") {
        snap.status = data ? "paused" : "playing";
      }
      if (name === "eof-reached" && data === true) snap.status = "ended";
      if (name === "volume" && typeof data === "number") snap.volume = data / 100;
      if (name === "mute" && typeof data === "boolean") snap.muted = data;
      if (name === "track-list" && Array.isArray(data)) {
        const list = data as Array<Record<string, unknown>>;
        pendingTracks["track-list"] = list;
        const audio: TrackInfo[] = [];
        const subs: TrackInfo[] = [];
        for (const t of list) {
          const type = String(t.type ?? "");
          const id = String(t.id ?? "");
          const lang = (t.lang ?? t.language) as string | undefined;
          const title = t.title as string | undefined;
          const codecDesc = (t["codec-desc"] as string | undefined) || (t.codec as string | undefined);
          const channels = t["demux-channels"] as string | undefined;
          const channelCount = typeof t["demux-channel-count"] === "number"
            ? (t["demux-channel-count"] as number)
            : undefined;
          const external = t.external === true;
          const forced = t.forced === true;
          const isDefault = t.default === true;
          const hearingImpaired = t["hearing-impaired"] === true;
          const selected = t.selected === true;
          const codec = codecDesc ? codecDesc.toUpperCase() : undefined;
          const baseLabel = title || lang || `${type} ${id}`;
          const tags: string[] = [];
          if (codec) tags.push(codec);
          if (type === "audio" && channels) tags.push(channels);
          if (forced) tags.push("Forced");
          if (hearingImpaired) tags.push("SDH");
          if (external) tags.push("External");
          const label = tags.length > 0 ? `${baseLabel} · ${tags.join(" · ")}` : baseLabel;
          const info: TrackInfo = {
            id,
            label,
            lang,
            kind: type === "audio" ? "audio" : "subtitle",
            selected,
            codec,
            channels,
            channelCount,
            title,
            external,
            forced,
            default: isDefault,
            hearingImpaired,
          };
          if (type === "audio") audio.push(info);
          else if (type === "sub") subs.push(info);
        }
        snap.audioTracks = audio;
        snap.subtitleTracks = subs;
        if (subs.length > 0 && mpvOptions?.preferredLangs?.length) {
        const best = pickBestTrack(subs, mpvOptions.preferredLangs);
        if (best) {
          invoke("mpv_set_property", { name: "sid", value: Number(best.id) }).catch(() => {});
        }
      }
      }
      if (name === "sub-delay" && typeof data === "number") snap.subDelaySec = data;
      if (name === "audio-delay" && typeof data === "number") snap.audioDelaySec = data;
      if (name === "sub-text") snap.subText = typeof data === "string" ? data : "";
      if (name === "sub-start" && typeof data === "number") snap.subStartSec = data;
      if (name === "dwidth" && typeof data === "number") snap.videoWidth = data;
      if (name === "dheight" && typeof data === "number") snap.videoHeight = data;
      if (name === "af") {
        const repr = typeof data === "string" ? data : JSON.stringify(data ?? "");
        snap.audioNormalize = repr.includes("dynaudnorm");
      }
      if (name === "chapter-list" && Array.isArray(data)) {
        const list = data as Array<Record<string, unknown>>;
        snap.chapters = list
          .map((c) => ({
            title: typeof c.title === "string" ? c.title : "",
            startSec: typeof c.time === "number" ? c.time : 0,
          }))
          .filter((c) => Number.isFinite(c.startSec) && c.startSec >= 0)
          .sort((a, b) => a.startSec - b.startSec);
      }
      emit();
    } else if (raw.event === "end-file") {
      const reason = (raw as { reason?: string }).reason?.toLowerCase();
      if (reason === "stop" || reason === "quit" || reason === "redirect") return;
      if (Date.now() < suppressEndFileUntil) return;
      if (reason && reason !== "eof") {
        snap.status = "error";
        snap.errorCode = "decode";
        snap.errorMessage = `mpv ended playback: ${reason}`;
      } else {
        snap.status = "ended";
      }
      emit();
    } else if (raw.event === "file-loaded") {
      snap.status = "playing";
      snap.errorCode = null;
      snap.errorMessage = null;
      emit();
    }
  };

  return {
    attach(h) {
      host = h;
      const embed = mpvOptions?.embed === true;
      const placeholder = document.createElement("div");
      placeholder.style.width = "100%";
      placeholder.style.height = "100%";
      if (embed) {
        placeholder.style.background = "transparent";
      } else {
        placeholder.style.background = "black";
        placeholder.style.display = "flex";
        placeholder.style.alignItems = "center";
        placeholder.style.justifyContent = "center";
        placeholder.style.color = "rgba(255,255,255,0.45)";
        placeholder.style.fontFamily = "Inter, system-ui, sans-serif";
        placeholder.style.fontSize = "13px";
        placeholder.textContent = "mpv plays in its own window. Controls remain here.";
      }
      h.appendChild(placeholder);
    },
    detach() {
      if (host) {
        while (host.firstChild) host.removeChild(host.firstChild);
      }
      host = null;
    },
    async load(src: PlayerSource) {
      snap.status = "loading";
      snap.errorCode = null;
      snap.errorMessage = null;
      snap.audioTracks = [];
      snap.subtitleTracks = [];
      snap.subText = "";
      snap.subStartSec = 0;
      snap.positionSec = 0;
      snap.durationSec = 0;
      snap.bufferedSec = 0;
      pendingTracks = {};
      emit();
      if (!unlistenEvent) {
        unlistenEvent = await listen<MpvEvent>("mpv://event", (ev) => handleEvent(ev.payload));
      }
      if (!unlistenLog) {
        unlistenLog = await listen<string>("mpv://log", () => {});
      }
      try {
        const opts = mpvOptions ?? { anime4k: false, hdrToSdr: true };
        if (mpvStarted) {
          try {
            suppressEndFileUntil = Date.now() + 1500;
            await invoke("mpv_command", { cmd: ["stop"] });
            const cmd: Array<string | number> = ["loadfile", src.url];
            if (typeof src.startAtSec === "number" && src.startAtSec > 0) {
              cmd.push("replace", 0, `start=${src.startAtSec}`);
            }
            await invoke("mpv_command", { cmd });
            for (const s of src.subtitles ?? []) {
              try {
                let url = s.url;
                if (/^https?:/i.test(url)) {
                  try {
                    url = await invoke<string>("sub_download", { url: s.url });
                  } catch {
                    /* fall back to remote URL */
                  }
                }
                await invoke("mpv_sub_add", {
                  url,
                  lang: s.lang ?? null,
                  title: null,
                  select: false,
                });
              } catch {
                /* noop */
              }
            }
            window.dispatchEvent(new Event("harbor:mpv-refresh-geom"));
            return;
          } catch (err) {
            console.warn("[mpv] loadfile reload failed, falling back to recreate", err);
            mpvStarted = false;
          }
        }
        await invoke("mpv_start", {
          args: {
            url: src.url,
            startAtSec: src.startAtSec ?? null,
            subtitles: (src.subtitles ?? []).map((s) => ({ url: s.url, lang: s.lang ?? null })),
            anime4k: opts.anime4k,
            hdrToSdr: opts.hdrToSdr,
            embed: opts.embed === true,
            anime4kShaders: opts.anime4kShaders ?? [],
            d3d11Flip: opts.d3d11Flip === true,
          },
        });
        mpvStarted = true;
        if (opts.embed) {
          await invoke("mpv_set_property", { name: "sub-visibility", value: false }).catch(() => {});
        }
        if (opts.embed && opts.getEmbedRect && geomTimer == null) {
          let lastRect: { screenX: number; screenY: number; w: number; h: number } | null = null;
          const tick = async () => {
            try {
              const r = await opts.getEmbedRect!();
              if (!r) return;
              if (
                lastRect &&
                lastRect.screenX === r.screenX &&
                lastRect.screenY === r.screenY &&
                lastRect.w === r.w &&
                lastRect.h === r.h
              ) {
                return;
              }
              lastRect = r;
              await invoke("mpv_set_geometry", { geom: r });
            } catch {}
          };
          tick();
          geomTimer = window.setInterval(() => {
            void tick();
          }, 250);
          geomKickHandler = () => {
            void tick();
            window.setTimeout(() => void tick(), 60);
            window.setTimeout(() => void tick(), 200);
            window.setTimeout(() => void tick(), 500);
            window.setTimeout(() => void tick(), 1000);
            window.setTimeout(() => void tick(), 1800);
          };
          geomForceHandler = () => {
            lastRect = null;
            geomKickHandler?.();
          };
          window.addEventListener("resize", geomKickHandler);
          window.addEventListener("harbor:mpv-refresh-geom", geomKickHandler);
          window.addEventListener("harbor:mpv-force-geom", geomForceHandler);
          if (host && typeof ResizeObserver !== "undefined") {
            try {
              geomResizeObserver = new ResizeObserver(() => void tick());
              geomResizeObserver.observe(host);
            } catch {
              /* noop */
            }
          }
          try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            const win = getCurrentWindow();
            const unResized = await win.onResized(() => geomKickHandler?.());
            const unMoved = await win.onMoved(() => geomKickHandler?.());
            geomTauriUnlisten.push(unResized, unMoved);
          } catch {
            /* noop */
          }
        }
      } catch (e) {
        snap.status = "error";
        snap.errorCode = "source";
        snap.errorMessage = e instanceof Error ? e.message : String(e);
        emit();
      }
    },
    async play() {
      await invoke("mpv_set_property", { name: "pause", value: false }).catch(() => {});
    },
    pause() {
      invoke("mpv_set_property", { name: "pause", value: true }).catch(() => {});
    },
    seek(sec) {
      snap.subText = "";
      snap.subStartSec = 0;
      emit();
      invoke("mpv_command", { cmd: ["seek", sec, "absolute", "exact"] }).catch(() => {});
    },
    setVolume(v) {
      invoke("mpv_set_property", { name: "volume", value: Math.round(v * 100) }).catch(() => {});
    },
    setMuted(m) {
      invoke("mpv_set_property", { name: "mute", value: m }).catch(() => {});
    },
    setRate(r) {
      invoke("mpv_set_property", { name: "speed", value: r }).catch(() => {});
    },
    setAudioTrack(id) {
      invoke("mpv_set_property", { name: "aid", value: Number(id) || id }).catch(() => {});
    },
    setSubtitleTrack(id) {
      if (id == null) {
        invoke("mpv_set_property", { name: "sid", value: "no" }).catch(() => {});
        snap.subText = "";
        snap.subStartSec = 0;
        emit();
      } else {
        invoke("mpv_set_property", { name: "sid", value: Number(id) || id }).catch(() => {});
        snap.subText = "";
        snap.subStartSec = 0;
        emit();
      }
    },
    setSubVisible(on) {
      invoke("mpv_set_property", { name: "sub-visibility", value: on }).catch(() => {});
    },
    setSubDelay(sec) {
      invoke("mpv_set_property", { name: "sub-delay", value: sec }).catch(() => {});
    },
    setAudioDelay(sec) {
      invoke("mpv_set_property", { name: "audio-delay", value: sec }).catch(() => {});
    },
    setPanscan(value) {
      const v = Math.max(0, Math.min(1, value));
      invoke("mpv_set_property", { name: "panscan", value: v }).catch(() => {});
    },
    async addSubtitle(url, lang, title, select): Promise<boolean> {
      let mpvUrl = url;
      if (/^https?:/i.test(url)) {
        try {
          mpvUrl = await invoke<string>("sub_download", { url });
        } catch (e) {
          console.warn("[mpv] sub_download failed, falling back to URL", e);
        }
      }
      try {
        await invoke("mpv_sub_add", {
          url: mpvUrl,
          lang: lang ?? null,
          title: title ?? null,
          select: select ?? true,
        });
        return true;
      } catch (e) {
        console.warn("[mpv] sub-add failed", e);
        return false;
      }
    },
    setAudioNormalize(on) {
      const value = on ? "dynaudnorm=f=200:g=15:m=10:r=0.6" : "";
      invoke("mpv_command", { cmd: ["af", "set", value] }).catch(() => {});
      snap.audioNormalize = on;
      emit();
    },
    async screenshot(path) {
      try {
        const out = await invoke<string>("mpv_save_screenshot", { path });
        return { ok: true, path: out };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    setAbLoop(a, b) {
      invoke("mpv_set_property", { name: "ab-loop-a", value: a == null ? "no" : a }).catch(() => {});
      invoke("mpv_set_property", { name: "ab-loop-b", value: b == null ? "no" : b }).catch(() => {});
    },
    async requestPiP() {},
    async exitPiP() {},
    async requestFullscreen() {
      await invoke("mpv_set_property", { name: "fullscreen", value: true }).catch(() => {});
    },
    async exitFullscreen() {
      await invoke("mpv_set_property", { name: "fullscreen", value: false }).catch(() => {});
    },
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
      if (geomTimer != null) {
        window.clearInterval(geomTimer);
        geomTimer = null;
      }
      if (geomKickHandler) {
        window.removeEventListener("resize", geomKickHandler);
        window.removeEventListener("harbor:mpv-refresh-geom", geomKickHandler);
        geomKickHandler = null;
      }
      if (geomForceHandler) {
        window.removeEventListener("harbor:mpv-force-geom", geomForceHandler);
        geomForceHandler = null;
      }
      if (geomResizeObserver) {
        try {
          geomResizeObserver.disconnect();
        } catch {
          /* noop */
        }
        geomResizeObserver = null;
      }
      for (const u of geomTauriUnlisten) {
        try {
          u();
        } catch {
          /* noop */
        }
      }
      geomTauriUnlisten = [];
      mpvStarted = false;
      invoke("mpv_stop").catch(() => {});
      if (unlistenEvent) {
        unlistenEvent();
        unlistenEvent = null;
      }
      if (unlistenLog) {
        unlistenLog();
        unlistenLog = null;
      }
      if (host) {
        while (host.firstChild) host.removeChild(host.firstChild);
      }
      host = null;
      listeners.clear();
    },
  };
}
