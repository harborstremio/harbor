const endedIds = new Set<string>();

export function getHeroEnded(id: string): boolean {
  return endedIds.has(id);
}

export function setHeroEnded(id: string, value: boolean): void {
  if (value) endedIds.add(id);
  else endedIds.delete(id);
}
