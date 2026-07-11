import { isWindowsDesktop } from "@/lib/platform";
import { invoke } from "@tauri-apps/api/core";

const RTX_VF = "d3d11vpp=format=x2bgr10:nvidia-true-hdr,format=x2bgr10";

export async function applyRtxHdr(on: boolean, svpActive: boolean): Promise<void> {
  if (svpActive) return;
  if (on && !isWindowsDesktop()) return;
  await invoke("mpv_set_property", { name: "vf", value: on ? RTX_VF : "" }).catch(() => {});
}
