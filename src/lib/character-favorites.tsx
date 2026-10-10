import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useProfiles } from "./profiles";

export type CharacterEntry = {
  id: string;
  name: string;
  image?: string;
  addedAt: number;
};

type CharacterInput = { id: string; name?: string; image?: string };

export type CharacterFavoritesStore = {
  ids: Set<string>;
  items: Map<string, CharacterEntry>;
  has: (id: string) => boolean;
  toggle: (input: CharacterInput) => void;
  count: number;
};

const PREFIX = "harbor.charfavorites.v1.";
const keyFor = (pid: string) => PREFIX + pid;

function readMap(key: string): Map<string, CharacterEntry> {
  const map = new Map<string, CharacterEntry>();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return map;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return map;
    for (const el of arr) {
      if (el && typeof el.id === "string") {
        map.set(el.id, {
          id: el.id,
          name: typeof el.name === "string" ? el.name : "",
          image: typeof el.image === "string" ? el.image : undefined,
          addedAt: typeof el.addedAt === "number" ? el.addedAt : 0,
        });
      }
    }
  } catch {
    return new Map();
  }
  return map;
}

function writeMap(key: string, map: Map<string, CharacterEntry>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...map.values()]));
  } catch {
    return;
  }
}

const Ctx = createContext<CharacterFavoritesStore | null>(null);

export function CharacterFavoritesProvider({ children }: { children: ReactNode }) {
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const [items, setItems] = useState<Map<string, CharacterEntry>>(() => readMap(keyFor(pid)));

  useEffect(() => {
    setItems(readMap(keyFor(pid)));
  }, [pid]);

  const value = useMemo<CharacterFavoritesStore>(
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
            name: input.name ?? "",
            image: input.image,
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

export function useCharacterFavorites(): CharacterFavoritesStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("character favorites used outside its provider");
  return v;
}

export function useIsCharacterFavorite(id?: string): boolean {
  const { items } = useCharacterFavorites();
  return id ? items.has(id) : false;
}

export function removeCharacterFavorites(profileId: string): void {
  try {
    localStorage.removeItem(keyFor(profileId));
  } catch {
    return;
  }
}
