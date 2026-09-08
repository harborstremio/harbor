export type PageContextRefresh = {
  id: string;
  page: string;
  label: string;
  active: boolean;
  busy?: boolean;
  run: () => void | Promise<void>;
};

const registrations = new Map<symbol, () => PageContextRefresh>();
const listeners = new Set<() => void>();
const running = new Set<string>();
let revision = 0;

export function notifyPageContextRefresh(): void {
  revision++;
  listeners.forEach((listener) => listener());
}

export function subscribePageContextRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function pageContextRevision(): number {
  return revision;
}

export function registerPageContextRefresh(read: () => PageContextRefresh): () => void {
  const token = Symbol();
  registrations.set(token, read);
  notifyPageContextRefresh();
  return () => {
    registrations.delete(token);
    notifyPageContextRefresh();
  };
}

export function getPageContextRefresh(page: string): PageContextRefresh | null {
  const current = [...registrations.values()]
    .map((read) => read())
    .filter((entry) => entry.active && entry.page === page);
  return current.at(-1) ?? null;
}

export async function runPageContextRefresh(page: string, id: string): Promise<void> {
  const current = getPageContextRefresh(page);
  if (!current || current.id !== id) throw new Error("This page refresh is no longer available.");
  if (current.busy || running.has(id)) throw new Error("This page is already refreshing.");
  running.add(id);
  notifyPageContextRefresh();
  try {
    await current.run();
  } finally {
    running.delete(id);
    notifyPageContextRefresh();
  }
}
