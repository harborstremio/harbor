export type LibrarySelectionChange = { pinned?: boolean; hidden?: boolean };
export type LibrarySelectionOutcome = boolean | { completed: string[] };

/** Range selection follows the current visible order, without selecting filtered-out games. */
export function toggleLibrarySelection(selected: string[], order: string[], id: string, anchor: string | null, extend: boolean) {
  if (!order.includes(id)) return selected;
  const allowed = new Set(order), next = new Set(selected.filter(value => allowed.has(value)));
  const from = anchor ? order.indexOf(anchor) : -1, to = order.indexOf(id);
  if (extend && from >= 0) {
    for (const value of order.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(value);
  } else if (next.has(id)) next.delete(id); else next.add(id);
  return [...next];
}
