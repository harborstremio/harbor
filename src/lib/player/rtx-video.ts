import { invoke } from "@tauri-apps/api/core";
import { isWindowsDesktop } from "@/lib/platform";
import {
  isRtxHdrBlocked,
  isRtxHdrEligibleSource,
  isRtxVsrBlocked,
  rtxVsrScaleForSource,
} from "./rtx-video-policy";

const RTX_VF_LABEL = "@harbor-rtx";
const HINT_MODE_PROPERTY = "target-colorspace-hint-mode";

export interface RtxVideoRequest {
  hdr: boolean;
  vsr: boolean;
  svpActive: boolean;
  hdrToSdr: boolean;
}

let appliedFilter: string | null = null;
let previousHintMode: unknown;
let hasPreviousHintMode = false;
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

async function clearRtxVideo(): Promise<void> {
  // The Windows mpv instance survives player views; resetting JS state alone
  // leaves its native filter attached to the next file.
  await invoke("mpv_command", { cmd: ["vf", "remove", RTX_VF_LABEL] }).catch(() => {});
  appliedFilter = null;
  if (hasPreviousHintMode) {
    await invoke("mpv_set_property", {
      name: HINT_MODE_PROPERTY,
      value: previousHintMode,
    }).catch(() => {});
    previousHintMode = undefined;
    hasPreviousHintMode = false;
  }
}

async function applyRtxVideoNow(
  req: RtxVideoRequest,
  sessionKey: string | number,
  generation: number,
): Promise<void> {
  if (!isWindowsDesktop()) return;
  if (currentSessionKey !== sessionKey) {
    await clearRtxVideo();
    if (generation !== stateGeneration) return;
    currentSessionKey = sessionKey;
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
      const eligibleSdr = isRtxHdrEligibleSource(gamma, primaries);
      hdrActive = hdrRequested && eligibleSdr;
      if (vsrRequested && eligibleSdr) vsrScale = rtxVsrScaleForSource(width, height);
    } catch {
      hdrActive = false;
      vsrScale = null;
    }
  }

  if (generation !== stateGeneration) return;
  if (hdrActive && !hasPreviousHintMode) {
    let snapshot: unknown;
    try {
      snapshot = await invoke<unknown>("mpv_get_property", { name: HINT_MODE_PROPERTY });
    } catch (error) {
      console.warn("[rtx-video] could not snapshot the current colorspace hint mode", error);
      hdrActive = false;
    }
    if (generation !== stateGeneration) return;
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

  if (generation !== stateGeneration) return;
  const desired = buildFilter(hdrActive, vsrScale);
  if (desired !== appliedFilter) {
    await invoke("mpv_command", { cmd: ["vf", "remove", RTX_VF_LABEL] }).catch(() => {});
    appliedFilter = null;
    if (generation !== stateGeneration) return;
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

  if (!hdrActive && hasPreviousHintMode) {
    await invoke("mpv_set_property", {
      name: HINT_MODE_PROPERTY,
      value: previousHintMode,
    }).catch(() => {});
    previousHintMode = undefined;
    hasPreviousHintMode = false;
  }
}

export function applyRtxVideo(req: RtxVideoRequest, sessionKey: string | number): Promise<void> {
  const generation = stateGeneration;
  applyQueue = applyQueue
    .catch(() => {})
    .then(() => {
      if (generation !== stateGeneration) return;
      return applyRtxVideoNow(req, sessionKey, generation);
    });
  return applyQueue;
}

export function resetRtxVideoState(): void {
  stateGeneration += 1;
  // Run after any in-flight native command and before the next session's work.
  // Preserve the hint snapshot until cleanup has actually restored it.
  applyQueue = applyQueue
    .catch(() => {})
    .then(async () => {
      if (isWindowsDesktop()) await clearRtxVideo();
      currentSessionKey = null;
    });
}
