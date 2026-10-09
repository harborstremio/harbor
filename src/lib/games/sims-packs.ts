import names from "./sims-pack-names.json";
import { invoke } from "@tauri-apps/api/core";
import type { SimsCustomLaunch } from "./sims-installations";

export type SimsPackReport = { path: string; packs: { code: string; status: "found" | "unchecked"; files: string[] }[]; partial: boolean; checkedAt: number; launch?: { source: "steam" | "ea" | "custom" | null; state: "checked" | "unknown" | "conflicting"; disabled: string[] } };
export type SimsPackSelection = { path: string; custom: SimsCustomLaunch[] };
export const simsCheckPacks = (profile: string, path: string, operationId: string, custom: SimsCustomLaunch[] = []) => invoke<SimsPackReport>("games_sims_packs", { profile, path, operationId, custom });
const folderKey = (profile: string) => `harbor.games.sims.installation:${profile}`;
export function readSimsInstallation(profile: string) { try { const value = localStorage.getItem(folderKey(profile)); return value && value.length <= 4096 ? value : ""; } catch { return ""; } }
export function rememberSimsInstallation(profile: string, path: string) { try { localStorage.setItem(folderKey(profile), path); } catch { /* Current check remains usable. */ } }

// PlumbBuddy's public community pack catalog, observed 2026-10-03 UTC.
// This translates identifiers only; it says nothing about installed/owned packs.
// Source and update procedure: docs/games/SIMS-METADATA.md.
export function simsPackName(code: string): string | undefined {
  const key = code.trim().toUpperCase();
  return Object.hasOwn(names, key) ? names[key as keyof typeof names] : undefined;
}

// Exact catalog titles with provider suffixes removed. Unknown names are never
// fuzzy-matched to a pack: a guess here would become a false requirement result.
const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[™®]/g, "").trim()
  .replace(/^the sims 4\s*[:–-]?\s*/, "").replace(/\s+(expansion pack|game pack|stuff pack|stuff|kit)$/i, "")
  .replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
const codesByName = new Map(Object.entries(names).map(([code, name]) => [normalize(name), code]));
export function simsPackCode(value: string): string | undefined {
  const key = value.trim().toUpperCase();
  return /^[EFGS]P\d{2}$/.test(key) ? key : codesByName.get(normalize(value));
}
export function simsPackStatus(value: string, report: SimsPackReport | null): "found" | "missing" | "unchecked" | "disabled" {
  const code = simsPackCode(value);
  if (!code || !report) return "unchecked";
  const entry = report.packs.find(pack => pack.code === code);
  if (entry?.status === "found" && report.launch?.state === "checked" && report.launch.disabled.includes(code)) return "disabled";
  return entry?.status ?? (report.partial ? "unchecked" : "missing");
}
