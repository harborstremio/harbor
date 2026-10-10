import { invoke } from "@tauri-apps/api/core";

export async function downloadAnime4k(force = false): Promise<string> {
  return invoke<string>("anime4k_download", { force });
}

export async function anime4kDir(): Promise<string | null> {
  return invoke<string | null>("anime4k_dir");
}

let packCheck: Promise<boolean> | null = null;
let packRepair: Promise<void> | null = null;

/**
 * Whether the installed pack already covers every kernel the presets can name.
 *
 * Presets gain kernels over time and mpv drops a shader file it cannot open
 * without surfacing anything, so a pack installed before a kernel existed has to
 * be noticed wherever Anime4K is used, not only in the settings panel. Checked
 * once per app run and shared by every caller.
 */
export function anime4kPackComplete(): Promise<boolean> {
  packCheck ??= anime4kDir()
    .then(Boolean)
    // A failed probe must not hold playback back; the repair pass below reports
    // the real state anyway.
    .catch(() => true);
  return packCheck;
}

/** Downloads only the kernels a preset gained since the pack was installed. */
export function repairAnime4kPack(): Promise<void> {
  packRepair ??= downloadAnime4k(false)
    .then(() => undefined)
    // Best effort: an offline or partial pack still works for every kernel it
    // does have, so a failure here must not disable Anime4K outright.
    .catch(() => undefined);
  return packRepair;
}
