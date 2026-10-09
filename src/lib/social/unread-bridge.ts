let unread = 0;
const listeners = new Set<(count: number) => void>();

export function setUnreadCount(count: number): void {
  const next = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (next === unread) return;
  unread = next;
  for (const l of listeners) l(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("harbor:unread", { detail: { count: next } }));
  }
}

export function getUnreadCount(): number {
  return unread;
}

export function subscribeUnread(cb: (count: number) => void): () => void {
  listeners.add(cb);
  cb(unread);
  return () => {
    listeners.delete(cb);
  };
}
