import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Meta } from "@/lib/cinemeta";

export type ViewSummonable = "home" | "discover" | "anime" | "queue" | "addons";

export type SubtitleContextDetails = {
  language: string;
  source: string;
  provider?: string;
  format?: string;
  fps?: number;
  quality?: string;
  release?: string;
  author?: string;
  downloads?: number;
  compatibilityPercent?: number;
  matchReasons?: string[];
  flags?: string[];
};

export type ContextMenuTarget =
  | { kind: "meta"; meta: Meta }
  | { kind: "view"; view: ViewSummonable; label: string }
  | { kind: "addon"; addonId: string; label: string }
  | { kind: "edit"; element: HTMLElement | null; selection: string }
  | { kind: "backdrop"; metaId: string; url: string }
  | {
      kind: "subtitle";
      label: string;
      details?: SubtitleContextDetails;
      download?: () => void | Promise<unknown>;
    };

type Pos = { x: number; y: number };

type CtxValue = {
  state: { target: ContextMenuTarget; pos: Pos } | null;
  open: (e: React.MouseEvent | MouseEvent, target: ContextMenuTarget) => void;
  openAt: (pos: Pos, target: ContextMenuTarget) => void;
  close: () => void;
};

const Ctx = createContext<CtxValue | null>(null);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ target: ContextMenuTarget; pos: Pos } | null>(null);

  const openAt = useCallback((pos: Pos, target: ContextMenuTarget) => {
    setState({ target, pos });
  }, []);

  const open = useCallback(
    (e: React.MouseEvent | MouseEvent, target: ContextMenuTarget) => {
      e.preventDefault();
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("[data-harbor-no-context-menu]")) return;
      openAt({ x: e.clientX, y: e.clientY }, target);
    },
    [openAt],
  );

  const close = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!state) return;
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-harbor-player]")) return;
      close();
    };
    // Fullscreen window chrome can briefly resize while opening a context menu.
    // Keep the menu open and let its viewport-clamped position update instead.
    const onResize = () => setState((current) => (current ? { ...current } : null));
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [state, close]);

  return <Ctx.Provider value={{ state, open, openAt, close }}>{children}</Ctx.Provider>;
}

export function useContextMenu(): CtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useContextMenu outside ContextMenuProvider");
  return v;
}
