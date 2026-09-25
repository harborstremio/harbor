import { safeFetch } from "@/lib/safe-fetch";
import { assertSafeUrl } from "@/lib/manga/plugins/host-http";
import { PluginWorker } from "@/lib/manga/plugins/worker-host";
import { setSecret } from "@/lib/secret-store";
import { pluginIdFor } from "./manifest";
import { installNativeArchive, uninstallNativeExtension } from "./native";
import { disposeStreamPlugin } from "./runtime";
import { SECRET_PREFIX, workerPluginFor } from "./source";
import { deleteStreamPlugin, saveStreamPlugin, streamPluginById } from "./store";
import {
  PluginError,
  type InstalledStreamPlugin,
  type StreamPluginSettingsField,
  type StreamRepoEntry,
  type StreamRepoRecord,
} from "./types";

const FETCH_TIMEOUT = 20_000;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
const MAX_ICON_BYTES = 64 * 1024;
const READY_TIMEOUT = 10_000;

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(text));
}

export async function fetchEntryCode(entry: StreamRepoEntry): Promise<{ code: string; etag?: string }> {
  const target = assertSafeUrl(entry.entry);
  let res: Response;
  try {
    res = await safeFetch(target, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  } catch {
    throw new PluginError("fetch-failed");
  }
  if (!res.ok) throw new PluginError("fetch-failed", `HTTP ${res.status}`);
  const code = await res.text();
  if (code.length > MAX_SOURCE_BYTES) throw new PluginError("too-large");
  const etag = res.headers.get("etag") ?? undefined;
  return { code, etag };
}

async function fetchArchive(
  entry: StreamRepoEntry,
): Promise<{ bytes: Uint8Array; etag?: string }> {
  const target = assertSafeUrl(entry.entry);
  let res: Response;
  try {
    res = await safeFetch(target, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  } catch {
    throw new PluginError("fetch-failed");
  }
  if (!res.ok) throw new PluginError("fetch-failed", `HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) throw new PluginError("fetch-failed", "empty file");
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new PluginError("too-large");
  return { bytes, etag: res.headers.get("etag") ?? undefined };
}

function archiveName(entry: StreamRepoEntry): string {
  const safe = entry.id.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60) || "extension";
  return `${safe}.cs3`;
}

async function fetchIcon(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const target = assertSafeUrl(url);
    const res = await safeFetch(target, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return undefined;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return undefined;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ICON_BYTES) return undefined;
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return `data:${type.split(";")[0]};base64,${btoa(bin)}`;
  } catch {
    return undefined;
  }
}

async function probe(plugin: InstalledStreamPlugin): Promise<void> {
  const worker = new PluginWorker(workerPluginFor(plugin), {
    readyTimeoutMs: READY_TIMEOUT,
    httpPolicy: { sameSiteHeaders: true, publicOnly: true },
  });
  try {
    const meta = await worker.meta();
    if (!(meta.methods ?? []).includes("streams")) throw new PluginError("not-stream-plugin");
  } catch (e) {
    if (e instanceof PluginError) throw e;
    const text = e instanceof Error ? e.message : String(e);
    if (/not-stream-plugin/.test(text)) throw new PluginError("not-stream-plugin");
    throw new PluginError("start-failed", text);
  } finally {
    worker.dispose();
  }
}

function fromEntry(
  repo: StreamRepoRecord,
  entry: StreamRepoEntry,
  code: string,
  hash: string,
  etag: string | undefined,
  prior: InstalledStreamPlugin | undefined,
): InstalledStreamPlugin {
  const now = Date.now();
  return {
    id: pluginIdFor(repo.url, entry.id),
    entryId: entry.id,
    repoUrl: repo.url,
    repoName: repo.name,
    name: entry.name,
    version: entry.version,
    format: entry.format,
    code,
    hash,
    etag,
    native: null,
    icon: prior?.icon,
    description: entry.description,
    author: entry.author,
    lang: entry.lang,
    types: entry.types,
    idPrefixes: entry.idPrefixes,
    hosts: entry.hosts,
    learnedHosts: prior?.learnedHosts ?? [],
    limitHosts: prior?.limitHosts ?? false,
    settings: entry.settings,
    nsfw: entry.nsfw,
    enabled: prior?.enabled ?? true,
    repoDisabled: !entry.enabled,
    verified: !!entry.sha256,
    incompatible: null,
    installedAt: prior?.installedAt ?? now,
    updatedAt: now,
    timeoutMs: entry.timeoutMs,
    previous: prior ? { version: prior.version, code: prior.code, hash: prior.hash, etag: prior.etag } : null,
    settingsValues: prior?.settingsValues ?? {},
    secretKeys: prior?.secretKeys ?? [],
    autoPaused: false,
    failures: 0,
    listed: true,
    filesChanged: false,
    updateVersion: null,
  };
}

async function installArchiveEntry(
  repo: StreamRepoRecord,
  entry: StreamRepoEntry,
): Promise<InstalledStreamPlugin> {
  const { bytes, etag } = await fetchArchive(entry);
  const hash = await sha256Bytes(bytes);
  if (entry.sha256 && entry.sha256 !== hash) throw new PluginError("checksum");
  const prior = streamPluginById(pluginIdFor(repo.url, entry.id));
  const native = await installNativeArchive(bytes, archiveName(entry));
  const plugin: InstalledStreamPlugin = {
    ...fromEntry(repo, entry, "", hash, etag, prior),
    native,
    previous: null,
  };
  plugin.icon = (await fetchIcon(entry.icon)) ?? prior?.icon;
  await saveStreamPlugin(plugin);
  return plugin;
}

export async function installEntry(
  repo: StreamRepoRecord,
  entry: StreamRepoEntry,
): Promise<InstalledStreamPlugin> {
  if (entry.format === "android-extension") return installArchiveEntry(repo, entry);
  const { code, etag } = await fetchEntryCode(entry);
  const hash = await sha256Hex(code);
  if (entry.sha256 && entry.sha256 !== hash) throw new PluginError("checksum");
  const prior = streamPluginById(pluginIdFor(repo.url, entry.id));
  const plugin = fromEntry(repo, entry, code, hash, etag, prior);
  await probe(plugin);
  plugin.icon = (await fetchIcon(entry.icon)) ?? prior?.icon;
  disposeStreamPlugin(plugin.id);
  await saveStreamPlugin(plugin);
  return plugin;
}

export async function revertPlugin(id: string): Promise<void> {
  const plugin = streamPluginById(id);
  if (!plugin?.previous) return;
  const prev = plugin.previous;
  const next: InstalledStreamPlugin = {
    ...plugin,
    version: prev.version,
    code: prev.code,
    hash: prev.hash,
    etag: prev.etag,
    previous: null,
    updatedAt: Date.now(),
    autoPaused: false,
    failures: 0,
    updateVersion: plugin.version,
  };
  disposeStreamPlugin(id);
  await saveStreamPlugin(next);
}

export async function uninstallStreamPlugin(id: string): Promise<void> {
  const plugin = streamPluginById(id);
  disposeStreamPlugin(id);
  if (plugin?.native) await uninstallNativeExtension(plugin.native.extensionId).catch(() => {});
  for (const key of plugin?.secretKeys ?? []) setSecret(`${SECRET_PREFIX}.${id}.${key}`, null);
  await deleteStreamPlugin(id);
}

export async function setStreamPluginEnabled(id: string, enabled: boolean): Promise<void> {
  const plugin = streamPluginById(id);
  if (!plugin || (plugin.enabled === enabled && !plugin.autoPaused)) return;
  if (!enabled) disposeStreamPlugin(id);
  await saveStreamPlugin({ ...plugin, enabled, autoPaused: false, failures: 0 });
}

export async function patchStreamPlugin(
  id: string,
  patch: Partial<InstalledStreamPlugin>,
): Promise<void> {
  const plugin = streamPluginById(id);
  if (!plugin) return;
  await saveStreamPlugin({ ...plugin, ...patch });
}

export async function saveStreamPluginSettings(
  id: string,
  values: Record<string, string | boolean>,
  fields: StreamPluginSettingsField[],
): Promise<void> {
  const plugin = streamPluginById(id);
  if (!plugin) return;
  const secret = new Set(
    fields.flatMap((f) => (f.type === "text" && f.isPassword ? [f.key] : [])),
  );
  const plain: Record<string, string | boolean> = {};
  const secretKeys: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (secret.has(key)) {
      setSecret(`${SECRET_PREFIX}.${id}.${key}`, typeof value === "string" && value ? value : null);
      if (typeof value === "string" && value) secretKeys.push(key);
    } else {
      plain[key] = value;
    }
  }
  for (const key of plugin.secretKeys) {
    if (!secretKeys.includes(key) && !(key in values)) secretKeys.push(key);
  }
  disposeStreamPlugin(id);
  await saveStreamPlugin({ ...plugin, settingsValues: plain, secretKeys });
}
