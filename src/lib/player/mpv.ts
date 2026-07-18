import { invoke } from "@tauri-apps/api/core";
import { subtitleDownloadArgs } from "./subtitle-load";
import { mpvFailureSnapshot } from "./mpv-failure";
import { isMacDesktop, isWindowsDesktop } from "@/lib/platform";
import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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

export type MpvAudioDevice = { name: string; description: string };

export async function listMpvAudioDevices(): Promise<MpvAudioDevice[]> {
  try {
    return await invoke<MpvAudioDevice[]>("mpv_audio_devices");
  } catch {
    return [];
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

export type MpvRect = {
  cssLeft: number;
  cssTop: number;
  cssWidth: number;
  cssHeight: number;
  cssViewW: number;
  cssViewH: number;
};

export type MpvOptions = {
  anime4k: boolean;
  hdrToSdr: boolean;
  rtxHdr?: boolean;
  embed?: boolean;
  anime4kShaders?: string[];
  d3d11Flip?: boolean;
  macEdr?: boolean;
  extraOptions?: string;
  getEmbedRect?: () => Promise<MpvRect | null> | MpvRect | null;
};

const AUDIO_PROFILE_AF: Record<string, string> = {
  bass: "lavfi=[bass=g=7:f=110:w=0.6]",
  voice: "lavfi=[equalizer=f=300:t=q:w=1:g=-3,equalizer=f=2800:t=q:w=1:g=5]",
  "bass-reduce": "lavfi=[bass=g=-8:f=110:w=0.6]",
  night: "lavfi=[acompressor=ratio=3:threshold=-20dB:attack=20:release=300:makeup=4dB]",
};

const DEFAULT_UA = "VLC/3.0.20 LibVLC/3.0.20";

async function applyHeaderProps(headers?: Record<string, string>): Promise<void> {
  let ua = DEFAULT_UA;
  const fields: string[] = [];
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (k.toLowerCase() === "user-agent") ua = v;
    else fields.push(`${k}: ${v}`);
  }
  await invoke("mpv_set_property", { name: "user-agent", value: ua }).catch(() => {});
  await invoke("mpv_set_property", { name: "http-header-fields", value: fields.join(",") }).catch(
    () => {},
  );
}

export function createMpvBridge(mpvOptions?: MpvOptions): PlayerBridge {
  let host: HTMLElement | null = null;
  let snap: PlayerSnapshot = { ...emptySnapshot };
  let profileAf = "";
  let hdrToSdr = mpvOptions?.hdrToSdr ?? true;
  const applyAudioFilters = () => {
    const parts: string[] = [];
    if (snap.audioNormalize) parts.push("dynaudnorm=f=500:g=31:p=0.9:m=4");
    if (profileAf) parts.push(profileAf);
    if (parts.length > 0) parts.push("lavfi=[alimiter=limit=0.97]");
    invoke("mpv_command", { cmd: ["af", "set", parts.join(",")] }).catch(() => {});
  };
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
  let svpFilterFailed = false;
  const urlByExternalFilename = new Map<string, string>();

  const handleSvpFilterFailure = () => {
    if (svpFilterFailed) return;
    if (!(mpvOptions?.extraOptions ?? "").includes("vapoursynth")) return;
    svpFilterFailed = true;
    invoke("mpv_set_property", { name: "vf", value: "" }).catch(() => {});
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("harbor:svp-failed"));
    }
  };

  const emit = () => {
    const next: PlayerSnapshot = { ...snap };
    listeners.forEach((l) => l(next));
  };

  const handleEvent = (raw: MpvEvent) => {
    if (raw.event === "log") {
      const prefix = String((raw as { prefix?: unknown }).prefix ?? "");
      const level = String((raw as { level?: unknown }).level ?? "");
      const text = String((raw as { text?: unknown }).text ?? "");
      if (
        text.includes("Creating filter 'vapoursynth' failed") ||
        (prefix.includes("vapoursynth") && (level === "fatal" || level === "error"))
      ) {
        handleSvpFilterFailure();
      }
      return;
    }
    if (raw.event === "player-failure") {
      const reason = String((raw as { reason?: unknown }).reason ?? "");
      snap = mpvFailureSnapshot(snap, reason);
      mpvStarted = false;
      invoke("mpv_stop").catch(() => {});
      emit();
    } else if (raw.event === "property-change") {
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
          const codecDesc =
            (t["codec-desc"] as string | undefined) || (t.codec as string | undefined);
          const channels = t["demux-channels"] as string | undefined;
          const channelCount =
            typeof t["demux-channel-count"] === "number"
              ? (t["demux-channel-count"] as number)
              : undefined;
          const external = t.external === true;
          const externalFilename = t["external-filename"] as string | undefined;
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
            externalFilename,
            forced,
            default: isDefault,
            hearingImpaired,
            url:
              external && externalFilename
                ? (urlByExternalFilename.get(externalFilename) ?? undefined)
                : undefined,
          };
          if (type === "audio") audio.push(info);
          else if (type === "sub") subs.push(info);
        }
        snap.audioTracks = audio;
        snap.subtitleTracks = subs;
      }
      if (name === "sub-delay" && typeof data === "number") snap.subDelaySec = data;
      if (name === "audio-delay" && typeof data === "number") snap.audioDelaySec = data;
      if (name === "sub-text") snap.subText = typeof data === "string" ? data : "";
      if (name === "sub-start" && typeof data === "number") snap.subStartSec = data;
      if (name === "dwidth" && typeof data === "number") snap.videoWidth = data;
      if (name === "dheight" && typeof data === "number") snap.videoHeight = data;
      if (name === "video-params/gamma" && typeof data === "string" && data) snap.hdrGamma = data;
      if (name === "demuxer-cache-duration" && typeof data === "number") snap.bufferedSec = data;
      if (name === "paused-for-cache" && typeof data === "boolean") snap.buffering = data;
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
      svpFilterFailed = false;
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
      snap.buffering = false;
      snap.hdrGamma = "";
      pendingTracks = {};
      urlByExternalFilename.clear();
      emit();
      if (!unlistenEvent) {
        unlistenEvent = makeSafeTauriUnlisten(
          await listen<MpvEvent>("mpv://event", (ev) => handleEvent(ev.payload)),
        );
      }
      if (!unlistenLog) {
        unlistenLog = makeSafeTauriUnlisten(await listen<string>("mpv://log", () => {}));
      }
      try {
        const opts = mpvOptions ?? { anime4k: false, hdrToSdr: true };
        if (mpvStarted) {
          try {
            suppressEndFileUntil = Date.now() + 1500;
            await invoke("mpv_command", { cmd: ["stop"] });
            await applyHeaderProps(src.headers);
            const startAt =
              typeof src.startAtSec === "number" && src.startAtSec > 0 ? src.startAtSec : 0;
            const cmd: Array<string | number> = [
              "loadfile",
              src.url,
              "replace",
              0,
              `start=${startAt}`,
            ];
            await invoke("mpv_command", { cmd });
            for (const s of src.subtitles ?? []) {
              try {
                let url = s.url;
                if (/^https?:/i.test(url)) {
                  try {
                    url = await invoke<string>(
                      "sub_download",
                      subtitleDownloadArgs(s.url, { lang: s.lang }),
                    );
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
            hdrToSdr,
            rtxHdr: opts.rtxHdr === true,
            embed: opts.embed === true,
            anime4kShaders: opts.anime4kShaders ?? [],
            d3d11Flip: opts.d3d11Flip === true,
            macEdr: opts.macEdr === true,
            isLive: src.isLive === true,
            headers: src.headers ?? null,
            extraOptions: opts.extraOptions || undefined,
          },
        });
        mpvStarted = true;
        if (opts.embed) {
          await invoke("mpv_set_property", { name: "sub-visibility", value: false }).catch(
            () => {},
          );
        }
        if (opts.embed && opts.getEmbedRect && geomTimer == null) {
          let lastRect: MpvRect | null = null;
          const tick = async () => {
            try {
              const r = await opts.getEmbedRect!();
              if (!r) return;
              if (
                lastRect &&
                lastRect.cssLeft === r.cssLeft &&
                lastRect.cssTop === r.cssTop &&
                lastRect.cssWidth === r.cssWidth &&
                lastRect.cssHeight === r.cssHeight &&
                lastRect.cssViewW === r.cssViewW &&
                lastRect.cssViewH === r.cssViewH
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
            geomTauriUnlisten.push(
              makeSafeTauriUnlisten(unResized),
              makeSafeTauriUnlisten(unMoved),
            );
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
    frameStep(dir) {
      invoke("mpv_command", { cmd: [dir > 0 ? "frame-step" : "frame-back-step"] }).catch(() => {});
    },
    setVolume(v) {
      invoke("mpv_set_property", { name: "volume", value: Math.round(v * 100) }).catch(() => {});
    },
    setMuted(m) {
      invoke("mpv_set_property", { name: "mute", value: m }).catch(() => {});
    },
    setRate(r) {
      snap.rate = r;
      emit();
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
    setVideoZoom(log2) {
      invoke("mpv_set_property", { name: "video-zoom", value: log2 }).catch(() => {});
    },
    setAspectOverride(ratio) {
      invoke("mpv_set_property", { name: "video-aspect-override", value: ratio }).catch(() => {});
    },
    setStretch(on) {
      invoke("mpv_set_property", { name: "keepaspect", value: !on }).catch(() => {});
    },
    setVideoEq(name, value) {
      invoke("mpv_set_property", { name, value }).catch(() => {});
    },
    setAnime4kShaders(shaders) {
      const sep = isWindowsDesktop() ? ";" : ":";
      invoke("mpv_set_property", {
        name: "glsl-shaders",
        value: shaders.filter(Boolean).join(sep),
      }).catch(() => {});
    },
    async addSubtitle(url, lang, title, select, metadata): Promise<boolean> {
      let mpvUrl = url;
      if (/^https?:/i.test(url)) {
        try {
          mpvUrl = await invoke<string>(
            "sub_download",
            subtitleDownloadArgs(url, { ...metadata, lang }),
          );
        } catch (e) {
          console.warn("[mpv] sub_download failed, falling back to URL", e);
        }
      }
      urlByExternalFilename.set(mpvUrl, url);
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
    getSelectedTrackCues() {
      return null;
    },
    getSelectedTrackUrl() {
      const sel = snap.subtitleTracks.find((t) => t.selected);
      if (!sel || !sel.external) return null;
      return sel.url ?? sel.externalFilename ?? null;
    },
    setAudioNormalize(on) {
      snap.audioNormalize = on;
      applyAudioFilters();
      emit();
    },
    setAudioProfile(profile) {
      profileAf = AUDIO_PROFILE_AF[profile] ?? "";
      applyAudioFilters();
    },
    setHdrToSdr(on, oled) {
      hdrToSdr = on;
      const properties: Array<[string, string]> = on
        ? [
            ["tone-mapping", "spline"],
            ["gamut-mapping-mode", "perceptual"],
            ["hdr-compute-peak", "yes"],
            ["hdr-contrast-recovery", "0.30"],
            ["hdr-peak-percentile", "99.995"],
            ["dither-depth", "auto"],
            ["target-trc", "bt.1886"],
            ["target-prim", "bt.709"],
            ["target-contrast", oled ? "inf" : "auto"],
          ]
        : [
            ["tone-mapping", "auto"],
            ["gamut-mapping-mode", "auto"],
            ["hdr-compute-peak", "auto"],
            ["hdr-contrast-recovery", "0"],
            ["hdr-peak-percentile", "0"],
            ["dither-depth", "auto"],
            ["target-trc", "auto"],
            ["target-prim", "auto"],
            ["target-contrast", "auto"],
          ];
      if (isWindowsDesktop() || isMacDesktop()) {
        properties.push(["target-colorspace-hint", "yes"]);
      }
      for (const [name, value] of properties) {
        void invoke("mpv_set_property", { name, value }).catch(() => {});
      }
    },
    setAudioDevice(name) {
      invoke("mpv_set_property", {
        name: "audio-device",
        value: name && name !== "auto" ? name : "auto",
      }).catch(() => {});
    },
    setMediaInfo(info) {
      invoke("mpv_set_property", { name: "force-media-title", value: info.title }).catch(() => {});
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
      invoke("mpv_set_property", { name: "ab-loop-a", value: a == null ? "no" : a }).catch(
        () => {},
      );
      invoke("mpv_set_property", { name: "ab-loop-b", value: b == null ? "no" : b }).catch(
        () => {},
      );
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
        hdrPassthrough: false,
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
