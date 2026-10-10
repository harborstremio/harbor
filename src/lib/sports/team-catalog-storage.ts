const DATABASE = "harbor-sports-teams";
const STORE = "catalog";
let connection: Promise<IDBDatabase | null> | undefined;

function open(): Promise<IDBDatabase | null> {
  if (connection) return connection;
  connection = new Promise((resolve) => {
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

export async function readTeamCatalogDisk(): Promise<string | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(typeof value === "string" && value.length <= 1_000_000 ? value : null);
    };
    const timer = setTimeout(() => finish(null), 1500);
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get("teams");
      request.onsuccess = () => finish(request.result);
      request.onerror = () => finish(null);
    } catch {
      finish(null);
    }
  });
}

export async function writeTeamCatalogDisk(json: string): Promise<void> {
  if (json.length > 1_000_000) return;
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    let transaction: IDBTransaction | undefined;
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      try {
        transaction?.abort();
      } catch {}
      finish();
    }, 1500);
    try {
      transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(json, "teams");
      transaction.oncomplete = transaction.onerror = transaction.onabort = finish;
    } catch {
      finish();
    }
  });
}
