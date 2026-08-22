import { invoke } from "@tauri-apps/api/core";
import { isWindowsDesktop } from "@/lib/platform";
import {
  isRtxHdrBlocked,
  isRtxHdrEligibleSource,
  isRtxVsrBlocked,
  rtxVsrScaleForSource,
} from "./rtx-video-policy";

// RTX Video HDR and RTX Video Super Resolution both live in mpv's d3d11vpp
// filter, so a single labeled filter instance carries whichever combination
// of options is active.
const RTX_VF_LABEL = "@harbor-rtx";
const HINT_MODE_PROPERTY = "target-colorspace-hint-mode";
const HWDEC_PROPERTY = "hwdec";

export interface RtxVideoRequest {
  hdr: boolean;
  vsr: boolean;
  svpActive: boolean;
  hdrToSdr: boolean;
}

let appliedFilter: string | null = null;
let previousHintMode: unknown;
let hasPreviousHintMode = false;
let previousHwdec: unknown;
let hasPreviousHwdec = false;
let currentSessionKey: string | number | null = null;
let applyQueue = Promise.resolve();
let stateGeneration = 0;

function buildFilter(hdrActive: boolean, vsrScale: number | null): string | null {
  const options: string[] = [];
  if (hdrActive) options.push("nvidia-true-hdr");
  if (vsrScale != null) options.push(`scale=${vsrScale}`, "scaling-mode=nvidia");
  if (options.length === 0) return null;
  return `${RTX_VF_LABEL}:d3d11vpp=${options.join(":")}`;
}

async function applyRtxVideoNow(req: RtxVideoRequest, sessionKey: string | number): Promise<void> {
  if (!isWindowsDesktop()) return;
  if (currentSessionKey !== sessionKey) {
    currentSessionKey = sessionKey;
    appliedFilter = null;
    previousHintMode = undefined;
    hasPreviousHintMode = false;
    previousHwdec = undefined;
    hasPreviousHwdec = false;
  }
  const hdrRequested = req.hdr && !isRtxHdrBlocked(req.hdrToSdr, req.svpActive);
  const vsrRequested = req.vsr && !isRtxVsrBlocked(req.svpActive);
  let hdrActive = false;
  let vsrScale: number | null = null;
  if (hdrRequested || vsrRequested) {
    try {
      const [gamma, primaries, width, height] = await Promise.all([
        invoke<unknown>("mpv_get_property", { name: "video-dec-params/gamma" }),
        invoke<unknown>("mpv_get_property", { name: "video-dec-params/primaries" }),
        invoke<unknown>("mpv_get_property", { name: "video-dec-params/w" }),
        invoke<unknown>("mpv_get_property", { name: "video-dec-params/h" }),
      ]);
      // Both features only apply to SDR sources; the NVIDIA driver neither
      // upconverts HDR input nor super-resolves it.
      const eligibleSdr = isRtxHdrEligibleSource(gamma, primaries);
      hdrActive = hdrRequested && eligibleSdr;
      if (vsrRequested && eligibleSdr) vsrScale = rtxVsrScaleForSource(width, height);
    } catch {
      hdrActive = false;
      vsrScale = null;
    }
  }

  // d3d11vpp requires native D3D11 hardware frames. Sessions that start with
  // both RTX features off run hwdec=auto, and hwdec is the one requirement
  // mpv lets us change at runtime — switch the decoder over before installing
  // the filter and restore it once neither feature is active.
  if ((hdrActive || vsrScale != null) && !hasPreviousHwdec) {
    try {
      const snapshot = await invoke<unknown>("mpv_get_property", { name: HWDEC_PROPERTY });
      await invoke("mpv_set_property", { name: HWDEC_PROPERTY, value: "d3d11va" });
      previousHwdec = snapshot;
      hasPreviousHwdec = true;
    } catch (error) {
      console.warn("[rtx-video] could not switch to native D3D11 decoding", error);
      hdrActive = false;
      vsrScale = null;
    }
  }

  // The true-HDR filter needs mpv to hint the source colorspace to the
  // swapchain; snapshot and switch the mode before installing it.
  if (hdrActive && !hasPreviousHintMode) {
    let snapshot: unknown;
    try {
      snapshot = await invoke<unknown>("mpv_get_property", { name: HINT_MODE_PROPERTY });
    } catch (error) {
      console.warn("[rtx-video] could not snapshot the current colorspace hint mode", error);
      hdrActive = false;
    }
    if (hdrActive) {
      try {
        await invoke("mpv_set_property", { name: HINT_MODE_PROPERTY, value: "source" });
        previousHintMode = snapshot;
        hasPreviousHintMode = true;
      } catch (error) {
        console.warn("[rtx-video] could not enable source colorspace hints", error);
        hdrActive = false;
      }
    }
  }

  const desired = buildFilter(hdrActive, vsrScale);
  if (desired !== appliedFilter) {
    await invoke("mpv_command", { cmd: ["vf", "remove", RTX_VF_LABEL] }).catch(() => {});
    appliedFilter = null;
    if (desired) {
      try {
        await invoke("mpv_command", { cmd: ["vf", "add", desired] });
        appliedFilter = desired;
      } catch (error) {
        console.warn("[rtx-video] failed to install the NVIDIA RTX video filter", error);
        hdrActive = false;
      }
    }
  }

  // Restore the colorspace hint mode once the HDR path is no longer active.
  if (!hdrActive && hasPreviousHintMode) {
    await invoke("mpv_set_property", {
      name: HINT_MODE_PROPERTY,
      value: previousHintMode,
    }).catch(() => {});
    previousHintMode = undefined;
    hasPreviousHintMode = false;
  }

  // Restore the original decoder once our filter is no longer installed,
  // including after a failed install.
  if (appliedFilter == null && hasPreviousHwdec) {
    await invoke("mpv_set_property", {
      name: HWDEC_PROPERTY,
      value: previousHwdec,
    }).catch(() => {});
    previousHwdec = undefined;
    hasPreviousHwdec = false;
  }
}

export function applyRtxVideo(req: RtxVideoRequest, sessionKey: string | number): Promise<void> {
  const generation = stateGeneration;
  applyQueue = applyQueue
    .catch(() => {})
    .then(() => {
      if (generation !== stateGeneration) return;
      return applyRtxVideoNow(req, sessionKey);
    });
  return applyQueue;
}

export function resetRtxVideoState(): void {
  stateGeneration += 1;
  currentSessionKey = null;
  appliedFilter = null;
  previousHintMode = undefined;
  hasPreviousHintMode = false;
  previousHwdec = undefined;
  hasPreviousHwdec = false;
}
