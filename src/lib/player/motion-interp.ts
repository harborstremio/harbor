import { invoke } from "@tauri-apps/api/core";

export async function applyMotionInterp(on: boolean): Promise<void> {
  const props: Array<[string, unknown]> = on
    ? [
        ["video-sync", "display-resample"],
        ["interpolation", "yes"],
        ["tscale", "oversample"],
      ]
    : [
        ["interpolation", "no"],
        ["video-sync", "audio"],
      ];
  await Promise.all(
    props.map(([name, value]) => invoke("mpv_set_property", { name, value }).catch(() => {})),
  );
}
