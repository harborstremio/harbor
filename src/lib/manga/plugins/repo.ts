import { safeFetch } from "@/lib/safe-fetch";
import { assertSafeUrl } from "./host-http";
import { savePlugin } from "./store";
import { PluginWorker } from "./worker-host";
import type { ForeignRepoKind, PluginManifest, PluginRepo, InstalledPlugin } from "./types";

function isJsLang(v: unknown): boolean {
  if (v === 1) return true;
  const s = String(v ?? "").toLowerCase();
  return s === "1" || s === "javascript" || s === "js";
}

function isDartLang(v: unknown): boolean {
  if (v === 0) return true;
  const s = String(v ?? "").toLowerCase();
  return s === "0" || s === "dart";
}

function foreignEntryArray(parsed: unknown): Record<string, unknown>[] {
  let raw: unknown[] = [];
  if (Array.isArray(parsed)) raw = parsed;
  else if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.sources)) raw = o.sources;
    else if (Array.isArray(o.mangayomiSources)) raw = o.mangayomiSources;
  }
  return raw.filter((e): e is Record<string, unknown> => !!e && typeof e === "object");
}

function codeLocation(o: Record<string, unknown>): string {
  const sc = typeof o.sourceCodeUrl === "string" ? o.sourceCodeUrl.trim() : "";
  if (sc) return sc;
  return typeof o.pkgPath === "string" ? o.pkgPath.trim() : "";
}

function looksManga(o: Record<string, unknown>): boolean {
  if (typeof o.itemType === "number") return o.itemType === 0;
  if (o.isManga === true) return true;
  if (o.isManga === false) return false;
  return true;
}

function isMangayomiEntry(o: Record<string, unknown>): boolean {
  return (
    (typeof o.sourceCodeUrl === "string" && o.sourceCodeUrl.trim() !== "") ||
    typeof o.pkgPath === "string" ||
    o.sourceCodeLanguage != null ||
    (typeof o.typeSource === "string" && typeof o.baseUrl === "string")
  );
}

function isImportableMangayomi(o: Record<string, unknown>): boolean {
  const code = codeLocation(o);
  if (!code) return false;
  if (typeof o.name !== "string" || !o.name) return false;
  if (typeof o.baseUrl !== "string" || !o.baseUrl) return false;
  if (!looksManga(o)) return false;
  if (isDartLang(o.sourceCodeLanguage)) return false;
  if (isJsLang(o.sourceCodeLanguage)) return true;
  return !/\.dart(\?|#|$)/i.test(code);
}

function langCount(o: Record<string, unknown>): number {
  if (typeof o.lang === "string" && o.lang.trim()) return 1;
  if (Array.isArray(o.langs)) {
    const n = o.langs.filter((l) => typeof l === "string" && l.trim()).length;
    if (n) return n;
  }
  return 1;
}

function classifyForeign(parsed: unknown): { kind: ForeignRepoKind; count: number } | null {
  const arr = foreignEntryArray(parsed);
  if (!arr.length) return null;

  const mihon = arr.filter((e) => typeof e.apk === "string" && "pkg" in e);
  if (mihon.length) {
    const sources = mihon.reduce((n, e) => n + (Array.isArray(e.sources) ? e.sources.length : 1), 0);
    return { kind: "tachiyomi", count: sources };
  }

  const mangayomi = arr.filter(isMangayomiEntry);
  if (mangayomi.length) {
    const count = mangayomi.filter(isImportableMangayomi).reduce((n, e) => n + langCount(e), 0);
    return { kind: "mangayomi", count };
  }

  const paperback = arr.filter(
    (e) => ("contentRating" in e || "intents" in e) && !("apk" in e) && !("entry" in e),
  );
  if (paperback.length) return { kind: "paperback", count: paperback.length };

  return { kind: "unknown", count: arr.length };
}

const FETCH_TIMEOUT = 20_000;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

function toManifest(v: unknown): PluginManifest | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const name = typeof o.name === "string" ? o.name : "";
  const entry = typeof o.entry === "string" ? o.entry : "";
  if (!id || !name || !entry) return null;
  return {
    id,
    name,
    version: typeof o.version === "string" ? o.version : "0",
    lang: typeof o.lang === "string" ? o.lang : "en",
    nsfw: o.nsfw === true,
    icon: typeof o.icon === "string" ? o.icon : undefined,
    entry,
  };
}

export async function fetchRepo(url: string): Promise<PluginRepo> {
  const target = assertSafeUrl(url);
  const res = await safeFetch(target, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error("repo fetch failed: " + res.status);
  const parsed: unknown = JSON.parse(await res.text());
  const json = (parsed && typeof parsed === "object" ? parsed : {}) as {
    name?: unknown;
    plugins?: unknown;
  };
  const name = typeof json.name === "string" ? json.name : "Repository";
  const plugins = Array.isArray(json.plugins)
    ? json.plugins.map(toManifest).filter((m): m is PluginManifest => m != null)
    : [];
  const foreign = plugins.length === 0 ? (classifyForeign(parsed) ?? undefined) : undefined;
  return { name, url: target, plugins, foreign };
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchPluginSource(manifest: PluginManifest, repoUrl: string): Promise<InstalledPlugin> {
  const entry = new URL(manifest.entry, repoUrl).href;
  const target = assertSafeUrl(entry);
  const res = await safeFetch(target, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error("plugin entry fetch failed: " + res.status);
  const source = await res.text();
  if (source.length > MAX_SOURCE_BYTES) throw new Error("plugin source too large");
  const hash = await sha256Hex(source);
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    lang: manifest.lang,
    nsfw: manifest.nsfw,
    icon: manifest.icon,
    repoUrl,
    source,
    hash,
    enabled: true,
    hasTags: false,
    config: undefined,
  };
}

export async function installPlugin(manifest: PluginManifest, repoUrl: string): Promise<InstalledPlugin> {
  const plugin = await fetchPluginSource(manifest, repoUrl);
  const probe = new PluginWorker(plugin);
  try {
    const meta = await probe.meta();
    plugin.hasTags = meta.hasTags;
  } catch {
    plugin.hasTags = false;
  } finally {
    probe.dispose();
  }
  await savePlugin(plugin);
  return plugin;
}
