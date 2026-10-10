export type MetadataEntry = { at: number; data: unknown };
type EntryIndex = { key: string; used: number; bytes: number };
const DATABASE = "harbor-game-metadata-v1";
const MAX_RECORDS = 180, MAX_BYTES = 12 * 1024 * 1024, MAX_ENTRY = 512 * 1024;
let connection: Promise<IDBDatabase | null> | undefined;

function open(): Promise<IDBDatabase | null> {
  try { if (typeof indexedDB === "undefined") return Promise.resolve(null); }
  catch { return Promise.resolve(null); }
  if (connection) return connection;
  connection = new Promise(resolve => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => { if (settled) { db?.close(); return; } settled = true; clearTimeout(timer); resolve(db); };
    const timer = setTimeout(() => finish(null), 650);
    try {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore("entries"); request.result.createObjectStore("index", { keyPath: "key" }); };
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); connection = undefined; }; finish(db); };
    } catch { finish(null); }
  });
  return connection;
}

export const metadataStore = {
  async read(key: string): Promise<MetadataEntry | null> {
    const db = await open();
    if (!db) return null;
    return new Promise(resolve => {
      let done = false;
      const finish = (value: MetadataEntry | null) => { if (done) return; done = true; clearTimeout(timer); resolve(value); };
      const timer = setTimeout(() => finish(null), 650);
      try {
        const tx = db.transaction(["entries", "index"], "readwrite"), request = tx.objectStore("entries").get(key);
        request.onsuccess = () => {
          const entry = request.result as MetadataEntry | undefined;
          if (entry) { const index = tx.objectStore("index"), lookup = index.get(key); lookup.onsuccess = () => { if (lookup.result) index.put({ ...lookup.result, used: Date.now() }); }; }
          finish(entry ?? null);
        };
        tx.onerror = tx.onabort = () => finish(null);
      } catch { finish(null); }
    });
  },
  async write(key: string, entry: MetadataEntry): Promise<void> {
    let bytes: number;
    try { bytes = new TextEncoder().encode(JSON.stringify(entry.data)).byteLength; } catch { return; }
    if (bytes > MAX_ENTRY || key.length > 2500) return;
    const db = await open();
    if (!db) return;
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 1000);
      const finish = () => { clearTimeout(timer); resolve(); };
      try {
        const tx = db.transaction(["entries", "index"], "readwrite"), index = tx.objectStore("index"), entries = tx.objectStore("entries");
        entries.put(entry, key); index.put({ key, used: Date.now(), bytes });
        const request = index.getAll();
        request.onsuccess = () => {
          const values = (request.result as EntryIndex[]).sort((a, b) => a.used - b.used);
          let count = values.length, size = values.reduce((sum, item) => sum + item.bytes, 0);
          for (const item of values) {
            if (count <= MAX_RECORDS && size <= MAX_BYTES) break;
            entries.delete(item.key); index.delete(item.key); count--; size -= item.bytes;
          }
        };
        tx.oncomplete = tx.onabort = tx.onerror = finish;
      } catch { finish(); }
    });
  },
};
