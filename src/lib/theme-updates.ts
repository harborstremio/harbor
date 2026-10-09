const KEY = "harbor.theme-downloads.v1";

export type DownloadRec = { storeId: string; version: number; name: string };
type RecMap = Record<string, DownloadRec>;

function read(): RecMap {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" ? (v as RecMap) : {};
  } catch {
    return {};
  }
}

function write(m: RecMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function recordDownloadedTheme(savedId: string, storeId: string, version: number, name: string): void {
  if (!savedId || !storeId) return;
  const m = read();
  m[savedId] = { storeId, version: version || 0, name };
  write(m);
}

export function getDownloadRecords(): RecMap {
  return read();
}

export function markStoreThemeUpdated(storeId: string, version: number): void {
  if (!storeId) return;
  const m = read();
  let touched = false;
  for (const savedId of Object.keys(m)) {
    const rec = m[savedId];
    if (rec.storeId === storeId && rec.version < version) {
      m[savedId] = { ...rec, version };
      touched = true;
    }
  }
  if (touched) write(m);
}

export function forgetDownloadedTheme(savedId: string): void {
  const m = read();
  if (m[savedId]) {
    delete m[savedId];
    write(m);
  }
}
