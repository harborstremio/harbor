import type { Settings } from "@/lib/settings";
import { SHADER_CATALOG, STAGE_ORDER, type ShaderCatalogEntry } from "./shader-catalog";

function selectedFiles(entry: ShaderCatalogEntry, variant?: string): string[] {
  if (!entry.variants || entry.variants.length === 0) return entry.files;
  const v = entry.variants.find((x) => x.id === variant) ?? entry.variants[0];
  return v.files;
}

function normDir(dir: string): string {
  return dir.replace(/\\/g, "/").replace(/\/+$/, "");
}

function conflictBlocked(entry: ShaderCatalogEntry, settings: Settings): boolean {
  if (!entry.conflictsWith) return false;
  return entry.conflictsWith.some((c) => {
    if (c === "hdrToSdr") return settings.playerHdrToSdr;
    if (c === "rtxHdr") return settings.playerRtxHdr;
    return false;
  });
}

export function generalShaderChain(settings: Settings): string[] {
  const stages: Array<{ order: number; paths: string[] }> = [];
  for (const entry of SHADER_CATALOG) {
    const st = settings.playerShaders?.[entry.id];
    if (!st?.enabled || !st.dir) continue;
    if (conflictBlocked(entry, settings)) continue;
    const dir = normDir(st.dir);
    const paths = selectedFiles(entry, st.variant).map((f) => `${dir}/${f}`);
    stages.push({ order: STAGE_ORDER[entry.stage], paths });
  }
  stages.sort((a, b) => a.order - b.order);
  return stages.flatMap((s) => s.paths);
}

export function shaderCompanionProps(settings: Settings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of SHADER_CATALOG) {
    const st = settings.playerShaders?.[entry.id];
    if (!st?.enabled || !st.dir || !entry.companionProps) continue;
    if (conflictBlocked(entry, settings)) continue;
    Object.assign(out, entry.companionProps);
  }
  return out;
}

export function shaderCompanionOptions(settings: Settings): string {
  const props = shaderCompanionProps(settings);
  return Object.entries(props)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

export function generalShaderKey(settings: Settings): string {
  const map = settings.playerShaders ?? {};
  return SHADER_CATALOG.filter((e) => map[e.id]?.enabled && map[e.id]?.dir)
    .map((e) => `${e.id}:${map[e.id]?.variant ?? ""}`)
    .join(",");
}
