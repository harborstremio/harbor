/** Small decoration metadata has its own quota, independent of large app/localStorage caches. */
const DATABASE = "harbor-sports-artwork",
  STORE = "metadata";
const KEYS = new Set([
  "harbor.sports.featured-artwork.v1",
  "harbor.sports.athlete-portraits.v1",
  "harbor.sports.board-snapshot.v1",
  "harbor:sports:youtube-feeds:v1",
  "harbor.manga-adaptations.v1",
]);
const limit = (key: string) =>
  key === "harbor.sports.board-snapshot.v1"
    ? 12000000
    : key === "harbor:sports:youtube-feeds:v1"
      ? 1000000
      : 400000;
let connection: Promise<IDBDatabase | null> | undefined;
function open() {
  if (connection) return connection;
  connection = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) {
        db?.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(db);
    };
    const timer = setTimeout(() => finish(null), 1500);
    try {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          connection = undefined;
        };
        finish(request.result);
      };
      request.onerror = request.onblocked = () => finish(null);
    } catch {
      finish(null);
    }
  });
  return connection;
}

export async function getSportsMetadata(key: string): Promise<unknown | null> {
  if (!KEYS.has(key)) return null;
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 1500);
    const finish = (value: unknown) => {
      clearTimeout(timer);
      resolve(value ?? null);
    };
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => finish(request.result);
      request.onerror = () => finish(null);
    } catch {
      finish(null);
    }
  });
}

export async function putSportsMetadata(key: string, value: unknown): Promise<void> {
  if (!KEYS.has(key) || (typeof value === "string" && value.length > limit(key))) return;
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 1500);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    try {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(value, key);
      transaction.oncomplete = transaction.onerror = transaction.onabort = finish;
    } catch {
      finish();
    }
  });
}

export async function readArtworkMetadata(key: string): Promise<string | null> {
  const value = await getSportsMetadata(key);
  return typeof value === "string" && value.length <= limit(key) ? value : null;
}
export async function writeArtworkMetadata(key: string, value: string): Promise<void> {
  await putSportsMetadata(key, value);
}
