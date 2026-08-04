import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useProfiles } from "./profiles";

export type MediaEntry = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  addedAt: number;
};

export type MediaInput = { id: string; type?: string; name?: string; poster?: string };

export type MediaListStore = {
  ids: Set<string>;
  items: Map<string, MediaEntry>;
  has: (id: string) => boolean;
  toggle: (input: MediaInput) => void;
  count: number;
};

function inferType(id: string): "movie" | "series" {
  return id.includes(":tv:") || id.includes(":series:") ? "series" : "movie";
}

function coerceType(t: unknown, id: string): "movie" | "series" {
  return t === "series" ? "series" : t === "movie" ? "movie" : inferType(id);
}

function readMap(key: string): Map<string, MediaEntry> {
  const map = new Map<string, MediaEntry>();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return map;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return map;
    for (const el of arr) {
      if (typeof el === "string") {
        map.set(el, { id: el, type: inferType(el), name: "", addedAt: 0 });
      } else if (el && typeof el.id === "string") {
        map.set(el.id, {
          id: el.id,
          type: coerceType(el.type, el.id),
          name: typeof el.name === "string" ? el.name : "",
          poster: typeof el.poster === "string" ? el.poster : undefined,
          addedAt: typeof el.addedAt === "number" ? el.addedAt : 0,
        });
      }
    }
  } catch {
    return new Map();
  }
  return map;
}

function writeMap(key: string, map: Map<string, MediaEntry>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...map.values()]));
  } catch {
    return;
  }
}

export function createMediaListStore(prefix: string) {
  const keyFor = (pid: string) => prefix + pid;
  const listeners = new Set<() => void>();
  const emitExternal = () => {
    for (const l of listeners) l();
  };
  const Ctx = createContext<MediaListStore | null>(null);

  function Provider({ children }: { children: ReactNode }) {
    const { activeId } = useProfiles();
    const pid = activeId ?? "default";
    const [items, setItems] = useState<Map<string, MediaEntry>>(() => readMap(keyFor(pid)));

    useEffect(() => {
      setItems(readMap(keyFor(pid)));
    }, [pid]);

    useEffect(() => {
      const tick = () => setItems(readMap(keyFor(pid)));
      listeners.add(tick);
      return () => {
        listeners.delete(tick);
      };
    }, [pid]);

    const value = useMemo<MediaListStore>(
      () => ({
        ids: new Set(items.keys()),
        items,
        has: (id) => items.has(id),
        toggle: (input) => {
          const next = new Map(items);
          if (next.has(input.id)) {
            next.delete(input.id);
          } else {
            next.set(input.id, {
              id: input.id,
              type: coerceType(input.type, input.id),
              name: input.name ?? "",
              poster: input.poster,
              addedAt: Date.now(),
            });
          }
          writeMap(keyFor(pid), next);
          setItems(next);
        },
        count: items.size,
      }),
      [items, pid],
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  function useStore(): MediaListStore {
    const v = useContext(Ctx);
    if (!v) throw new Error("media list store used outside its provider");
    return v;
  }

  function useIn(id?: string, altIds?: Array<string | null | undefined>): boolean {
    const { items } = useStore();
    if (id && items.has(id)) return true;
    if (altIds) for (const a of altIds) if (a && items.has(a)) return true;
    return false;
  }

  function removeData(pid: string): void {
    try {
      localStorage.removeItem(keyFor(pid));
    } catch {
      return;
    }
  }

  function setExternal(pid: string, input: MediaInput, on: boolean): void {
    const map = readMap(keyFor(pid));
    if (on) {
      map.set(input.id, {
        id: input.id,
        type: coerceType(input.type, input.id),
        name: input.name ?? "",
        poster: input.poster,
        addedAt: Date.now(),
      });
    } else {
      map.delete(input.id);
    }
    writeMap(keyFor(pid), map);
    emitExternal();
  }

  function hasExternal(pid: string, id: string): boolean {
    return readMap(keyFor(pid)).has(id);
  }

  return { Provider, useStore, useIn, removeData, setExternal, hasExternal };
}
