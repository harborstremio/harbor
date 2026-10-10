import { invoke } from "@tauri-apps/api/core";
import type { WowAddonInventory } from "./wow-addon-data";

export const loadWowAddonInventory = (id: string) => invoke<WowAddonInventory>("games_wow_addons", { id });
