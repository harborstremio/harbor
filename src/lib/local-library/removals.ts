const KEY = "harbor.library.local.removed.v1";

/** Windows scan paths are case-insensitive; keep Unix paths case-sensitive. */
export function localPathKey(path: string): string {
  return /^(?:[a-z]:[\\/]|\\\\)/i.test(path)
    ? path.replace(/\\/g, "/").toLowerCase()
    : path;
}

export function removedLocalPaths(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(
      Array.isArray(value)
        ? value.filter((path): path is string => typeof path === "string").map(localPathKey)
        : [],
    );
  } catch {
    return new Set();
  }
}

function save(paths: Set<string>): void {
  try {
    if (paths.size) localStorage.setItem(KEY, JSON.stringify([...paths]));
    else localStorage.removeItem(KEY);
  } catch (error) {
    console.error("[local-library] could not persist removed paths", error);
  }
}

export function rememberLocalRemovals(paths: string[]): void {
  if (!paths.length) return;
  const removed = removedLocalPaths();
  for (const path of paths) removed.add(localPathKey(path));
  save(removed);
}

export function restoreLocalPaths(paths: string[]): void {
  if (!paths.length) return;
  const removed = removedLocalPaths();
  for (const path of paths) removed.delete(localPathKey(path));
  save(removed);
}

export function clearLocalRemovals(): void {
  save(new Set());
}
