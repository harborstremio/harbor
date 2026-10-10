export function resolveMalRequestUrl(base: string, path: string): string {
  return path.startsWith(base) ? path : `${base}${path}`;
}
