const listeners = new Set<(handle: string) => void>();

let pendingEditHandle: string | null = null;

export function requestOpenProfile(handle: string): void {
  const h = handle.trim().toLowerCase();
  if (!h) return;
  for (const l of listeners) l(h);
}

export function subscribeOpenProfile(cb: (handle: string) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function requestEditProfile(handle: string): void {
  const h = handle.trim().toLowerCase();
  if (!h) return;
  pendingEditHandle = h;
  requestOpenProfile(h);
}

export function consumeProfileEditIntent(handle: string): boolean {
  const h = handle.trim().toLowerCase();
  if (pendingEditHandle && pendingEditHandle === h) {
    pendingEditHandle = null;
    return true;
  }
  return false;
}
