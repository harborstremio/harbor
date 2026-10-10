import { minecraftInstanceError, type MinecraftInstance } from "./minecraft-instances";

export type MinecraftPackChange = { path: string; action: "add" | "replace" | "remove" | "preserve" | "unchanged" | "conflict"; bytes: number };
export type MinecraftPackUpdate = {
  token: string; instance: string; name: string; fromVersion: string; version: string; gameVersion: string; loader: string; loaderVersion: string;
  changes: MinecraftPackChange[]; downloadBytes: number; copyBytes: number; conflicts: number; preserved: number; extraMods: string[];
  environmentChanged: boolean; environmentBlocked: boolean; restore: boolean; optional: { path: string; bytes: number; optional: boolean }[]; selectedOptional: string[];
};
export type MinecraftPackHistory = { previous: MinecraftInstance | null };
export function minecraftPackUpdateError(reason: unknown) {
  const code = String(reason); const keys: Record<string, string> = {
    instance_update_running: "running", instance_update_recovery: "recoveryError", instance_update_source: "sourceError",
    instance_update_original: "originalError", instance_update_previous: "previousError", instance_update_space: "spaceError",
    instance_update_conflict: "conflictNote", instance_update_compatibility: "compatibilityError",
  };
  return keys[code] ? `games.minecraft.update.${keys[code]}` : minecraftInstanceError(reason);
}
