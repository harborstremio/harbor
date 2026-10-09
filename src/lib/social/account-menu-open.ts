export type AccountMenuAnchor = { bottom: number; right: number } | null;

const listeners = new Set<(anchor: AccountMenuAnchor) => void>();

export function openAccountMenu(anchor: AccountMenuAnchor = null): void {
  for (const l of listeners) l(anchor);
}

export function subscribeAccountMenuOpen(cb: (anchor: AccountMenuAnchor) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function anchorFromElement(el: unknown): AccountMenuAnchor {
  if (!el || typeof (el as Element).getBoundingClientRect !== "function") return null;
  const r = (el as Element).getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { bottom: r.bottom, right: r.right };
}
