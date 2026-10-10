import type { BrowseCatalog } from "@/lib/catalog-browse";

/** What the user has arranged, as a preference over what the plugins reported.
 *
 * An empty order is the absence of a preference, not an order in itself: a tab that has never been
 * arranged lists plugins and rows in the order they arrived, which is what it did before this
 * existed. That is why the stored lists hold only what was moved, and why a row or plugin that was
 * never mentioned is simply left where it was found. */
export type SectionOrder = {
  /** Plugin names, in the order the user put them. */
  plugins: string[];
  /** Row keys per plugin, in the order the user put them. */
  rows: Record<string, string[]>;
  /** Row keys the user turned off. */
  hidden: string[];
};

export const EMPTY_ORDER: SectionOrder = { plugins: [], rows: {}, hidden: [] };

/** The plugins tab's own storage key, versioned so a shape change cannot read an old one. */
export const ORDER_KEY = "harbor.plugins.order.v1";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

function storageOrNull(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Storage throws rather than returning null when a browser refuses it, which is a page setting
    // rather than a fault. An arrangement that cannot be kept is still worth making for this visit.
    return null;
  }
}

/** What has been arranged, or nothing. Junk in storage reads as nothing rather than as a fault:
 * a half-written value is not worth losing the tab over, and the arrangement can be redone. */
export function readOrder(store: Storage | null = storageOrNull()): SectionOrder {
  if (!store) return EMPTY_ORDER;
  let parsed: unknown;
  try {
    const raw = store.getItem(ORDER_KEY);
    if (!raw) return EMPTY_ORDER;
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_ORDER;
  }
  if (!parsed || typeof parsed !== "object") return EMPTY_ORDER;
  const value = parsed as Partial<SectionOrder>;
  const plugins = strings(value.plugins);
  const hidden = strings(value.hidden);
  const rows: Record<string, string[]> = {};
  if (value.rows && typeof value.rows === "object") {
    for (const [plugin, list] of Object.entries(value.rows)) {
      const keys = strings(list);
      if (keys.length) rows[plugin] = keys;
    }
  }
  return { plugins, rows, hidden };
}

export function writeOrder(order: SectionOrder, store: Storage | null = storageOrNull()): void {
  try {
    store?.setItem(ORDER_KEY, JSON.stringify(order));
  } catch {
    // A full or refused store means the arrangement holds for this visit only, which is better than
    // losing the tab to an error the user cannot act on.
  }
}

export function clearOrder(store: Storage | null = storageOrNull()): void {
  try {
    store?.removeItem(ORDER_KEY);
  } catch {
    // As above: nothing to do about a store that refuses.
  }
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/** The plugins and their rows as the tab should show them: arranged where the user arranged them,
 * untouched where they did not, and without the rows they turned off.
 *
 * Everything the arrangement does not mention still has to appear. A plugin that adds a row after
 * the user arranged the tab, or a row that comes back after being hidden once, is not in the stored
 * lists and would be dropped if only the stored lists were drawn — so unmentioned entries keep the
 * order they arrived in, at the end of their group. Stored entries that no longer exist are the
 * opposite: they are dropped, because a name for a row that is gone orders nothing. */
export function arrange(
  groups: [string, BrowseCatalog[]][],
  order: SectionOrder,
): [string, BrowseCatalog[]][] {
  const hidden = new Set(order.hidden);
  const withRows = groups.map(([plugin, rows]) => {
    const wanted = order.rows[plugin] ?? [];
    const byKey = new Map(rows.map((row) => [row.key, row]));
    const placed = wanted.filter((key) => byKey.has(key)).map((key) => byKey.get(key)!);
    const rest = rows.filter((row) => !wanted.includes(row.key));
    return [plugin, [...placed, ...rest].filter((row) => !hidden.has(row.key))] as [
      string,
      BrowseCatalog[],
    ];
  });
  const byPlugin = new Map(withRows);
  // A map hands back the value, which here is the rows rather than the pair, so the name is put
  // back on to make another pair. A name the arrangement holds that is not installed is left out
  // rather than turned into a pair with nothing in it.
  const placed = order.plugins
    .map((name) => [name, byPlugin.get(name)] as const)
    .filter((entry): entry is [string, BrowseCatalog[]] => entry[1] !== undefined);
  const rest = withRows.filter(([name]) => !order.plugins.includes(name));
  return [...placed, ...rest].filter(([, rows]) => rows.length > 0);
}

/** The groups one view of the tab shows. A null filter is the page with every plugin on it.
 *
 * An arrangement is a statement about how the plugins sit against each other, so it is only applied
 * to that page. One plugin on its own has nothing to be interleaved with, so its rows are listed
 * exactly as it reports them — including the ones an arrangement turned off, which is why the panel
 * says out loud that it arranges the All plugins page and not this one. */
export function forFilter(
  groups: [string, BrowseCatalog[]][],
  filter: string | null,
  order: SectionOrder,
): [string, BrowseCatalog[]][] {
  if (filter === null) return arrange(groups, order);
  return groups.filter(([plugin]) => plugin === filter);
}

/** One step of a reorder, held at the ends rather than wrapping: a row that jumped from last to
 * first would be a surprise, and on a remote there is no drag to make the intent visible first. */
export function move<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (index < 0 || to < 0 || to >= list.length) return list;
  const out = [...list];
  const [item] = out.splice(index, 1);
  out.splice(to, 0, item);
  return out;
}

/** An arrangement moved by one step, with the rows a plugin now shows. Written as a whole so a
 * hidden row stays hidden through a reorder, which is what moving something implies about it. */
export function withMove(
  order: SectionOrder,
  groups: [string, BrowseCatalog[]][],
  plugin: string,
  rowKey: string | null,
  delta: number,
): SectionOrder {
  if (rowKey === null) {
    const names = groups.map(([name]) => name);
    return { ...order, plugins: move(names, names.indexOf(plugin), delta) };
  }
  const rows = groups.find(([name]) => name === plugin)?.[1] ?? [];
  const keys = order.rows[plugin]?.length ? order.rows[plugin] : rows.map((r) => r.key);
  return { ...order, rows: { ...order.rows, [plugin]: move(keys, keys.indexOf(rowKey), delta) } };
}

/** A row turned off, or back on. Named by key, so turning one off does not disturb the order of
 * the rest — which is what makes it reversible without redoing the arrangement. */
export function withHidden(
  order: SectionOrder,
  rowKey: string,
  hidden: boolean,
): SectionOrder {
  const without = order.hidden.filter((key) => key !== rowKey);
  return hidden ? { ...order, hidden: [...without, rowKey] } : { ...order, hidden: without };
}
