const DB_NAME = "harbor-theme";
const DB_VERSION = 1;
const STORE = "kv";
const BG_KEY = "bg";
const LEGACY_LOCALSTORAGE_KEY = "harbor.theme.bg";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function bgKey(profileId?: string): string {
  return profileId ? `bg_${profileId}` : BG_KEY;
}

export async function loadBgImage(profileId?: string): Promise<string | null> {
  const db = await openDB();
  if (!db) return readLegacy();
  const key = bgKey(profileId);
  try {
    const scoped = await themeKvGet(key);
    if (scoped) return scoped;

    // A profile with no image of its own yet: adopt the pre-profile-scoping
    // global background exactly once, then retire the global key.
    if (profileId) {
      const globalLegacy = await themeKvGet(BG_KEY);
      if (globalLegacy) {
        await themeKvPut(key, globalLegacy);
        await themeKvDelete(BG_KEY);
        return globalLegacy;
      }
    }

    const legacy = readLegacy();
    if (legacy) {
      await themeKvPut(key, legacy);
      try {
        localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
      } catch {
        /* ignore */
      }
      return legacy;
    }
    return null;
  } catch {
    return readLegacy();
  }
}

export async function saveBgImage(data: string | null, profileId?: string): Promise<boolean> {
  const key = bgKey(profileId);
  if (data == null) return themeKvDelete(key);
  return themeKvPut(key, data);
}

export async function deleteProfileBgImage(profileId: string): Promise<boolean> {
  return themeKvDelete(bgKey(profileId));
}

export async function themeKvGet(key: string): Promise<string | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function themeKvPut(key: string, value: string): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function themeKvDelete(key: string): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function readLegacy(): string | null {
  try {
    return localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
  } catch {
    return null;
  }
}

const PICKER_BG_KEY = "bg_picker";
const PICKER_DIM_KEY = "bg_picker_dim";

export async function loadPickerBg(): Promise<{ image: string | null; dim: number }> {
  const [image, dim] = await Promise.all([
    themeKvGet(PICKER_BG_KEY).catch(() => null),
    themeKvGet(PICKER_DIM_KEY).catch(() => null),
  ]);
  const parsed = dim === null ? NaN : Number(dim);
  if (!Number.isFinite(parsed)) return { image, dim: 55 };
  // Current sliders store whole percentages: a saved 1 must remain 1%, not 100%.
  const pct = parsed > 0 && parsed < 1 ? parsed * 100 : parsed;
  return { image, dim: Math.min(100, Math.max(0, Math.round(pct))) };
}

export async function savePickerBg(data: string | null): Promise<boolean> {
  if (data == null) return themeKvDelete(PICKER_BG_KEY);
  return themeKvPut(PICKER_BG_KEY, data);
}

export async function savePickerBgDim(dim: number): Promise<boolean> {
  return themeKvPut(PICKER_DIM_KEY, String(dim));
}
