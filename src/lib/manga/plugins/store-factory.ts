const PLUGIN_STORE = "plugins";
const REPO_STORE = "repos";
const VERSION = 1;

type WithId = { id: string };
type WithUrl = { url: string };

export type PluginStoreApi<P extends WithId, R extends WithUrl> = {
  subscribe: (cb: () => void) => () => void;
  pluginsSync: () => P[];
  loadPlugins: () => Promise<P[]>;
  savePlugin: (p: P) => Promise<void>;
  deletePlugin: (id: string) => Promise<void>;
  loadRepos: () => Promise<R[]>;
  saveRepo: (r: R) => Promise<void>;
  deleteRepo: (url: string) => Promise<void>;
};

export function createPluginStore<P extends WithId, R extends WithUrl = WithUrl>(
  dbName: string,
): PluginStoreApi<P, R> {
  let dbPromise: Promise<IDBDatabase> | null = null;
  let cache: P[] | null = null;
  const listeners = new Set<() => void>();

  function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PLUGIN_STORE)) {
          db.createObjectStore(PLUGIN_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(REPO_STORE)) {
          db.createObjectStore(REPO_STORE, { keyPath: "url" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function notify(): void {
    for (const l of listeners) l();
  }

  function pluginsSync(): P[] {
    return cache ?? [];
  }

  async function readAll<T>(storeName: string): Promise<T[]> {
    const db = await openDb();
    return new Promise<T[]>((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as T[]) : []);
      req.onerror = () => resolve([]);
    });
  }

  async function put(storeName: string, value: unknown): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function remove(storeName: string, key: string): Promise<void> {
    try {
      const db = await openDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      /* ignore */
    }
  }

  return {
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    pluginsSync,
    async loadPlugins() {
      try {
        const list = await readAll<P>(PLUGIN_STORE);
        cache = list;
        notify();
        return list;
      } catch {
        cache = [];
        return [];
      }
    },
    async savePlugin(p) {
      await put(PLUGIN_STORE, p);
      cache = [...pluginsSync().filter((x) => x.id !== p.id), p];
      notify();
    },
    async deletePlugin(id) {
      await remove(PLUGIN_STORE, id);
      cache = pluginsSync().filter((x) => x.id !== id);
      notify();
    },
    async loadRepos() {
      try {
        return await readAll<R>(REPO_STORE);
      } catch {
        return [];
      }
    },
    saveRepo(r) {
      return put(REPO_STORE, r);
    },
    deleteRepo(url) {
      return remove(REPO_STORE, url);
    },
  };
}
