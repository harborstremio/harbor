import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { DvrSession, DvrStartArgs } from "./types";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type DvrContextValue = {
  sessions: DvrSession[];
  start: (args: DvrStartArgs) => Promise<string>;
  stop: (id: string) => Promise<void>;
  reveal: (path: string) => Promise<void>;
  defaultDir: () => Promise<string>;
  dismiss: (id: string) => void;
};

const DvrContext = createContext<DvrContextValue | null>(null);

export function DvrProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<DvrSession[]>([]);
  const [terminal, setTerminal] = useState<DvrSession[]>([]);

  useEffect(() => {
    if (!IS_TAURI) return;
    let cancelled = false;
    invoke<DvrSession[]>("dvr_list")
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!IS_TAURI) return;
    const unlisteners: UnlistenFn[] = [];
    listen<DvrSession>("dvr://progress", (e) => {
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === e.payload.id);
        if (idx < 0) return [...prev, e.payload];
        const next = prev.slice();
        next[idx] = e.payload;
        return next;
      });
    })
      .then((u) => unlisteners.push(u))
      .catch(() => {});
    listen<DvrSession>("dvr://done", (e) => {
      setSessions((prev) => prev.filter((s) => s.id !== e.payload.id));
      setTerminal((prev) => [...prev.filter((s) => s.id !== e.payload.id), e.payload]);
    })
      .then((u) => unlisteners.push(u))
      .catch(() => {});
    listen<DvrSession>("dvr://error", (e) => {
      setSessions((prev) => prev.filter((s) => s.id !== e.payload.id));
      setTerminal((prev) => [...prev.filter((s) => s.id !== e.payload.id), e.payload]);
    })
      .then((u) => unlisteners.push(u))
      .catch(() => {});
    return () => {
      unlisteners.forEach((u) => u());
    };
  }, []);

  const start = useCallback(async (args: DvrStartArgs) => {
    return invoke<string>("dvr_start", { args });
  }, []);

  const stop = useCallback(async (id: string) => {
    await invoke("dvr_stop", { id });
  }, []);

  const reveal = useCallback(async (path: string) => {
    await invoke("dvr_reveal", { path });
  }, []);

  const defaultDir = useCallback(async () => {
    return invoke<string>("dvr_default_dir");
  }, []);

  const dismiss = useCallback((id: string) => {
    setTerminal((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const all = [...sessions, ...terminal];

  return (
    <DvrContext.Provider value={{ sessions: all, start, stop, reveal, defaultDir, dismiss }}>
      {children}
    </DvrContext.Provider>
  );
}

export function useDvr(): DvrContextValue {
  const v = useContext(DvrContext);
  if (!v) throw new Error("useDvr must be used within DvrProvider");
  return v;
}
