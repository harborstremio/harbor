import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useProfiles } from "./profiles";
import { persistableAddonOrigin, persistableVideos, type Meta } from "./cinemeta";
import {
  captureMembershipProfile,
  isMembershipItemInput,
  type MembershipProfile,
  type MembershipResult,
} from "./membership-operations";

export type MediaEntry = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  addedAt: number;
  addonOrigin?: Meta["addonOrigin"];
  videos?: Meta["videos"];
};

export type MediaInput = {
  id: string;
  type?: string;
  name?: string;
  poster?: string;
  addonOrigin?: Meta["addonOrigin"];
  videos?: Meta["videos"];
};

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
          addonOrigin: persistableAddonOrigin(el.addonOrigin),
          videos: persistableVideos(el.videos),
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
              addonOrigin: persistableAddonOrigin(input.addonOrigin),
              videos: persistableVideos(input.videos),
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
        addonOrigin: persistableAddonOrigin(input.addonOrigin),
        videos: persistableVideos(input.videos),
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

  function setExternalSafely(
    profile: MembershipProfile,
    input: MediaInput,
    on: boolean,
  ): MembershipResult {
    if (!isMembershipItemInput(input)) return { status: "error", reason: "invalid-data" };
    const current = captureMembershipProfile();
    if (!current) return { status: "error", reason: "storage-failed" };
    if (
      current.activeId !== profile.activeId ||
      current.settingsLinked !== profile.settingsLinked
    ) {
      return { status: "error", reason: "profile-changed" };
    }
    const key = keyFor(profile.activeId ?? "default");
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return { status: "error", reason: "storage-failed" };
    }
    let entries: unknown;
    try {
      entries = raw == null ? [] : JSON.parse(raw);
    } catch {
      return { status: "error", reason: "invalid-data" };
    }
    if (
      !Array.isArray(entries) ||
      !entries.every(
        (entry) => typeof entry === "string" || (entry && typeof entry.id === "string"),
      )
    ) {
      return { status: "error", reason: "invalid-data" };
    }
    const index = entries.findIndex(
      (entry) => (typeof entry === "string" ? entry : entry.id) === input.id,
    );
    if (on && index >= 0) return { status: "already-present" };
    if (!on && index < 0) return { status: "removed" };
    if (!on) {
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if ((typeof entry === "string" ? entry : entry.id) === input.id) entries.splice(i, 1);
      }
    } else {
      entries.push({
        id: input.id,
        type: coerceType(input.type, input.id),
        name: input.name ?? "",
        poster: input.poster,
        addedAt: Date.now(),
        addonOrigin: persistableAddonOrigin(input.addonOrigin),
        videos: persistableVideos(input.videos),
      });
    }
    try {
      localStorage.setItem(key, JSON.stringify(entries));
    } catch {
      return { status: "error", reason: "storage-failed" };
    }
    emitExternal();
    return { status: on ? "added" : "removed" };
  }

  function addExternalSafely(profile: MembershipProfile, input: MediaInput): MembershipResult {
    return setExternalSafely(profile, input, true);
  }

  return {
    Provider,
    useStore,
    useIn,
    removeData,
    setExternal,
    hasExternal,
    addExternalSafely,
    setExternalSafely,
  };
}
