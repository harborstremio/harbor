import { invoke } from "@tauri-apps/api/core";

export async function applyMotionInterp(on: boolean): Promise<void> {
  const props: Array<[string, unknown]> = on
    ? [
        ["video-sync", "display-resample"],
        ["interpolation", "yes"],
        ["tscale", "oversample"],
        ["audio-pitch-correction", "yes"],
      ]
    : [
        ["interpolation", "no"],
        // Audio clock is mpv's most robust mode and tolerates laptop VRR,
        // compositor, dock and power-state transitions without entering an
        // unstable display-resample loop. Display sync remains available with
        // the explicit motion-interpolation option above.
        ["video-sync", "audio"],
        ["audio-pitch-correction", "yes"],
      ];
  await Promise.all(
    props.map(([name, value]) =>
      invoke("mpv_set_property", { name, value }).catch(() => {}),
    ),
  );
}
