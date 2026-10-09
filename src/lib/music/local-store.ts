import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

const DIR = "music-store";
const FLUSH_MS = 500;
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const cache = new Map<string, unknown>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();
let ready: Promise<void> | null = null;

function fileFor(name: string): string {
  const safe = name.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80);
  return `${DIR}/${safe}.json`;
}

async function ensureDir(): Promise<void> {
  ready ??= (async () => {
    if (await exists(DIR, { baseDir: BaseDirectory.AppData })) return;
    await mkdir(DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  })().catch(() => {});
  return ready;
}

export async function readLocalJson<T>(name: string): Promise<T | null> {
  if (cache.has(name)) return cache.get(name) as T;
  if (!IS_TAURI) return null;
  try {
    const path = fileFor(name);
    if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) return null;
    const raw = await readTextFile(path, { baseDir: BaseDirectory.AppData });
    const value = JSON.parse(raw) as T;
    cache.set(name, value);
    return value;
  } catch {
    return null;
  }
}

export function cachedLocalJson<T>(name: string): T | null {
  return cache.has(name) ? (cache.get(name) as T) : null;
}

async function flush(name: string): Promise<void> {
  if (!IS_TAURI) return;
  const value = cache.get(name);
  if (value === undefined) return;
  try {
    await ensureDir();
    await writeTextFile(fileFor(name), JSON.stringify(value), {
      baseDir: BaseDirectory.AppData,
    });
  } catch {}
}

export function writeLocalJson(name: string, value: unknown): void {
  cache.set(name, value);
  const held = pending.get(name);
  if (held) clearTimeout(held);
  pending.set(
    name,
    setTimeout(() => {
      pending.delete(name);
      void flush(name);
    }, FLUSH_MS),
  );
}

export async function flushLocalJson(): Promise<void> {
  const names = [...pending.keys()];
  for (const name of names) {
    const held = pending.get(name);
    if (held) clearTimeout(held);
    pending.delete(name);
  }
  await Promise.all(names.map((name) => flush(name)));
}

export async function hydrateJsonStore(name: string, legacyKey: string): Promise<void> {
  if (cache.has(name)) return;
  const stored = await readLocalJson<unknown>(name);
  if (stored !== null) return;
  let legacy: unknown = null;
  try {
    const raw = localStorage.getItem(legacyKey);
    legacy = raw ? JSON.parse(raw) : null;
  } catch {
    legacy = null;
  }
  if (legacy === null) return;
  cache.set(name, legacy);
  writeLocalJson(name, legacy);
}

export function readJsonStore<T>(name: string, legacyKey: string, fallback: T): T {
  const held = cachedLocalJson<T>(name);
  if (held !== null) return held;
  try {
    const raw = localStorage.getItem(legacyKey);
    const parsed = raw ? (JSON.parse(raw) as T) : null;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
