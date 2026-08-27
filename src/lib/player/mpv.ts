import { invoke } from "@tauri-apps/api/core";
import { subtitleDownloadArgs } from "./subtitle-load";
import { markLimitReached } from "@/lib/subtitles/limit-signal";
import { mpvFailureSnapshot } from "./mpv-failure";
import { isLinuxDesktop, isMacDesktop, isWindowsDesktop } from "@/lib/platform";
import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SubtitleLoadMetadata } from "@/lib/subtitles/types";
import {
  invalidateMpvSubtitleFpsContext,
  markMpvSubtitleFpsSessionRecreated,
  resetMpvSubtitleFpsForTransition,
} from "./mpv-properties";
import { SUBTITLE_FPS_TRANSITION_FAILED_EVENT } from "./subtitle-fps";
import { finishPlaybackTrace, markPlaybackTrace } from "@/lib/perf/playback-trace";
import {
  emptySnapshot,
  type PlayerBridge,
  type PlayerCapabilities,
  type PlayerSeekPrecision,
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

let mpvProbePromise: Promise<MpvProbe> | null = null;

type RetainedMpv = {
  configKey: string;
  isLive: boolean;
  startupProfile: "standard" | "high-bitrate";
};
let retainedMpv: RetainedMpv | null = null;
let retainedMpvRelease: Promise<void> | null = null;

export function probeMpv(): Promise<MpvProbe> {
  if (mpvProbePromise) return mpvProbePromise;
  mpvProbePromise = runMpvProbe();
  return mpvProbePromise;
}

async function runMpvProbe(): Promise<MpvProbe> {
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
  rtxVsr?: boolean;
  embed?: boolean;
  anime4kShaders?: string[];
  d3d11Flip?: boolean;
  macEdr?: boolean;
  extraOptions?: string;
  fullDownload?: boolean;
  getEmbedRect?: () => Promise<MpvRect | null> | MpvRect | null;
};

function mpvReuseConfigKey(options: MpvOptions | undefined, hdrToSdr: boolean): string {
  return JSON.stringify({
    anime4k: options?.anime4k === true,
    hdrToSdr,
    rtxHdr: options?.rtxHdr === true,
    rtxVsr: options?.rtxVsr === true,
    embed: options?.embed === true,
    anime4kShaders: options?.anime4kShaders ?? [],
    d3d11Flip: options?.d3d11Flip === true,
    macEdr: options?.macEdr === true,
    extraOptions: options?.extraOptions ?? "",
    fullDownload: options?.fullDownload === true,
  });
}

const AUDIO_PROFILE_AF: Record<string, string> = {
  bass: "lavfi=[bass=g=7:f=110:w=0.6]",
  voice: "lavfi=[equalizer=f=300:t=q:w=1:g=-3,equalizer=f=2800:t=q:w=1:g=5]",
  "bass-reduce": "lavfi=[bass=g=-8:f=110:w=0.6]",
  night: "lavfi=[acompressor=ratio=3:threshold=-20dB:attack=20:release=300:makeup=4dB]",
};

const DEFAULT_UA = "VLC/3.0.20 LibVLC/3.0.20";

type BufferPhase = "startup" | "steady";

function hasCustomBufferPolicy(extraOptions: string | undefined): boolean {
  return /(?:^|\n)\s*(?:cache(?:-[\w-]+)?|demuxer-(?:max|readahead)[\w-]*|stream-buffer-size)\s*=/im.test(
    extraOptions ?? "",
  );
}

function defaultVodBufferProperties(
  profile: "standard" | "high-bitrate",
  phase: BufferPhase,
): Array<[string, string]> {
  const highBitrate = profile === "high-bitrate";
  if (phase === "startup") {
    return [
      ["cache-secs", highBitrate ? "45" : "30"],
      ["cache-pause-wait", highBitrate ? "2" : "1"],
      ["demuxer-max-bytes", highBitrate ? "256MiB" : "128MiB"],
      ["demuxer-max-back-bytes", highBitrate ? "64MiB" : "32MiB"],
      ["demuxer-readahead-secs", highBitrate ? "45" : "30"],
      ["stream-buffer-size", highBitrate ? "32MiB" : "16MiB"],
    ];
  }
  return [
    ["cache-secs", "300"],
    ["cache-pause-wait", highBitrate ? "2" : "1"],
    ["demuxer-max-bytes", highBitrate ? "768MiB" : "512MiB"],
    ["demuxer-max-back-bytes", "64MiB"],
    ["demuxer-readahead-secs", "300"],
    ["stream-buffer-size", highBitrate ? "64MiB" : "32MiB"],
  ];
}

async function resetSubtitleFpsBeforeMpvTransition(): Promise<void> {
  await resetMpvSubtitleFpsForTransition();
}

let appliedAudioDevice: string | null = null;

async function applyAudioDevice(want: string): Promise<void> {
  let target = want;
  if (target !== "auto") {
    try {
      const devices = await invoke<Array<{ name: string }>>("mpv_audio_devices");
      if (devices.length > 0 && !devices.some((d) => d.name === target)) {
        console.warn(`[audio] device "${target}" is no longer present, falling back to auto`);
        target = "auto";
        appliedAudioDevice = "auto";
      }
    } catch {
      /* device list unavailable, try the stored value anyway */
    }
  }
  try {
    await invoke("mpv_set_property", { name: "audio-device", value: target });
  } catch (e) {
    if (target === "auto") return;
    console.warn(`[audio] could not select "${target}", falling back to auto`, e);
    appliedAudioDevice = "auto";
    await invoke("mpv_set_property", { name: "audio-device", value: "auto" }).catch(() => {});
  }
}

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

function normalizeMediaPath(path: string): string {
  return path.replace(/\\/g, "/");
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
  let currentIsLive: boolean | null = null;
  let currentStartupProfile: "standard" | "high-bitrate" | null = null;
  let mediaLoadId = 0;
  let steadyBufferLoadId = 0;
  let activeTraceId: string | null = null;
  let expectedMediaPath: string | null = null;
  let observedMediaPath: string | null = null;
  let mediaRevision = 0;
  let suppressEndFileUntil = 0;
  let svpFilterFailed = false;
  let secondarySid: string | null = null;
  let observedPaused: boolean | null = null;
  const applyDefaultVodBufferPhase = async (
    profile: "standard" | "high-bitrate",
    phase: BufferPhase,
  ) => {
    if (mpvOptions?.fullDownload || hasCustomBufferPolicy(mpvOptions?.extraOptions)) return;
    await Promise.all(
      defaultVodBufferProperties(profile, phase).map(async ([name, value]) => {
        try {
          await invoke("mpv_set_property", { name, value });
        } catch (error) {
          console.warn(`[mpv] could not set ${name} for the ${phase} buffer phase`, error);
        }
      }),
    );
  };
  const urlByExternalFilename = new Map<
    string,
    {
      url: string;
      release?: string;
      provider?: string;
      fps?: number;
      downloads?: number;
      author?: string;
      matchScore?: number;
      matchConfidence?: SubtitleLoadMetadata["matchConfidence"];
      matchReasons?: string[];
      subId?: string;
    }
  >();

  const addSeedSubtitles = async (subtitles: PlayerSource["subtitles"], expectedLoadId: number) => {
    for (const subtitle of subtitles ?? []) {
      if (expectedLoadId !== mediaLoadId) return;
      try {
        let url = subtitle.url;
        if (/^https?:/i.test(url)) {
          try {
            url = await invoke<string>(
              "sub_download",
              subtitleDownloadArgs(subtitle.url, { lang: subtitle.lang }),
            );
          } catch {
            /* fall back to the remote subtitle URL */
          }
        }
        if (expectedLoadId !== mediaLoadId) return;
        await invoke("mpv_sub_add", {
          url,
          lang: subtitle.lang ?? null,
          title: null,
          select: false,
        });
      } catch {
        /* one unavailable subtitle must not block media startup */
      }
    }
  };

  const ensureGeometryTracking = async (opts: MpvOptions) => {
    if (!opts.embed || !opts.getEmbedRect || geomKickHandler != null || isLinuxDesktop()) return;

    let lastRect: MpvRect | null = null;
    let geomDebounce: number | null = null;
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

    geomKickHandler = () => {
      if (geomDebounce != null) window.clearTimeout(geomDebounce);
      geomDebounce = window.setTimeout(() => void tick(), 40);
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
      geomTauriUnlisten.push(makeSafeTauriUnlisten(unResized), makeSafeTauriUnlisten(unMoved));
    } catch {
      /* noop */
    }

    // A retained Windows mpv child was hidden when the previous player view
    // unmounted. Reapplying geometry also makes that native surface visible.
    await tick();
  };

  const handleSvpFilterFailure = () => {
    if (svpFilterFailed) return;
    if (!(mpvOptions?.extraOptions ?? "").includes("vapoursynth")) return;
    svpFilterFailed = true;
    invoke("mpv_command", { cmd: ["vf", "remove", "@harbor-svp"] }).catch(() => {});
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
      mediaRevision += 1;
      mpvStarted = false;
      finishPlaybackTrace(activeTraceId, "failed");
      activeTraceId = null;
      invoke("mpv_stop").catch(() => {});
      emit();
    } else if (raw.event === "property-change") {
      const name = raw.name;
      const data = raw.data;
      if (name === "time-pos" && typeof data === "number") snap.positionSec = data;
      if (name === "path" && typeof data === "string") observedMediaPath = data;
      if (name === "duration" && typeof data === "number") snap.durationSec = data;
      if (name === "pause" && typeof data === "boolean") {
        observedPaused = data;
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
          const mainSelection =
            typeof t["main-selection"] === "number" ? (t["main-selection"] as number) : null;
          const isSecondary =
            type === "sub" &&
            t.selected === true &&
            (mainSelection === 1 || (mainSelection == null && id === secondarySid));
          const selected = t.selected === true && !isSecondary;
          const codec = codecDesc ? codecDesc.toUpperCase() : undefined;
          const baseLabel = title || lang || `${type} ${id}`;
          const tags: string[] = [];
          if (codec) tags.push(codec);
          if (type === "audio" && channels) tags.push(channels);
          if (forced) tags.push("Forced");
          if (hearingImpaired) tags.push("SDH");
          if (external) tags.push("External");
          const label = tags.length > 0 ? `${baseLabel} · ${tags.join(" · ")}` : baseLabel;
          const extMeta =
            external && externalFilename
              ? urlByExternalFilename.get(externalFilename.replace(/\\/g, "/"))
              : undefined;
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
            secondary: isSecondary,
            url: external && externalFilename ? extMeta?.url : undefined,
            release: extMeta?.release,
            provider: extMeta?.provider,
            fps: extMeta?.fps,
            downloads: extMeta?.downloads,
            author: extMeta?.author,
            matchScore: extMeta?.matchScore,
            matchConfidence: extMeta?.matchConfidence,
            matchReasons: extMeta?.matchReasons,
            subId: extMeta?.subId,
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
      if (name === "secondary-sub-text") {
        snap.secondarySubText = typeof data === "string" ? data : "";
      }
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
      markPlaybackTrace(activeTraceId, "file-loaded");
      snap.status = observedPaused === true ? "paused" : "playing";
      snap.errorCode = null;
      snap.errorMessage = null;
      emit();
    } else if (raw.event === "playback-restart") {
      if (
        expectedMediaPath &&
        observedMediaPath &&
        normalizeMediaPath(expectedMediaPath) !== normalizeMediaPath(observedMediaPath)
      ) {
        return;
      }
      snap.status = observedPaused === true ? "paused" : "playing";
      snap.firstFrameReady = true;
      if (currentIsLive === false && currentStartupProfile && steadyBufferLoadId !== mediaLoadId) {
        steadyBufferLoadId = mediaLoadId;
        const profile = currentStartupProfile;
        void applyDefaultVodBufferPhase(profile, "steady");
      }
      markPlaybackTrace(activeTraceId, "first-frame");
      finishPlaybackTrace(activeTraceId, "ready");
      activeTraceId = null;
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
      const activeLoadId = ++mediaLoadId;
      if (activeTraceId && activeTraceId !== src.traceId) {
        finishPlaybackTrace(activeTraceId, "replaced");
      }
      activeTraceId = src.traceId ?? null;
      markPlaybackTrace(activeTraceId, "bridge-load");
      if (retainedMpvRelease) await retainedMpvRelease;
      const nextIsLive = src.isLive === true;
      const nextStartupProfile =
        src.startupProfile ?? currentStartupProfile ?? retainedMpv?.startupProfile ?? "standard";
      const reuseConfigKey = mpvReuseConfigKey(mpvOptions, hdrToSdr);
      const canRetain = isWindowsDesktop() && mpvOptions?.embed === true;
      if (
        !mpvStarted &&
        canRetain &&
        retainedMpv?.configKey === reuseConfigKey &&
        retainedMpv.isLive === nextIsLive
      ) {
        mpvStarted = true;
        currentIsLive = nextIsLive;
        currentStartupProfile = nextStartupProfile;
        retainedMpv = null;
      } else if (mpvStarted && currentIsLive != null && currentIsLive !== nextIsLive) {
        mpvStarted = false;
      }
      expectedMediaPath = src.url;
      mediaRevision += 1;
      svpFilterFailed = false;
      snap.status = "loading";
      snap.errorCode = null;
      snap.errorMessage = null;
      snap.audioTracks = [];
      snap.subtitleTracks = [];
      snap.subText = "";
      snap.subStartSec = 0;
      snap.secondarySubText = "";
      secondarySid = null;
      snap.positionSec = 0;
      snap.durationSec = 0;
      snap.bufferedSec = 0;
      snap.buffering = false;
      snap.firstFrameReady = false;
      snap.hdrGamma = "";
      pendingTracks = {};
      urlByExternalFilename.clear();
      emit();
      try {
        await resetSubtitleFpsBeforeMpvTransition();
      } catch (error) {
        console.warn(
          "[mpv] could not reset subtitle FPS before loading media; recreating the mpv session",
          error,
        );
        markMpvSubtitleFpsSessionRecreated();
        mpvStarted = false;
      }
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
            secondarySid = null;
            await Promise.all([
              invoke("mpv_set_property", { name: "sid", value: "no" }),
              invoke("mpv_set_property", { name: "secondary-sid", value: "no" }),
            ]);
            if (!nextIsLive) {
              await applyDefaultVodBufferPhase(nextStartupProfile, "startup");
            }
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
            currentIsLive = nextIsLive;
            currentStartupProfile = nextStartupProfile;
            markPlaybackTrace(activeTraceId, "loadfile-accepted");
            await invoke("mpv_restore_media_surface");
            await ensureGeometryTracking(opts);
            void addSeedSubtitles(src.subtitles, activeLoadId);
            window.dispatchEvent(new Event("harbor:mpv-refresh-geom"));
            return;
          } catch (err) {
            console.warn("[mpv] loadfile reload failed, falling back to recreate", err);
            mpvStarted = false;
          }
        }
        retainedMpv = null;
        await invoke("mpv_start", {
          args: {
            url: src.url,
            startAtSec: src.startAtSec ?? null,
            subtitles: [],
            anime4k: opts.anime4k,
            hdrToSdr,
            rtxHdr: opts.rtxHdr === true,
            rtxVsr: opts.rtxVsr === true,
            embed: opts.embed === true,
            anime4kShaders: opts.anime4kShaders ?? [],
            d3d11Flip: opts.d3d11Flip === true,
            macEdr: opts.macEdr === true,
            isLive: src.isLive === true,
            fullDownload: opts.fullDownload === true,
            startupProfile: nextStartupProfile,
            headers: src.headers ?? null,
            extraOptions: opts.extraOptions || undefined,
          },
        });
        markPlaybackTrace(activeTraceId, "loadfile-accepted");
        mpvStarted = true;
        currentIsLive = nextIsLive;
        currentStartupProfile = nextStartupProfile;
        void addSeedSubtitles(src.subtitles, activeLoadId);
        if (opts.embed) {
          await invoke("mpv_set_property", { name: "sub-visibility", value: false }).catch(
            () => {},
          );
        }
        await ensureGeometryTracking(opts);
      } catch (e) {
        finishPlaybackTrace(activeTraceId, "failed");
        activeTraceId = null;
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
    seek(sec, precision: PlayerSeekPrecision = "exact") {
      snap.subText = "";
      snap.subStartSec = 0;
      snap.secondarySubText = "";
      emit();
      const flags = precision === "keyframes" ? "absolute+keyframes" : "absolute+exact";
      invoke("mpv_command", { cmd: ["seek", sec, flags] }).catch(() => {});
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
      const requestMediaRevision = mediaRevision;
      snap.subText = "";
      snap.subStartSec = 0;
      emit();
      void (async () => {
        try {
          await resetSubtitleFpsBeforeMpvTransition();
          if (requestMediaRevision !== mediaRevision) return;
          await invoke("mpv_set_property", {
            name: "sid",
            value: id == null ? "no" : Number(id) || id,
          });
        } catch (error) {
          console.warn("[mpv] could not select a subtitle after resetting subtitle FPS", error);
          window.dispatchEvent(new Event(SUBTITLE_FPS_TRANSITION_FAILED_EVENT));
        }
      })();
    },
    setSecondarySubtitleTrack(id) {
      const requestMediaRevision = mediaRevision;
      snap.secondarySubText = "";
      emit();
      void (async () => {
        try {
          await resetSubtitleFpsBeforeMpvTransition();
          if (requestMediaRevision !== mediaRevision) return;
          secondarySid = id;
          await invoke("mpv_set_property", {
            name: "secondary-sid",
            value: id == null ? "no" : Number(id) || id,
          });
        } catch (error) {
          console.warn(
            "[mpv] could not select a secondary subtitle after resetting subtitle FPS",
            error,
          );
          window.dispatchEvent(new Event(SUBTITLE_FPS_TRANSITION_FAILED_EVENT));
        }
      })();
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
      const value = shaders
        .filter(Boolean)
        .map((s) => s.replace(/\\/g, "/"))
        .join(sep);
      invoke("mpv_set_property", { name: "glsl-shaders", value }).catch((e) =>
        console.warn("[shaders] glsl-shaders apply failed", e),
      );
    },
    setShaderProps(props) {
      for (const [name, value] of Object.entries(props)) {
        invoke("mpv_set_property", { name, value }).catch((e) =>
          console.warn("[shaders] companion prop failed", name, e),
        );
      }
    },
    async addSubtitle(url, lang, title, select, metadata): Promise<boolean> {
      const requestMediaRevision = mediaRevision;
      let mpvUrl = url;
      if (/^https?:/i.test(url)) {
        try {
          mpvUrl = await invoke<string>(
            "sub_download",
            subtitleDownloadArgs(url, { ...metadata, lang }),
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.warn("[mpv] sub_download failed, falling back to URL", e);
          if (/status 429/.test(message)) {
            markLimitReached(url);
            return false;
          }
        }
      }
      if (requestMediaRevision !== mediaRevision) return false;
      mpvUrl = mpvUrl.replace(/\\/g, "/");
      try {
        if (select ?? true) {
          await resetSubtitleFpsBeforeMpvTransition();
        }
        if (requestMediaRevision !== mediaRevision) return false;
        urlByExternalFilename.set(mpvUrl, {
          url,
          release: metadata?.release,
          provider: metadata?.provider,
          fps: metadata?.fps,
          downloads: metadata?.downloads,
          author: metadata?.author,
          matchScore: metadata?.matchScore,
          matchConfidence: metadata?.matchConfidence,
          matchReasons: metadata?.matchReasons,
          subId: metadata?.subId,
        });
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
      const want = name && name !== "auto" ? name : "auto";
      if (want === appliedAudioDevice) return;
      appliedAudioDevice = want;
      void applyAudioDevice(want);
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
      mediaRevision += 1;
      finishPlaybackTrace(activeTraceId, "aborted");
      activeTraceId = null;
      const keepNativeSession =
        mpvStarted && currentIsLive != null && isWindowsDesktop() && mpvOptions?.embed === true;
      if (keepNativeSession) {
        invalidateMpvSubtitleFpsContext();
        const retained: RetainedMpv = {
          configKey: mpvReuseConfigKey(mpvOptions, hdrToSdr),
          isLive: currentIsLive!,
          startupProfile: currentStartupProfile ?? "standard",
        };
        const release = invoke<boolean>("mpv_release_media")
          .then(async (kept) => {
            if (kept) {
              retainedMpv = retained;
              return;
            }
            retainedMpv = null;
            markMpvSubtitleFpsSessionRecreated();
            await invoke("mpv_stop").catch(() => {});
          })
          .catch(async () => {
            retainedMpv = null;
            markMpvSubtitleFpsSessionRecreated();
            await invoke("mpv_stop").catch(() => {});
          });
        retainedMpvRelease = release;
        void release.finally(() => {
          if (retainedMpvRelease === release) retainedMpvRelease = null;
        });
      } else {
        retainedMpv = null;
        markMpvSubtitleFpsSessionRecreated();
        invoke("mpv_stop").catch(() => {});
      }
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
      currentIsLive = null;
      currentStartupProfile = null;
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
