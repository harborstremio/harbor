import { savePlugin, deletePlugin, installedPluginsSync } from "./store";
import { disposePlugin, warmPlugin } from "./runtime";
import type { InstalledPlugin } from "./types";

export async function uninstallPlugin(id: string): Promise<void> {
  disposePlugin(id);
  await deletePlugin(id);
}

export async function setPluginEnabled(id: string, enabled: boolean): Promise<void> {
  const p = installedPluginsSync().find((x) => x.id === id);
  if (!p || p.enabled === enabled) return;
  if (!enabled) disposePlugin(id);
  const next: InstalledPlugin = { ...p, enabled };
  await savePlugin(next);
  if (enabled) warmPlugin(next);
}

export function warmPlugins(): void {
  for (const p of installedPluginsSync()) {
    if (p.enabled) warmPlugin(p);
  }
}
