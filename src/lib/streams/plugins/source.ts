import type { InstalledPlugin } from "@/lib/manga/plugins/types";
import { getSecret } from "@/lib/secret-store";
import { composeHarborSource, composeProviderSource } from "./provider-compat/prelude";
import type { InstalledStreamPlugin } from "./types";

export const SECRET_PREFIX = "harbor.plugin.secret.v1";

export function settingsValuesFor(plugin: InstalledStreamPlugin): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = { ...plugin.settingsValues };
  for (const key of plugin.secretKeys) {
    const v = getSecret(`${SECRET_PREFIX}.${plugin.id}.${key}`);
    if (v != null) out[key] = v;
  }
  return out;
}

export function composedSource(plugin: InstalledStreamPlugin): string {
  if (plugin.format === "provider-script") {
    return composeProviderSource(plugin.code, {
      id: plugin.entryId,
      name: plugin.name,
      settings: settingsValuesFor(plugin),
    });
  }
  return composeHarborSource(plugin.code);
}

export function workerPluginFor(plugin: InstalledStreamPlugin): InstalledPlugin {
  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    lang: plugin.lang[0] ?? "en",
    nsfw: plugin.nsfw,
    icon: plugin.icon,
    repoUrl: plugin.repoUrl,
    source: composedSource(plugin),
    hash: plugin.hash,
    enabled: plugin.enabled,
    hasTags: false,
  };
}

export function settingsFingerprint(plugin: InstalledStreamPlugin): string {
  const text = JSON.stringify(settingsValuesFor(plugin));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
