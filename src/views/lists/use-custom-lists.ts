import { detectSource } from "@/lib/lists/detect";
import { sourceLabel, type CustomList, type ListSource } from "@/lib/lists/types";
import { useSettings } from "@/lib/settings";
import { useCallback, useEffect, useState } from "react";

const ACTIVE_KEY = "harbor.lists.active";

function readActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActive(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* noop */
  }
}

function deriveName(ref: string, source: ListSource): string {
  const segment = ref.split("/").filter(Boolean).pop() ?? "";
  const pretty = segment.replace(/[-_]+/g, " ").trim();
  if (pretty && !/^(ls|ur)\d+$/i.test(pretty) && !/^\d+$/.test(pretty)) {
    return pretty.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return `${sourceLabel(source)} list`;
}

export function useCustomLists() {
  const { settings, update } = useSettings();
  const lists = settings.customLists;
  const [activeId, setActiveId] = useState<string | null>(() => readActive());

  useEffect(() => {
    if (lists.length === 0) {
      if (activeId !== null) {
        setActiveId(null);
        writeActive(null);
      }
      return;
    }
    if (!activeId || !lists.find((l) => l.id === activeId)) {
      const fallback = lists[0]?.id ?? null;
      setActiveId(fallback);
      writeActive(fallback);
    }
  }, [lists, activeId]);

  const selectId = useCallback((id: string) => {
    setActiveId(id);
    writeActive(id);
  }, []);

  const addList = useCallback(
    (ref: string, name?: string): boolean => {
      const detected = detectSource(ref);
      if (!detected) return false;
      const id = `cl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const entry: CustomList = {
        id,
        name: name?.trim() || deriveName(detected.ref, detected.source),
        source: detected.source,
        ref: detected.ref,
        addedAt: Date.now(),
      };
      update({ customLists: [...lists, entry] });
      setActiveId(id);
      writeActive(id);
      return true;
    },
    [lists, update],
  );

  const editList = useCallback(
    (id: string, ref: string, name?: string): boolean => {
      const detected = detectSource(ref);
      if (!detected) return false;
      const next = lists.map((l) =>
        l.id === id
          ? {
              ...l,
              name: name?.trim() || deriveName(detected.ref, detected.source),
              source: detected.source,
              ref: detected.ref,
            }
          : l,
      );
      update({ customLists: next });
      return true;
    },
    [lists, update],
  );

  const removeList = useCallback(
    (id: string) => {
      const next = lists.filter((l) => l.id !== id);
      if (activeId === id) {
        const fallback = next[0]?.id ?? null;
        setActiveId(fallback);
        writeActive(fallback);
      }
      update({ customLists: next });
    },
    [lists, update, activeId],
  );

  return { lists, activeId, selectId, addList, editList, removeList };
}
