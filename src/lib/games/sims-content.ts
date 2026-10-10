import { invoke } from "@tauri-apps/api/core";
import type { SimsPackReport, SimsPackSelection } from "./sims-packs";

export type SimsContentMatch = {
  path: string; area: "mods" | "disabled" | "game"; title: string | null;
  pack: string | null; packAvailable: boolean | null; references: number;
  sims: string[]; ambiguous: boolean;
};
export type SimsContentReport = {
  sims: { id: string; name: string }[]; matches: SimsContentMatch[];
  objects?: number | null;
  references: number; unresolved: number; checkedFiles: number; indexedResources: number;
  partial: boolean; otherData: boolean; modsEnabled: boolean | null; resourceReady: boolean;
  game: SimsPackReport | null; gameError: string | null; checkedAt: number;
};
export const simsTrayContent = (profile: string, path: string, id: string, operationId: string, installation: SimsPackSelection | null) =>
  invoke<SimsContentReport>("games_sims_tray_content", { profile, path, id, operationId, installation });
