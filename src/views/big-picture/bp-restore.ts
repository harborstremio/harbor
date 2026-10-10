export type BpPosition = { key: string; scrollTop: number };

const positions = new Map<string, BpPosition>();

// Route entry restores one cell for the whole page; entering a row from above
// restores that row's own cell. Two memories, deliberately separate.
const rowPositions = new Map<string, string>();

// data-bp-rail-row is a positional index that renumbers the moment the live row
// appears or CW empties, so it can never key a memory. The row's own rowKey can.
const rowSlot = (routeKey: string, rowKey: string): string => `${routeKey}\u0000${rowKey}`;

export function rememberBpPosition(routeKey: string, position: BpPosition): void {
  if (!routeKey || !position.key) return;
  positions.set(routeKey, position);
}

export function readBpPosition(routeKey: string): BpPosition | null {
  return positions.get(routeKey) ?? null;
}

export function forgetBpPosition(routeKey: string): void {
  positions.delete(routeKey);
}

export function rememberBpRowPosition(routeKey: string, rowKey: string, cellKey: string): void {
  if (!routeKey || !rowKey || !cellKey) return;
  rowPositions.set(rowSlot(routeKey, rowKey), cellKey);
}

export function readBpRowPosition(routeKey: string, rowKey: string): string | null {
  if (!routeKey || !rowKey) return null;
  return rowPositions.get(rowSlot(routeKey, rowKey)) ?? null;
}

export function forgetBpRowPosition(routeKey: string, rowKey: string): void {
  rowPositions.delete(rowSlot(routeKey, rowKey));
}

export function clearBpPositions(): void {
  positions.clear();
  rowPositions.clear();
}

export function restoreKeyOf(el: Element | null): string {
  return el instanceof HTMLElement ? (el.dataset.bpRestoreKey ?? "") : "";
}

export function rowKeyOf(el: Element | null): string {
  if (!(el instanceof HTMLElement)) return "";
  return el.closest<HTMLElement>("[data-bp-row]")?.dataset.bpRowKey ?? "";
}

export function scrollerOf(el: Element | null): HTMLElement | null {
  return el instanceof HTMLElement ? el.closest<HTMLElement>("[data-bp-scroll-y]") : null;
}
