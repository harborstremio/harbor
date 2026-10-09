export const GAME_FILE_EXTENSIONS = ["gba", "gb", "gbc", "nes", "sfc", "smc", "n64", "z64", "v64", "nds", "gen", "md", "smd", "sms", "gg", "pce", "bin", "iso", "rom"];
export type PatchPlan = {
  token: string; format: "BPS" | "IPS" | "UPS"; sourceName: string; patchName: string;
  sourceBytes: number; targetBytes: number; sourceSha256: string; patchSha256: string; targetSha256: string;
  checksumsVerified: boolean; metadata: string; outputName: string; extension: string;
};
export type PatchReceipt = { path: string; bytes: number; sha256: string };
export function fileName(path: string) { return path.split(/[\\/]/).pop() ?? path; }
export function patchErrorKey(error: unknown) {
  const code = String(error);
  if (["patch_source_mismatch", "patch_checksum_mismatch", "patch_target_mismatch"].includes(code)) return `games.patch.${code}`;
  if (["patch_expired", "patch_inputs_changed", "patch_output_exists", "patch_read_failed", "patch_write_failed", "patch_too_large", "patch_busy", "patch_game_type", "patch_output_type", "patch_unsupported"].includes(code)) return `games.patch.${code}`;
  return "games.patch.invalid";
}
