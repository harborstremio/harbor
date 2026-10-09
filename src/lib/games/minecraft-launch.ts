import { minecraftAccountError } from "@/hooks/use-minecraft-account";
import { minecraftJavaError } from "./minecraft-java";

export type MinecraftLaunchState = { running: boolean; session: { id: string; pid: number; startedAt: number; endedAt: number | null; exitCode: number | null } | null; log: string | null };
export type MinecraftLaunchProgress = { profile: string; operationId: string; phase: "metadata" | "files" | "java" | "natives" | "account" | "starting"; checked: number; total: number };
export function minecraftLaunchError(reason: unknown) {
  const code = String(reason);
  const errors: Record<string, string> = { launch_files: "filesError", launch_arguments: "argumentsError", launch_natives: "filesError", launch_start: "startError", launch_state: "stateError", launch_running: "running", launch_limit: "limitError" };
  return errors[code] ? `games.minecraft.launch.${errors[code]}` : code.startsWith("minecraft_") ? minecraftAccountError(reason) : minecraftJavaError(reason);
}
