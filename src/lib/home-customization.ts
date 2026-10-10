import type { HomeRow } from "@/views/home/home-types";
import type { SourceRow } from "./custom-sources";

export type HomeRowCustomization = {
  order: string[];
  hidden: string[];
  renamed: Record<string, string>;
  numerals: string[];
  heroSource: string | null;
  customSources: SourceRow[];
  listRows?: string[];
  playButtonSquare?: boolean;
  secondaryMoreInfo?: boolean;
  cwTop?: boolean;
};

export function applyHomeRowCustomization(
  rows: HomeRow[],
  custom: HomeRowCustomization,
  includeHidden = false,
): HomeRow[] {
  const renamed = rows
    .filter((r) => includeHidden || !custom.hidden.includes(r.key))
    .map((r) => ({
      ...r,
      name: custom.renamed[r.key] ?? r.name,
    }));
  if (custom.order.length === 0) return renamed;
  const byKey = new Map(renamed.map((r) => [r.key, r]));
  const ordered: HomeRow[] = [];
  for (const k of custom.order) {
    const r = byKey.get(k);
    if (r) ordered.push(r);
  }
  const orderedKeys = new Set(custom.order);
  for (const r of renamed) {
    if (!orderedKeys.has(r.key)) ordered.push(r);
  }
  return ordered;
}

export function isRowHidden(custom: HomeRowCustomization, key: string): boolean {
  return custom.hidden.includes(key);
}

export function effectiveOrder(rows: HomeRow[], custom: HomeRowCustomization): string[] {
  const live = rows.map((r) => r.key);
  const liveSet = new Set(live);
  const out: string[] = [];
  for (const k of custom.order) {
    if (liveSet.has(k)) out.push(k);
  }
  const seen = new Set(out);
  for (const k of live) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}

export function moveRow(
  custom: HomeRowCustomization,
  rows: HomeRow[],
  key: string,
  delta: -1 | 1,
): HomeRowCustomization {
  const order = effectiveOrder(rows, custom);
  const idx = order.indexOf(key);
  if (idx < 0) return custom;
  const target = idx + delta;
  if (target < 0 || target >= order.length) return custom;
  const next = order.slice();
  [next[idx], next[target]] = [next[target], next[idx]];
  return { ...custom, order: next };
}

export function toggleRowHidden(custom: HomeRowCustomization, key: string): HomeRowCustomization {
  const has = custom.hidden.includes(key);
  return {
    ...custom,
    hidden: has ? custom.hidden.filter((k) => k !== key) : [...custom.hidden, key],
  };
}

export function renameRow(
  custom: HomeRowCustomization,
  key: string,
  label: string,
): HomeRowCustomization {
  const trimmed = label.trim();
  const renamed = { ...custom.renamed };
  if (!trimmed) {
    delete renamed[key];
  } else {
    renamed[key] = trimmed;
  }
  return { ...custom, renamed };
}

export function toggleRowNumerals(
  custom: HomeRowCustomization,
  key: string,
): HomeRowCustomization {
  const cur = custom.numerals ?? [];
  const has = cur.includes(key);
  return { ...custom, numerals: has ? cur.filter((k) => k !== key) : [...cur, key] };
}

export function toggleHeroSource(
  custom: HomeRowCustomization,
  key: string,
): HomeRowCustomization {
  return { ...custom, heroSource: custom.heroSource === key ? null : key };
}

export function togglePlayButtonSquare(custom: HomeRowCustomization): HomeRowCustomization {
  return { ...custom, playButtonSquare: !custom.playButtonSquare };
}

export function toggleSecondaryMoreInfo(custom: HomeRowCustomization): HomeRowCustomization {
  return { ...custom, secondaryMoreInfo: !custom.secondaryMoreInfo };
}

export function toggleCwTop(custom: HomeRowCustomization): HomeRowCustomization {
  return { ...custom, cwTop: !custom.cwTop };
}

export function addListRow(custom: HomeRowCustomization, listId: string): HomeRowCustomization {
  const cur = custom.listRows ?? [];
  if (cur.includes(listId)) return custom;
  return { ...custom, listRows: [...cur, listId] };
}

export function removeListRow(custom: HomeRowCustomization, listId: string): HomeRowCustomization {
  const cur = custom.listRows ?? [];
  return { ...custom, listRows: cur.filter((id) => id !== listId) };
}

export function resetHomeRows(): HomeRowCustomization {
  return { order: [], hidden: [], renamed: {}, numerals: [], heroSource: null, customSources: [], listRows: [], playButtonSquare: false, secondaryMoreInfo: false, cwTop: false };
}
