import { useEffect, useSyncExternalStore } from "react";
import { pluginCatalogueSources } from "./runnable";
import { loadInstalledStreamPlugins, subscribeStreamPluginStore } from "./store";

/** The installed set starts empty and fills from disk, so the first look has to pull it in. Once
 * that has happened the store notifies this hook like any other reader. */
let ensured = false;

function ensureInstalledPlugins(): void {
  if (ensured) return;
  ensured = true;
  void loadInstalledStreamPlugins().catch(() => {
    ensured = false;
  });
}

function hasCatalogueSources(): boolean {
  return pluginCatalogueSources().length > 0;
}

/** Whether any installed plugin can stand up browsable rows of its own. The plugin tab is only
 * worth showing when one can, which is the same condition the catalogue layer uses, so the tab
 * never comes up empty. */
export function usePluginCataloguesAvailable(): boolean {
  const available = useSyncExternalStore(
    subscribeStreamPluginStore,
    hasCatalogueSources,
    hasCatalogueSources,
  );
  useEffect(ensureInstalledPlugins, []);
  return available;
}
