import type { ModWorkspace } from "./mods";

export type MinecraftModBinding = { id: string; name: string; libraryPath: string; gameVersion: string; loader: "fabric" };
export type MinecraftContentState = { path: string; workspace: ModWorkspace; external: { name: string; bytes: number }[] };
