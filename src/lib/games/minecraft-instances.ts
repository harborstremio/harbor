export type MinecraftInstance = {
  schema: number; id: string; owner: string; name: string; gameVersion: string; loader: string; loaderVersion: string;
  createdAt: number; files: number; bytes: number;
  pack: { name: string; version: string; project: string | null; versionId: string | null; icon: string } | null;
};
export type MinecraftInstanceLibrary = { path: string; instances: MinecraftInstance[]; unreadable: number };
export type MinecraftPackPlan = {
  token: string; name: string; version: string; summary: string; gameVersion: string; loader: string; loaderVersion: string;
  files: { path: string; bytes: number; optional: boolean }[]; overrideCount: number; overrideBytes: number; skipped: number;
  source: MinecraftInstance["pack"];
};
export type MinecraftPackRequest = { version: string; name: string; icon: string };
export type MinecraftPackProgress = { profile: string; operationId: string; phase: "pack" | "review" | "files" | "overrides" | "done"; name: string; bytes: number; totalBytes: number; files: number; totalFiles: number };
export const minecraftInstanceFolder = (profile: string) => { try { const path = localStorage.getItem(`harbor:minecraft-folder:${profile}`); return path && path.length <= 4096 ? path : ""; } catch { return ""; } };
export function saveMinecraftInstanceFolder(profile: string, path: string) { if (!path || path.length > 4096) throw Error("instance_folder"); localStorage.setItem(`harbor:minecraft-folder:${profile}`, path); }
export function minecraftPackBytes(plan: MinecraftPackPlan, chosen: ReadonlySet<string>) { return plan.overrideBytes + plan.files.filter(f => !f.optional || chosen.has(f.path)).reduce((sum, f) => sum + f.bytes, 0); }
export function minecraftInstanceError(reason: unknown) {
  const code = String(reason);
  if (code === "instance_canceled") return "";
  if (code === "instance_loader_version") return "games.minecraft.creation.versionError";
  const keys: Record<string, string> = { instance_folder: "folderError", instance_profile: "folderError", instance_write: "writeError", instance_read: "readError", instance_record: "readError", instance_network: "networkError", instance_rate_limit: "rateLimit", instance_integrity: "integrityError", instance_changed: "changedError", instance_plan: "changedError", instance_pack_format: "formatError", instance_pack_path: "formatError", instance_pack_loader: "loaderError", instance_pack_source: "sourceError", instance_limit: "limitError", instance_busy: "busyError" };
  return `games.minecraft.instances.${keys[code] ?? "error"}`;
}
