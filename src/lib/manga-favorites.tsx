import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useProfiles } from "./profiles";
import { persistCritical } from "./storage-recovery";

export type MangaFavEntry = { id: string; title: string; cover?: string; addedAt: number };

const PREFIX = "harbor.mangafav.v1.";
const keyFor = (pid: string) => PREFIX + pid;

function readMap(key: string): Map<string, MangaFavEntry> {
  const map = new Map<string, MangaFavEntry>();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return map;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return map;
    for (const el of arr) {
      if (el && typeof el.id === "string") {
        map.set(el.id, {
          id: el.id,
          title: typeof el.title === "string" ? el.title : "",
          cover: typeof el.cover === "string" ? el.cover : undefined,
          addedAt: typeof el.addedAt === "number" ? el.addedAt : 0,
        });
      }
    }
  } catch {
    return new Map();
  }
  return map;
}

function writeMap(key: string, map: Map<string, MangaFavEntry>): void {
  persistCritical(key, JSON.stringify([...map.values()]));
}

export type MangaFavoritesStore = {
  items: Map<string, MangaFavEntry>;
  has: (id: string) => boolean;
  toggle: (input: { id: string; title?: string; cover?: string }) => void;
  count: number;
};

const Ctx = createContext<MangaFavoritesStore | null>(null);

export function MangaFavoritesProvider({ children }: { children: ReactNode }) {
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const [items, setItems] = useState<Map<string, MangaFavEntry>>(() => readMap(keyFor(pid)));

  useEffect(() => {
    setItems(readMap(keyFor(pid)));
  }, [pid]);

  const value = useMemo<MangaFavoritesStore>(
    () => ({
      items,
      has: (id) => items.has(id),
      toggle: (input) => {
        const next = new Map(items);
        if (next.has(input.id)) {
          next.delete(input.id);
        } else {
          next.set(input.id, {
            id: input.id,
            title: input.title ?? "",
            cover: input.cover,
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

export function useMangaFavorites(): MangaFavoritesStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("manga favorites used outside its provider");
  return v;
}

export function useIsMangaFavorite(id?: string): boolean {
  const { items } = useMangaFavorites();
  return !!id && items.has(id);
}

export function removeMangaFavorites(pid: string): void {
  try {
    localStorage.removeItem(keyFor(pid));
  } catch {
    return;
  }
}
