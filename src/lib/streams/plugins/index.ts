import { loadStreamRepos, subscribeStreamRepos } from "./repos";
import { subscribeStreamRuntime } from "./runtime";
import { loadInstalledStreamPlugins, subscribeStreamPluginStore } from "./store";

export type {
  InstalledStreamPlugin,
  NativeExtensionRef,
  PluginCatalogue,
  PluginCheckResult,
  PluginHealth,
  PluginLogLine,
  PluginStream,
  StreamPluginFormat,
  StreamPluginRequest,
  StreamPluginSettingsField,
  StreamRepoEntry,
  StreamRepoRecord,
  StreamRequestContext,
} from "./types";
export { PluginError, pluginErrorCode } from "./types";
export { installedStreamPluginsSync, streamPluginById } from "./store";
export {
  addStreamRepo,
  fetchStreamRepoManifest,
  normalizeStreamRepoUrl,
  refreshStreamRepo,
  removeStreamRepo,
  streamRepoByUrl,
  streamReposSync,
} from "./repos";
export {
  installEntry,
  patchStreamPlugin,
  revertPlugin,
  saveStreamPluginSettings,
  setStreamPluginEnabled,
  uninstallStreamPlugin,
} from "./install";
export { settingsValuesFor } from "./source";
export {
  checkStreamPlugin,
  disposeAllStreamPlugins,
  disposeStreamPlugin,
  pluginHealth,
  pluginLog,
  streamPluginSettingsFields,
} from "./runtime";
export {
  isPluginAddon,
  pluginAddons,
  pluginAddonById,
  pluginCacheTokens,
  pluginIdFromCatalogueBase,
  pluginListKey,
  pluginsForAddon,
  runPluginAddon,
  setStreamPluginConfig,
} from "./addon";
export { pluginCatalogueSources, providesOwnRows, runnableStreamPlugins } from "./runnable";
export { splitRepoLinks } from "./manifest";
export {
  extensionCataloguePage,
  extensionCataloguesSync,
  refreshExtensionCatalogues,
  subscribeExtensionCatalogues,
} from "./catalogues";
export { extensionCatalogueBase, isExtensionCatalogueBase } from "./extension/catalogue";

let loading: Promise<void> | null = null;

export function loadStreamPlugins(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      await loadInstalledStreamPlugins();
      await loadStreamRepos();
    })().catch(() => {
      loading = null;
    });
  }
  return loading;
}

export function subscribeStreamPlugins(cb: () => void): () => void {
  const a = subscribeStreamPluginStore(cb);
  const b = subscribeStreamRepos(cb);
  const c = subscribeStreamRuntime(cb);
  return () => {
    a();
    b();
    c();
  };
}

export function subscribeStreamPluginList(cb: () => void): () => void {
  const a = subscribeStreamPluginStore(cb);
  const b = subscribeStreamRepos(cb);
  return () => {
    a();
    b();
  };
}
