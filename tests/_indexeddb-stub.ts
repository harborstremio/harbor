type Handler = (() => void) | null;

class FakeRequest<T> {
  result: T | undefined;
  error: unknown = null;
  onsuccess: Handler = null;
  onerror: Handler = null;

  succeed(result: T): void {
    this.result = result;
    queueMicrotask(() => this.onsuccess?.());
  }
}

class FakeObjectStore {
  data: Map<string, unknown>;

  constructor(data: Map<string, unknown>) {
    this.data = data;
  }

  get(key: string): FakeRequest<unknown> {
    const req = new FakeRequest<unknown>();
    req.succeed(this.data.get(key));
    return req;
  }

  put(value: unknown, key: string): FakeRequest<string> {
    const req = new FakeRequest<string>();
    this.data.set(key, value);
    req.succeed(key);
    return req;
  }

  delete(key: string): FakeRequest<undefined> {
    const req = new FakeRequest<undefined>();
    this.data.delete(key);
    req.succeed(undefined);
    return req;
  }
}

class FakeTransaction {
  stores: Map<string, Map<string, unknown>>;
  onerror: Handler = null;
  onabort: Handler = null;
  oncomplete: Handler = null;

  constructor(stores: Map<string, Map<string, unknown>>) {
    this.stores = stores;
    queueMicrotask(() => this.oncomplete?.());
  }

  objectStore(name: string): FakeObjectStore {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map();
      this.stores.set(name, store);
    }
    return new FakeObjectStore(store);
  }
}

class FakeDatabase {
  stores = new Map<string, Map<string, unknown>>();
  objectStoreNames = { contains: (name: string) => this.stores.has(name) };

  createObjectStore(name: string): void {
    this.stores.set(name, new Map());
  }

  transaction(_storeNames: string | string[], _mode: string): FakeTransaction {
    return new FakeTransaction(this.stores);
  }
}

class FakeOpenRequest {
  result: FakeDatabase | undefined;
  onupgradeneeded: Handler = null;
  onsuccess: Handler = null;
  onerror: Handler = null;
  onblocked: Handler = null;
}

let sharedDb: FakeDatabase | null = null;

function open(_name: string, _version: number): FakeOpenRequest {
  const req = new FakeOpenRequest();
  queueMicrotask(() => {
    const isNew = !sharedDb;
    sharedDb ??= new FakeDatabase();
    req.result = sharedDb;
    if (isNew) req.onupgradeneeded?.();
    req.onsuccess?.();
  });
  return req;
}

(globalThis as { indexedDB?: unknown }).indexedDB ??= { open };

export {};
