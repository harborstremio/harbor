import { safeFetch } from "@/lib/safe-fetch";
import { assertSafeUrl } from "@/lib/manga/plugins/host-http";
import { PluginWorker } from "@/lib/manga/plugins/worker-host";
import type { InstalledPlugin } from "@/lib/manga/plugins/types";
import { buildMangayomiSource } from "./prelude";
import { saveMangayomiSource } from "./store";
import type { MangayomiIndexEntry, MangayomiSourceRecord } from "./types";

const FETCH_TIMEOUT = 20_000;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

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

function isImportableEntry(o: Record<string, unknown>): boolean {
  if (typeof o.name !== "string" || !o.name) return false;
  if (typeof o.baseUrl !== "string" || !o.baseUrl) return false;
  const code = codeLocation(o);
  if (!code) return false;
  if (!looksManga(o)) return false;
  if (isDartLang(o.sourceCodeLanguage)) return false;
  if (isJsLang(o.sourceCodeLanguage)) return true;
  return !/\.dart(\?|#|$)/i.test(code);
}

function isJsEntry(v: unknown): v is MangayomiIndexEntry {
  return !!v && typeof v === "object" && isImportableEntry(v as Record<string, unknown>);
}

function entryArray(parsed: unknown): Record<string, unknown>[] {
  let raw: unknown[] = [];
  if (Array.isArray(parsed)) raw = parsed;
  else if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.sources)) raw = o.sources;
    else if (Array.isArray(o.mangayomiSources)) raw = o.mangayomiSources;
  }
  return raw.filter((e): e is Record<string, unknown> => !!e && typeof e === "object");
}

function pickLangId(
  ids: Record<string, unknown> | undefined,
  lang: string,
  baseId: string | number | undefined,
): string | number | undefined {
  const v = ids ? ids[lang] : undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) return v;
  if (baseId != null && String(baseId).trim()) return String(baseId) + "-" + lang;
  return undefined;
}

function normalizeEntry(o: Record<string, unknown>): MangayomiIndexEntry {
  const id = typeof o.id === "string" || typeof o.id === "number" ? o.id : undefined;
  const version =
    typeof o.version === "string" || typeof o.version === "number" ? String(o.version) : "0";
  const scl =
    typeof o.sourceCodeLanguage === "string" || typeof o.sourceCodeLanguage === "number"
      ? o.sourceCodeLanguage
      : 1;
  return {
    id,
    name: String(o.name ?? ""),
    lang: "",
    baseUrl: typeof o.baseUrl === "string" ? o.baseUrl : "",
    apiUrl: typeof o.apiUrl === "string" ? o.apiUrl : undefined,
    iconUrl: typeof o.iconUrl === "string" ? o.iconUrl : undefined,
    typeSource: typeof o.typeSource === "string" ? o.typeSource : undefined,
    itemType: typeof o.itemType === "number" ? o.itemType : 0,
    isManga: o.isManga === true ? true : undefined,
    pkgPath: typeof o.pkgPath === "string" ? o.pkgPath : undefined,
    version,
    sourceCodeUrl: codeLocation(o),
    sourceCodeLanguage: scl,
    isNsfw: o.isNsfw === true,
  };
}

function expandEntry(o: Record<string, unknown>): MangayomiIndexEntry[] {
  const base = normalizeEntry(o);
  const lang = typeof o.lang === "string" ? o.lang.trim() : "";
  if (lang) return [{ ...base, lang }];
  const langs = Array.isArray(o.langs)
    ? o.langs.filter((l): l is string => typeof l === "string" && !!l.trim())
    : [];
  if (langs.length) {
    const ids = o.ids && typeof o.ids === "object" ? (o.ids as Record<string, unknown>) : undefined;
    return langs.map((l) => ({ ...base, lang: l, id: pickLangId(ids, l, base.id) }));
  }
  return [{ ...base, lang: "all" }];
}

export function parseMangayomiIndex(parsed: unknown): MangayomiIndexEntry[] {
  const out: MangayomiIndexEntry[] = [];
  for (const raw of entryArray(parsed)) {
    if (!isJsEntry(raw)) continue;
    for (const e of expandEntry(raw)) out.push(e);
  }
  return out;
}

