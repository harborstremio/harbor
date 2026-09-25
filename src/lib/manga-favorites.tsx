import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useProfiles } from "./profiles";
import { setItemWithRecovery } from "./storage-recovery";
import { setMangaInLibrary } from "./manga/api";
import { notifyMangaLibraryChanged } from "./manga/library-events";
import { activeMangaSourceId, listMangaSources } from "./manga/sources";

export type MangaFavEntry = {
  id: string;
  title: string;
  cover?: string;
  sourceId?: string;
  addedAt: number;
};

const PREFIX = "harbor.mangafav.v1.";
const keyFor = (pid: string) => PREFIX + pid;
const librarySync = new Map<string, Promise<void>>();

function syncLibrary(id: string, inLibrary: boolean, sourceId = activeMangaSourceId()): void {
  const owner = id.includes("::") ? id.slice(0, id.indexOf("::")) : sourceId;
  const source = listMangaSources().find((item) => item.id === owner);
  if (!source || source.kind !== "suwayomi") return;
  const pending = librarySync.get(id) ?? Promise.resolve();
  const next = pending
    .catch(() => {})
    .then(async () => {
      await setMangaInLibrary(id, inLibrary, sourceId, source.baseUrl);
      notifyMangaLibraryChanged();
    });
  librarySync.set(id, next);
  void next
    .catch((error) => console.warn("[manga-favorites] Suwayomi library sync failed", error))
    .finally(() => {
      if (librarySync.get(id) === next) librarySync.delete(id);
    });
}

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
          sourceId: typeof el.sourceId === "string" ? el.sourceId : undefined,
          addedAt: typeof el.addedAt === "number" ? el.addedAt : 0,
        });
      }
    }
  } catch {
    return new Map();
  }
  return map;
}

function writeMap(key: string, map: Map<string, MangaFavEntry>): boolean {
  return setItemWithRecovery(key, JSON.stringify([...map.values()]));
}

function qualifiedFavoriteId(id: string, sourceId: string): string {
  return id.includes("::") || !sourceId || sourceId === "all" ? id : `${sourceId}::${id}`;
}

function storedFavoriteKey(
  items: Map<string, MangaFavEntry>,
  id: string,
  sourceId: string,
): string | undefined {
  const qualified = qualifiedFavoriteId(id, sourceId);
  if (qualified.includes("::") && items.has(qualified)) return qualified;
  const separator = id.indexOf("::");
  const raw = separator < 0 ? id : id.slice(separator + 2);
  const owner = separator < 0 ? sourceId : id.slice(0, separator);
  const legacy = items.get(raw);
  // Legacy raw IDs without source metadata can only be removed explicitly
  // from their own library card; never guess a provider from today's selection.
  return legacy && (legacy.sourceId ?? "") === owner ? raw : undefined;
}

export type MangaFavoritesStore = {
  items: Map<string, MangaFavEntry>;
  has: (id: string, sourceId?: string) => boolean;
  toggle: (input: { id: string; title?: string; cover?: string; sourceId?: string }) => boolean;
  count: number;
};

const Ctx = createContext<MangaFavoritesStore | null>(null);

export function MangaFavoritesProvider({ children }: { children: ReactNode }) {
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const [stored, setStored] = useState(() => ({ pid, items: readMap(keyFor(pid)) }));
  const items = useMemo(
    () => (stored.pid === pid ? stored.items : readMap(keyFor(pid))),
    [stored, pid],
  );
  const current = useRef({ pid, items });
  current.current = { pid, items };
  useEffect(() => {
    setStored({ pid, items: readMap(keyFor(pid)) });
  }, [pid]);

  const value = useMemo<MangaFavoritesStore>(
    () => ({
      items,
      has: (id, sourceId = activeMangaSourceId()) =>
        storedFavoriteKey(items, id, sourceId) !== undefined,
      toggle: (input) => {
        if (current.current.pid !== pid) return false;
        const next = new Map(current.current.items);
        const sourceId = input.sourceId ?? activeMangaSourceId();
        const existing = storedFavoriteKey(next, input.id, sourceId);
        const removing = existing !== undefined;
        if (existing !== undefined) {
          next.delete(existing);
        } else {
          const id = qualifiedFavoriteId(input.id, sourceId);
          next.set(id, {
            id,
            title: input.title ?? "",
            cover: input.cover,
            sourceId,
            addedAt: Date.now(),
          });
        }
        const saved = writeMap(keyFor(pid), next);
        if (!saved) return false;
        syncLibrary(input.id, !removing, sourceId);
        current.current = { pid, items: next };
        setStored({ pid, items: next });
        return saved;
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
  const { has } = useMangaFavorites();
  return !!id && has(id);
}

export function removeMangaFavorites(pid: string): void {
  try {
    localStorage.removeItem(keyFor(pid));
  } catch {
    return;
  }
}
