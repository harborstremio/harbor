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
        // Pace frames to the display (audio is resampled slightly to match) rather than to the
        // audio clock: removes the judder fast sports motion shows with "audio" sync.
        ["video-sync", "display-resample"],
      ];
  await Promise.all(
    props.map(([name, value]) =>
      invoke("mpv_set_property", { name, value }).catch(() => {}),
    ),
  );
}
