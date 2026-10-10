import { minecraftPackUpdateError } from "./minecraft-pack-update";

export type MinecraftExportPlan = { token: string; name: string; version: string; gameVersion: string; loader: string; files: { path: string; bytes: number; embedded: boolean }[]; embeddedBytes: number; downloadBytes: number; worlds: boolean; settings: boolean; excluded: number };
export type MinecraftRecoveryCopy = { key: string; name: string; version: string; gameVersion: string; loader: string; latest: boolean; savedAt: number | null };
export type MinecraftStorageState = { backups: MinecraftRecoveryCopy[]; unreadable: number };
export type MinecraftRemovePlan = { token: string; name: string; version: string; files: number; bytes: number; worlds: number; backup: boolean; latest: boolean; recoveryCopies: number; unreadable: number };
export type MinecraftExported = { path: string; bytes: number };
export type MinecraftRemoved = { instanceRemoved: boolean };
export type MinecraftLifecycleAction = "export" | "storage" | "remove";
export function minecraftLifecycleError(reason: unknown) {
  const key: Record<string, string> = { instance_trash: "trashError", instance_export_path: "pathError", instance_export_exists: "existsError", instance_export_limit: "limitError" };
  return key[String(reason)] ? `games.minecraft.lifecycle.${key[String(reason)]}` : minecraftPackUpdateError(reason);
}
