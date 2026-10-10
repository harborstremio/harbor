import { invoke } from "@tauri-apps/api/core";
export type PokemonLocalRom = { path: string; root: string; system: number };
export type PokemonDetectedSave = { path: string; name: string; romName: string; origin: "harbor" | "adjacent"; modified: number };
export type PokemonEntity = { box: number; slot: number; isEmpty: boolean; species: number; speciesName: string; nickname: string; level: number; nature: number; ability: number; heldItem: number; move1: number; move2: number; move3: number; move4: number; iVs: number[]; eVs: number[]; isShiny: boolean; originalTrainer: string; friendship: number; gender: number; form: number };
export type PokemonSlot = { image?: string | null; box: number; slot: number; species: number | null; nickname: string | null; isShiny: boolean; isEgg: boolean; form: number };
export type PokemonBankEntry = { image?: string | null; id: string; added: number; box: number; info: { species: number; speciesName?: string; nickname: string; level: number; shiny: boolean; format: string; generation: number; form: number } };
export type PokemonSummary = { format: string; generation: number; games: string[]; trainer: { name: string }; slots: PokemonSlot[]; boxes: { id: number; name: string }[]; risk?: { reason: string }; maxSpecies: number; canExport?: boolean; canAnalyze: boolean; differences?: { field: string; before: unknown; after: unknown }[]; detail?: { image?: string | null; entity: PokemonEntity; legality?: { valid: boolean; lines: string[] }; showdown: string; met?: { versionName: string; metLocationName: string; metLevel: number } }; choices?: { species: string[]; moves: string[]; items: string[]; natures: string[]; abilities: string[]; caps: { ivMax: number; evMax: number } } };
export type PokemonChange = { operation: string; box?: number; slot?: number; name?: string; differences?: { field: string; before: unknown; after: unknown }[]; transfer?: { changes: string[]; warnings: string[]; legality: string; backwards: boolean } };
export type PokemonBankResponse = { unreadableEntries?: number; bankTruncated?: boolean; saves?: PokemonDetectedSave[]; ready?: boolean; sourcePath?: string; draftSkipped?: boolean; changes?: PokemonChange[]; history?: { id: string; at: number }[]; bank?: PokemonBankEntry[]; session?: string; name?: string; summary?: PokemonSummary; review?: string | null; backup?: string; fileName?: string; format?: string };
let workspace: string | undefined;
function workspaceId() {
  if (workspace) return workspace;
  const key = "harbor.pokemon.workspace";
  try {
    workspace = sessionStorage.getItem(key) || crypto.randomUUID();
    sessionStorage.setItem(key, workspace);
  } catch { workspace = crypto.randomUUID(); }
  return workspace;
}
export const pokemonBankRequest = (profile: string, request: Record<string, unknown>) => invoke<PokemonBankResponse>("games_pokemon", { profile, request: { ...request, workspace: workspaceId() } });
