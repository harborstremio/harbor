import { minecraftRuntimeError } from "./minecraft-runtime";

export type MinecraftJava = { path: string; major: number; version: string; vendor: string; arch: string; managed: boolean };
export type MinecraftJavaState = { required: number | null; configured: { java: MinecraftJava; memoryMib: number } | null; compatible: boolean };
export type MinecraftJavaPlan = { token: string; instance: string; major: number; version: string; bytes: number; name: string };
export type MinecraftJavaProgress = { profile: string; operationId: string; phase: "download" | "extract" | "verify"; bytes: number; totalBytes: number };
export function minecraftJavaError(reason: unknown) {
  const errors: Record<string, string> = { java_version: "versionError", java_arch: "versionError", java_invalid: "invalidError", java_path: "invalidError", java_timeout: "invalidError", java_memory: "invalidError", java_metadata: "metadataError", java_unavailable: "metadataError", java_archive: "metadataError", java_game_files: "metadataError" };
  return errors[String(reason)] ? `games.minecraft.java.${errors[String(reason)]}` : minecraftRuntimeError(reason);
}
