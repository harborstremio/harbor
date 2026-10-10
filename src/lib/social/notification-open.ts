const listeners = new Set<() => void>();

export function openNotificationCenter(): void {
  for (const l of listeners) l();
}

export function subscribeNotificationOpen(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
