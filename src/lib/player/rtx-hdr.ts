import { invoke } from "@tauri-apps/api/core";
import { isWindowsDesktop } from "@/lib/platform";
import { isRtxHdrBlocked, isRtxHdrEligibleSource } from "./rtx-hdr-policy";

const RTX_VF_LABEL = "@harbor-rtx-hdr";
const RTX_VF = `${RTX_VF_LABEL}:d3d11vpp=nvidia-true-hdr`;
const HINT_MODE_PROPERTY = "target-colorspace-hint-mode";

let rtxHdrApplied = false;
let previousHintMode: unknown;
let hasPreviousHintMode = false;
let currentSessionKey: string | number | null = null;
let applyQueue = Promise.resolve();
let stateGeneration = 0;

async function applyRtxHdrNow(
  on: boolean,
  svpActive: boolean,
  hdrToSdr: boolean,
  sessionKey: string | number,
): Promise<void> {
  if (!isWindowsDesktop()) return;
  if (currentSessionKey !== sessionKey) {
    currentSessionKey = sessionKey;
    rtxHdrApplied = false;
    previousHintMode = undefined;
    hasPreviousHintMode = false;
  }
  const requested = on && !isRtxHdrBlocked(hdrToSdr, svpActive);
  let sourceIsEligibleSdr = false;
  if (requested) {
    try {
      const [gamma, primaries] = await Promise.all([
        invoke<unknown>("mpv_get_property", { name: "video-dec-params/gamma" }),
        invoke<unknown>("mpv_get_property", { name: "video-dec-params/primaries" }),
      ]);
      sourceIsEligibleSdr = isRtxHdrEligibleSource(gamma, primaries);
    } catch {
      sourceIsEligibleSdr = false;
    }
  }
  const active = requested && sourceIsEligibleSdr;

  if (active && rtxHdrApplied) return;

  if (active) {
    try {
      previousHintMode = await invoke<unknown>("mpv_get_property", {
        name: HINT_MODE_PROPERTY,
      });
      hasPreviousHintMode = true;
    } catch (error) {
      hasPreviousHintMode = false;
      console.warn("[rtx-hdr] could not snapshot the current colorspace hint mode", error);
      return;
    }
    try {
      await invoke("mpv_set_property", {
        name: HINT_MODE_PROPERTY,
        value: "source",
      });
    } catch (error) {
      previousHintMode = undefined;
      hasPreviousHintMode = false;
      console.warn("[rtx-hdr] could not enable source colorspace hints", error);
      return;
    }
    await invoke("mpv_command", { cmd: ["vf", "remove", RTX_VF_LABEL] }).catch(() => {});
    try {
      await invoke("mpv_command", { cmd: ["vf", "add", RTX_VF] });
    } catch (error) {
      if (hasPreviousHintMode) {
        await invoke("mpv_set_property", {
          name: HINT_MODE_PROPERTY,
          value: previousHintMode,
        }).catch(() => {});
      }
      previousHintMode = undefined;
      hasPreviousHintMode = false;
      console.warn("[rtx-hdr] failed to install NVIDIA RTX Video HDR filter", error);
      return;
    }
    rtxHdrApplied = true;
    return;
  }

  await invoke("mpv_command", { cmd: ["vf", "remove", RTX_VF_LABEL] }).catch(() => {});
  if (rtxHdrApplied && hasPreviousHintMode) {
    await invoke("mpv_set_property", {
      name: HINT_MODE_PROPERTY,
      value: previousHintMode,
    }).catch(() => {});
  }
  rtxHdrApplied = false;
  previousHintMode = undefined;
  hasPreviousHintMode = false;
}

export function applyRtxHdr(
  on: boolean,
  svpActive: boolean,
  hdrToSdr: boolean,
  sessionKey: string | number,
): Promise<void> {
  const generation = stateGeneration;
  applyQueue = applyQueue
    .catch(() => {})
    .then(() => {
      if (generation !== stateGeneration) return;
      return applyRtxHdrNow(on, svpActive, hdrToSdr, sessionKey);
    });
  return applyQueue;
}

export function resetRtxHdrState(): void {
  stateGeneration += 1;
  currentSessionKey = null;
  rtxHdrApplied = false;
  previousHintMode = undefined;
  hasPreviousHintMode = false;
}
