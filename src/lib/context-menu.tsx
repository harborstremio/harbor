import type { Meta } from "@/lib/cinemeta";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewSummonable = "home" | "discover" | "anime" | "queue" | "addons";

export type ContextMenuTarget =
  | { kind: "meta"; meta: Meta }
  | { kind: "view"; view: ViewSummonable; label: string }
  | { kind: "addon"; addonId: string; label: string }
  | { kind: "edit"; element: HTMLElement | null; selection: string }
  | { kind: "backdrop"; metaId: string; url: string }
  | { kind: "subtitle"; label: string; download?: () => void | Promise<unknown> };

type Pos = { x: number; y: number };

type CtxValue = {
  state: { target: ContextMenuTarget; pos: Pos } | null;
  open: (e: React.MouseEvent | MouseEvent, target: ContextMenuTarget) => void;
  close: () => void;
};

const Ctx = createContext<CtxValue | null>(null);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ target: ContextMenuTarget; pos: Pos } | null>(null);

  const open = useCallback((e: React.MouseEvent | MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault();
    setState({ target, pos: { x: e.clientX, y: e.clientY } });
  }, []);

  const close = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!state) return;
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-harbor-player]")) return;
      close();
    };
    const onResize = () => close();
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [state, close]);

  return <Ctx.Provider value={{ state, open, close }}>{children}</Ctx.Provider>;
}

export function useContextMenu(): CtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useContextMenu outside ContextMenuProvider");
  return v;
}
