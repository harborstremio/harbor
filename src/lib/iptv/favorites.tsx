import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { IptvChannel } from "./types";

const STORAGE_KEY = "harbor.iptv.favorites.v2";
const LEGACY_KEY = "harbor.iptv.favorites.v1";
export const FAVORITES_GROUP_KEY = "__FAVORITES__";

export type StoredFavorite = {
  id: string;
  name: string;
  logo: string | null;
  group: string | null;
  url: string;
  tvgId: string | null;
  sourceId: string;
};

type FavoritesContextValue = {
  ids: ReadonlySet<string>;
  items: ReadonlyMap<string, StoredFavorite>;
  toggle: (channel: IptvChannel) => void;
  has: (channelId: string) => boolean;
  hydrate: (channels: IptvChannel[]) => void;
  removeForSource: (sourceId: string) => void;
  count: number;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function sourceOf(id: string): string {
  return id.split("::")[0] ?? "";
}

function fromChannel(ch: IptvChannel): StoredFavorite {
  return {
    id: ch.id,
    name: ch.name,
    logo: ch.logo,
    group: ch.group,
    url: ch.url,
    tvgId: ch.tvgId,
    sourceId: sourceOf(ch.id),
  };
}

function readInitial(): Map<string, StoredFavorite> {
  const map = new Map<string, StoredFavorite>();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const e of parsed) {
          if (e && typeof e.id === "string") {
            map.set(e.id, {
              id: e.id,
              name: typeof e.name === "string" ? e.name : "",
              logo: typeof e.logo === "string" ? e.logo : null,
              group: typeof e.group === "string" ? e.group : null,
              url: typeof e.url === "string" ? e.url : "",
              tvgId: typeof e.tvgId === "string" ? e.tvgId : null,
              sourceId: typeof e.sourceId === "string" ? e.sourceId : sourceOf(e.id),
            });
          }
        }
      }
    }
  } catch {}
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === "string" && !map.has(id)) {
            map.set(id, {
              id,
              name: "",
              logo: null,
              group: null,
              url: "",
              tvgId: null,
              sourceId: sourceOf(id),
            });
          }
        }
      }
    }
  } catch {}
  return map;
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Map<string, StoredFavorite>>(() => readInitial());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(items.values())));
    } catch {}
  }, [items]);

  const toggle = useCallback((channel: IptvChannel) => {
    setItems((prev) => {
      const next = new Map(prev);
      if (next.has(channel.id)) next.delete(channel.id);
      else next.set(channel.id, fromChannel(channel));
      return next;
    });
  }, []);

  const hydrate = useCallback((channels: IptvChannel[]) => {
    setItems((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const ch of channels) {
        const ex = next.get(ch.id);
        if (ex && !ex.url && ch.url) {
          next.set(ch.id, fromChannel(ch));
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const removeForSource = useCallback((sourceId: string) => {
    if (!sourceId) return;
    setItems((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, fav] of prev) {
        if (fav.sourceId === sourceId || id.startsWith(`${sourceId}::`)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const ids = useMemo(() => new Set(items.keys()), [items]);
  const has = useCallback((id: string) => items.has(id), [items]);

  const value = useMemo<FavoritesContextValue>(
    () => ({ ids, items, toggle, has, hydrate, removeForSource, count: items.size }),
    [ids, items, toggle, has, hydrate, removeForSource],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const v = useContext(FavoritesContext);
  if (!v) throw new Error("useFavorites must be used within FavoritesProvider");
  return v;
}
