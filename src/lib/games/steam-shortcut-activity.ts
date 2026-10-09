export const SHORTCUT_ACTIVITY_LIMIT = 300;
const MAX_STORED = 2 * 1024 * 1024;
const kinds = ["scanStart", "scan", "scanError", "account", "steam", "direct", "exit", "error", "settings"] as const;
export type ShortcutActivityEvent = {
  kind: typeof kinds[number]; accountId?: number; name?: string; count?: number;
  accounts?: number; elapsed?: number; code?: string; warnings?: string[]; root?: string | null;
};
export type ShortcutActivityEntry = ShortcutActivityEvent & { id: string; at: number };
export type ShortcutActivitySnapshot = {
  entries: readonly ShortcutActivityEntry[]; remember: boolean; detailed: boolean; storageError: boolean;
};
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export const shortcutActivityKey = (profile: string) => `harbor.games.shortcut-activity.v1:${encodeURIComponent(profile)}`;
const text = (value: unknown, limit: number) => typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, " ").slice(0, limit) : undefined;
const integer = (value: unknown, max: number) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : undefined;

function event(value: unknown): ShortcutActivityEvent | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!kinds.includes(item.kind as ShortcutActivityEvent["kind"])) return null;
  const parsed: ShortcutActivityEvent = {
    kind: item.kind as ShortcutActivityEvent["kind"],
    accountId: integer(item.accountId, 0xffff_ffff) || undefined,
    name: text(item.name, 256), count: integer(item.count, 10_000), accounts: integer(item.accounts, 128),
    elapsed: integer(item.elapsed, 86_400_000), root: item.root === null ? null : text(item.root, 1024),
    code: typeof item.code === "string" && /^games\.(shortcuts|custom)\.[a-z_]{1,64}$/.test(item.code) ? item.code : undefined,
    warnings: Array.isArray(item.warnings) ? [...new Set(item.warnings.filter((code): code is string => typeof code === "string" && /^shortcut_[a-z_]{1,40}$/.test(code)))].slice(0, 24) : undefined,
  };
  if (parsed.kind === "scan" && (parsed.count === undefined || parsed.accounts === undefined)
    || parsed.kind === "account" && (!parsed.accountId || parsed.count === undefined)
    || ["steam", "direct", "exit"].includes(parsed.kind) && (!parsed.name?.trim() || !parsed.accountId)
    || ["scanError", "error"].includes(parsed.kind) && !parsed.code) return null;
  return parsed;
}

/** Only bounded diagnostic fields are stored; executable arguments and raw native errors never enter this journal. */
export function createShortcutActivity(profile: string, storage: () => Storage = () => localStorage) {
  const key = shortcutActivityKey(profile), listeners = new Set<() => void>();
  let state: ShortcutActivitySnapshot = { entries: [], remember: false, detailed: false, storageError: false };
  try {
    const raw = storage().getItem(key);
    if (raw) {
      if (raw.length > MAX_STORED) throw Error("activity_size");
      const value = JSON.parse(raw);
      if (!value || typeof value.remember !== "boolean" || typeof value.detailed !== "boolean" || !Array.isArray(value.entries)) throw Error("activity_shape");
      const ids = new Set<string>();
      const entries = value.remember ? value.entries.slice(0, SHORTCUT_ACTIVITY_LIMIT).flatMap((item: unknown) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>, parsed = event(row), at = integer(row.at, 8_640_000_000_000_000);
        const id = text(row.id, 64);
        if (!parsed || at === undefined || !id || ids.has(id)) return [];
        ids.add(id); return [{ ...parsed, id, at }];
      }) : [];
      state = { entries, remember: value.remember, detailed: value.detailed, storageError: false };
    }
  } catch { state = { ...state, storageError: true }; }
  const publish = (next: ShortcutActivitySnapshot) => { state = next; for (const listener of listeners) listener(); };
  const persist = (next: ShortcutActivitySnapshot) => {
    try {
      const encoded = JSON.stringify({ remember: next.remember, detailed: next.detailed, entries: next.remember ? next.entries : [] });
      if (encoded.length > MAX_STORED) return false;
      storage().setItem(key, encoded);
      return true;
    } catch { return false; }
  };
  const recordMany = (values: readonly ShortcutActivityEvent[]) => {
    const added = values.slice(-SHORTCUT_ACTIVITY_LIMIT).flatMap(value => {
      const parsed = event(value);
      if (!parsed || parsed.kind === "account" && !state.detailed) return [];
      if (!state.detailed) parsed.root = undefined;
      return [{ ...parsed, id: crypto.randomUUID(), at: Date.now() }];
    });
    if (!added.length) return;
    const next = { ...state, entries: [...added.reverse(), ...state.entries].slice(0, SHORTCUT_ACTIVITY_LIMIT) };
    if (next.remember) next.storageError = !persist(next);
    publish(next);
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    get observed() { return listeners.size > 0; },
    record: (value: ShortcutActivityEvent) => recordMany([value]),
    recordMany,
    configure: (patch: Partial<Pick<ShortcutActivitySnapshot, "remember" | "detailed">>) => {
      const next = { ...state, remember: typeof patch.remember === "boolean" ? patch.remember : state.remember,
        detailed: typeof patch.detailed === "boolean" ? patch.detailed : state.detailed, storageError: false };
      if (!persist(next)) { publish({ ...state, storageError: true }); return false; }
      publish(next); return true;
    },
    clear: () => {
      const next = { ...state, entries: [], storageError: false };
      if (!persist(next)) { publish({ ...state, storageError: true }); return false; }
      publish(next); return true;
    },
  };
}
export type ShortcutActivity = ReturnType<typeof createShortcutActivity>;

// Keep session activity across route/profile changes; inactive profiles are bounded as well.
const sessions = new Map<string, ShortcutActivity>();
export function shortcutActivity(profile: string): ShortcutActivity {
  let activity = sessions.get(profile);
  if (!activity) { activity = createShortcutActivity(profile); sessions.set(profile, activity); }
  else { sessions.delete(profile); sessions.set(profile, activity); }
  for (const [key, candidate] of sessions) {
    if (sessions.size <= 16) break;
    if (key !== profile && !candidate.observed) sessions.delete(key);
  }
  return activity;
}
