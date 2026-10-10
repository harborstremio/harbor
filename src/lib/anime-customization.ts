export type AnimeRowCustomization = {
  order: string[];
  hidden: string[];
  renamed: Record<string, string>;
};

export const EMPTY_ANIME_ROWS: AnimeRowCustomization = { order: [], hidden: [], renamed: {} };

export function applyAnimeRowCustomization<T extends { key: string; name: string }>(
  rows: T[],
  custom: AnimeRowCustomization,
  includeHidden = false,
): T[] {
  const renamed = rows
    .filter((r) => includeHidden || !custom.hidden.includes(r.key))
    .map((r) => ({ ...r, name: custom.renamed[r.key] ?? r.name }));
  if (custom.order.length === 0) return renamed;
  const byKey = new Map(renamed.map((r) => [r.key, r]));
  const ordered: T[] = [];
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

export function animeEffectiveOrder<T extends { key: string }>(
  rows: T[],
  custom: AnimeRowCustomization,
): string[] {
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

export function animeMoveRow<T extends { key: string }>(
  custom: AnimeRowCustomization,
  rows: T[],
  key: string,
  delta: -1 | 1,
): AnimeRowCustomization {
  const order = animeEffectiveOrder(rows, custom);
  const idx = order.indexOf(key);
  if (idx < 0) return custom;
  const target = idx + delta;
  if (target < 0 || target >= order.length) return custom;
  const next = order.slice();
  [next[idx], next[target]] = [next[target], next[idx]];
  return { ...custom, order: next };
}

export function animeToggleHidden(custom: AnimeRowCustomization, key: string): AnimeRowCustomization {
  const has = custom.hidden.includes(key);
  return {
    ...custom,
    hidden: has ? custom.hidden.filter((k) => k !== key) : [...custom.hidden, key],
  };
}

export function animeRenameRow(
  custom: AnimeRowCustomization,
  key: string,
  label: string,
): AnimeRowCustomization {
  const trimmed = label.trim();
  const renamed = { ...custom.renamed };
  if (!trimmed) delete renamed[key];
  else renamed[key] = trimmed;
  return { ...custom, renamed };
}

export function animeHasCustomization(custom: AnimeRowCustomization): boolean {
  return (
    custom.order.length > 0 ||
    custom.hidden.length > 0 ||
    Object.keys(custom.renamed).length > 0
  );
}
