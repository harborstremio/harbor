import { useCallback, useState } from "react";

export type PageRowCustomization = {
  order: string[];
  hidden: string[];
  renamed: Record<string, string>;
};

const EMPTY: PageRowCustomization = { order: [], hidden: [], renamed: {} };
const keyFor = (page: string) => `harbor.pageRows.${page}`;

export function loadPageRows(page: string): PageRowCustomization {
  try {
    const raw = localStorage.getItem(keyFor(page));
    if (!raw) return EMPTY;
    const p = JSON.parse(raw);
    return {
      order: Array.isArray(p.order) ? p.order : [],
      hidden: Array.isArray(p.hidden) ? p.hidden : [],
      renamed: p.renamed && typeof p.renamed === "object" ? p.renamed : {},
    };
  } catch {
    return EMPTY;
  }
}

export function savePageRows(page: string, c: PageRowCustomization): void {
  try {
    localStorage.setItem(keyFor(page), JSON.stringify(c));
  } catch {
    void 0;
  }
}

export function orderedRowKeys(available: string[], c: PageRowCustomization): string[] {
  const set = new Set(available);
  const out: string[] = [];
  for (const k of c.order) if (set.has(k)) out.push(k);
  const seen = new Set(out);
  for (const k of available) if (!seen.has(k)) out.push(k);
  return out;
}

export function movePageRow(
  c: PageRowCustomization,
  available: string[],
  key: string,
  delta: -1 | 1,
): PageRowCustomization {
  const order = orderedRowKeys(available, c);
  const i = order.indexOf(key);
  if (i < 0) return c;
  const j = i + delta;
  if (j < 0 || j >= order.length) return c;
  const next = order.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return { ...c, order: next };
}

export function togglePageRowHidden(c: PageRowCustomization, key: string): PageRowCustomization {
  const has = c.hidden.includes(key);
  return { ...c, hidden: has ? c.hidden.filter((k) => k !== key) : [...c.hidden, key] };
}

export function renamePageRow(c: PageRowCustomization, key: string, label: string): PageRowCustomization {
  const trimmed = label.trim();
  const renamed = { ...c.renamed };
  if (!trimmed) delete renamed[key];
  else renamed[key] = trimmed;
  return { ...c, renamed };
}

export function resetPageRows(): PageRowCustomization {
  return { order: [], hidden: [], renamed: {} };
}

export function hasPageRowChanges(c: PageRowCustomization): boolean {
  return c.order.length > 0 || c.hidden.length > 0 || Object.keys(c.renamed).length > 0;
}

export function applyPageRows<T extends { key: string; title: string }>(
  rows: T[],
  c: PageRowCustomization,
  includeHidden: boolean,
): T[] {
  const renamed = rows
    .filter((r) => includeHidden || !c.hidden.includes(r.key))
    .map((r) => ({ ...r, title: c.renamed[r.key] ?? r.title }));
  if (c.order.length === 0) return renamed;
  const byKey = new Map(renamed.map((r) => [r.key, r]));
  const ordered: T[] = [];
  for (const k of c.order) {
    const r = byKey.get(k);
    if (r) ordered.push(r);
  }
  const orderedSet = new Set(c.order);
  for (const r of renamed) if (!orderedSet.has(r.key)) ordered.push(r);
  return ordered;
}

export function usePageRows(page: string) {
  const [custom, setCustom] = useState<PageRowCustomization>(() => loadPageRows(page));
  const [editMode, setEditMode] = useState(false);
  const persist = useCallback(
    (next: PageRowCustomization) => {
      setCustom(next);
      savePageRows(page, next);
    },
    [page],
  );
  return { custom, editMode, setEditMode, persist };
}
