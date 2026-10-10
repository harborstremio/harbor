import { validateLaunchConfig, type CustomGame, type LaunchConfig } from "./custom-library";

export type CustomLaunchHealth = { configKey: string; state: "ready" | "attention" | "unknown"; issue: string; checkedAt: number };
export type CustomLaunchHealthMap = Record<string, CustomLaunchHealth>;
export const launchConfigKey = (config: LaunchConfig) => JSON.stringify([config.executable, config.workingDirectory, config.arguments, config.mode, config.runner, config.prefix, config.steamDirectory]);
export function customLaunchHealth(game: CustomGame, observations: CustomLaunchHealthMap = {}) {
  if(game.launchPending)return {configKey:launchConfigKey(game.config),state:'attention' as const,issue:game.hydra?.original.executable?'configuration':'missing',checkedAt:0};
  const value = observations[game.id];
  return value?.configKey === launchConfigKey(game.config) ? value : undefined;
}
const issues: Record<string, string> = {
  launch_missing: "missing", launch_executable: "executable", launch_permission: "permission",
  launch_platform: "platform", launch_mode: "configuration", launch_arguments: "configuration", launch_path: "configuration",
  launch_directory: "configuration", launch_runner: "configuration", launch_prefix: "configuration", launch_steam: "configuration",
};
export function launchHealthObservation(config: LaunchConfig, error?: unknown, now = Date.now()): CustomLaunchHealth {
  const code = error instanceof Error ? error.message : String(error), issue = error === undefined ? "" : issues[code] ?? "unknownNote";
  return { configKey: launchConfigKey(config), state: error === undefined ? "ready" : issue === "unknownNote" ? "unknown" : "attention", issue, checkedAt: now };
}

/** The native validator only reads launch paths. Keep at most three checks in flight per scan. */
export async function inspectCustomLaunches(games: CustomGame[], validate: (config: LaunchConfig) => Promise<unknown>, signal: AbortSignal, onResult: (id: string, result: CustomLaunchHealth) => void) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(3, games.length) }, async () => {
    while (!signal.aborted && index < games.length) {
      const game = games[index++]; let result: CustomLaunchHealth;
      if(game.launchPending){onResult(game.id,customLaunchHealth(game)!);continue;}
      try { validateLaunchConfig(await validate(game.config)); result = launchHealthObservation(game.config); }
      catch (error) { result = launchHealthObservation(game.config, error ?? Error("launch_failed")); }
      if (!signal.aborted) onResult(game.id, result);
    }
  }));
}

/** A previously implicit game folder follows a newly selected executable; custom working folders stay explicit. */
export function relocateCustomExecutable(config: LaunchConfig, executable: string): LaunchConfig {
  const normalize = (value: string) => { const path = value.replace(/\\/g, "/").replace(/\/$/, ""); return /^[a-z]:/i.test(path) ? path.toLowerCase() : path; };
  const oldPath = normalize(config.executable), parent = oldPath.slice(0, oldPath.lastIndexOf("/"));
  return { ...config, executable, workingDirectory: config.workingDirectory && normalize(config.workingDirectory) === parent ? null : config.workingDirectory };
}
