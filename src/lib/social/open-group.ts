const listeners = new Set<(id: string) => void>();

export function requestOpenGroup(id: string): void {
  const g = id.trim();
  if (!g) return;
  for (const l of listeners) l(g);
}

export function subscribeOpenGroup(cb: (id: string) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
