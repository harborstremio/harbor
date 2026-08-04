function comparablePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (normalized === "/") return normalized;
  return normalized.replace(/\/$/, "");
}

export function isExpectedChapterDir(actualDir: string, expectedDir: string): boolean {
  return comparablePath(actualDir) === comparablePath(expectedDir);
}