export async function fetchMangayomiIndex(url: string): Promise<MangayomiIndexEntry[]> {
  const target = assertSafeUrl(url);
  const res = await safeFetch(target, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error("index fetch failed: " + res.status);
  return parseMangayomiIndex(JSON.parse(await res.text()));
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fold32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function entryId(entry: MangayomiIndexEntry, repoUrl: string): string {
  const rk = fold32(repoUrl);
  if (entry.id != null && String(entry.id).trim())
    return "my-" + rk + "-" + String(entry.id).trim();
  const slug = (entry.name + "-" + entry.lang)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const key = fold32(entry.sourceCodeUrl + "|" + entry.baseUrl + "|" + entry.lang);
  return "my-" + rk + "-" + (slug ? slug.slice(0, 48) + "-" : "") + key;
}

function dedupeVariants(entries: MangayomiIndexEntry[]): MangayomiIndexEntry[] {
  const pref = ["en", "all", "multi", "en-us"];
  const groups = new Map<string, MangayomiIndexEntry[]>();
  for (const e of entries) {
    const key = `${e.name}|${e.baseUrl}|${e.sourceCodeUrl}`;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }
  const out: MangayomiIndexEntry[] = [];
  for (const group of groups.values()) {
    let pick = group[0];
    for (const p of pref) {
      const hit = group.find((e) => (e.lang || "").toLowerCase() === p);
      if (hit) {
        pick = hit;
        break;
      }
    }
    out.push(pick);
  }
  return out;
}

async function toRecord(
  entry: MangayomiIndexEntry,
  repoUrl: string,
): Promise<MangayomiSourceRecord> {
  const target = assertSafeUrl(new URL(entry.sourceCodeUrl, repoUrl).href);
  const res = await safeFetch(target, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error("source fetch failed: " + res.status);
  const source = await res.text();
  if (source.length > MAX_SOURCE_BYTES) throw new Error("source too large");
  return {
    id: entryId(entry, repoUrl),
    name: entry.name,
    lang: entry.lang,
    baseUrl: entry.baseUrl.replace(/\/+$/, ""),
    apiUrl: (entry.apiUrl ?? "").replace(/\/+$/, ""),
    iconUrl: typeof entry.iconUrl === "string" ? entry.iconUrl : undefined,
    version: String(entry.version ?? "0"),
    itemType: typeof entry.itemType === "number" ? entry.itemType : 0,
    isNsfw: entry.isNsfw === true,
    repoUrl,
    sourceCodeUrl: target,
    source,
    hash: await sha256Hex(source),
    enabled: true,
    hasTags: false,
  };
}

async function probeTags(record: MangayomiSourceRecord): Promise<boolean> {
  const probe = new PluginWorker({
    id: record.id,
    name: record.name,
    version: record.version,
    lang: record.lang,
    nsfw: record.isNsfw,
    icon: record.iconUrl,
    repoUrl: record.repoUrl,
    baseUrl: record.baseUrl,
    source: buildMangayomiSource(record),
    hash: record.hash,
    enabled: true,
    hasTags: false,
    config: undefined,
  } as InstalledPlugin);
  try {
    const meta = await probe.meta();
    return meta.hasTags;
  } catch {
    return false;
  } finally {
    probe.dispose();
  }
}

export async function installMangayomiSource(
  entry: MangayomiIndexEntry,
  repoUrl: string,
): Promise<MangayomiSourceRecord> {
  const record = await toRecord(entry, repoUrl);
  record.hasTags = await probeTags(record);
  await saveMangayomiSource(record);
  return record;
}

export async function importMangayomiRepo(
  url: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ installed: number; failed: number }> {
  const entries = dedupeVariants(await fetchMangayomiIndex(url));
  let installed = 0;
  let failed = 0;
  for (let i = 0; i < entries.length; i++) {
    try {
      await installMangayomiSource(entries[i], url);
      installed++;
    } catch {
      failed++;
    }
    onProgress?.(i + 1, entries.length);
  }
  return { installed, failed };
}
