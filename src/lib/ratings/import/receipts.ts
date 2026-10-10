const KEY = "harbor.ratings.imports.v1";
const KEEP = 10;
const SLACK_MS = 5000;

export type ImportReceipt = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  count: number;
  startedAt: number;
  finishedAt: number;
};

const subs = new Set<() => void>();

function read(): ImportReceipt[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) =>
        r &&
        typeof r.id === "string" &&
        typeof r.sourceId === "string" &&
        typeof r.count === "number" &&
        typeof r.startedAt === "number" &&
        typeof r.finishedAt === "number",
    );
  } catch {
    return [];
  }
}

function write(list: ImportReceipt[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, KEEP)));
  } catch {
    return;
  }
  for (const s of subs) s();
}

export function listImports(): ImportReceipt[] {
  return read().sort((a, b) => b.finishedAt - a.finishedAt);
}

export function subscribeImports(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function recordImport(r: Omit<ImportReceipt, "id">): ImportReceipt {
  const receipt: ImportReceipt = { ...r, id: `${r.sourceId}-${r.finishedAt}` };
  write([receipt, ...read().filter((x) => x.id !== receipt.id)]);
  return receipt;
}

export function wasImported(at: number, receipts: ImportReceipt[]): boolean {
  for (const r of receipts) {
    if (at >= r.startedAt - SLACK_MS && at <= r.finishedAt + SLACK_MS) return true;
  }
  return false;
}
