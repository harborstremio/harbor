import { invoke } from "@tauri-apps/api/core";
import { extensionsSupported, forgetBridgeProviders } from "./extension/bridge";
import { PluginError, type NativeExtensionRef } from "./types";

const ARCHIVE_DIR = "extension-archives";

type InstallAnswer = {
  id?: unknown;
  file?: unknown;
  providers?: unknown;
};

function refFrom(answer: InstallAnswer, fallbackFile: string): NativeExtensionRef {
  const extensionId = typeof answer.id === "string" ? answer.id : "";
  if (!extensionId) throw new PluginError("install-failed", "the bridge returned no extension id");
  const providers = Array.isArray(answer.providers) ? answer.providers : [];
  const providerIds = providers
    .map((p) => (p && typeof p === "object" ? (p as { id?: unknown }).id : null))
    .filter((id): id is string => typeof id === "string" && !!id);
  return {
    extensionId,
    providerIds,
    file: typeof answer.file === "string" && answer.file ? answer.file : fallbackFile,
  };
}

export async function installNativeArchive(
  bytes: Uint8Array,
  fileName: string,
): Promise<NativeExtensionRef> {
  if (!extensionsSupported()) throw new PluginError("desktop-only");
  const [{ appDataDir, join }, { mkdir, writeFile, remove }] = await Promise.all([
    import("@tauri-apps/api/path"),
    import("@tauri-apps/plugin-fs"),
  ]);
  const dir = await join(await appDataDir(), ARCHIVE_DIR);
  await mkdir(dir, { recursive: true }).catch(() => {});
  const path = await join(dir, fileName);
  await writeFile(path, bytes);
  try {
    const answer = await invoke<InstallAnswer>("capstan_install", { path });
    forgetBridgeProviders();
    return refFrom(answer ?? {}, path);
  } catch (e) {
    if (e instanceof PluginError) throw e;
    throw new PluginError("install-failed", e instanceof Error ? e.message : String(e));
  } finally {
    await remove(path).catch(() => {});
  }
}

export async function uninstallNativeExtension(extensionId: string): Promise<void> {
  if (!extensionsSupported()) return;
  await invoke("capstan_uninstall", { id: extensionId });
  forgetBridgeProviders();
}
