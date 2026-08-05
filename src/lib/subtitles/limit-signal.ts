const limited = new Set<string>();

export function markLimitReached(url: string): void {
  limited.add(url);
}

export function wasLimitReached(url: string): boolean {
  return limited.has(url);
}
