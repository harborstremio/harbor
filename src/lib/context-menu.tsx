import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";
import type { ActionSource } from "./context-actions";
import type { ContentContext } from "./context-content";
import { clickedContent, editingTarget } from "./context-content";

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

export type MembershipContext = { kind: "collection" | "list"; id: string };
export type ContextMenuTarget = ContentContext & {
  contentPolicy?: "separate";
  isValid?: () => boolean;
} & (
    | {
        kind: "meta";
        meta: Meta;
        membership?: MembershipContext;
        primary?: ActionSource;
        extra?: ActionSource;
        player?: boolean;
        episode?: PlayEpisode;
        watchScope?: "title" | "episode";
      }
    | ({ kind: "actions"; id: string; label: string } & ActionSource)
    | { kind: "content"; label?: string }
    | { kind: "view"; view: ViewSummonable; label: string }
    | { kind: "addon"; addonId: string; label: string }
    | { kind: "edit"; element: HTMLElement | null; selection: string }
    | { kind: "backdrop"; metaId: string; url: string }
    | {
        kind: "subtitle";
        label: string;
        details?: SubtitleContextDetails;
        download?: () => void | Promise<unknown>;
      }
  );

type Pos = { x: number; y: number };

type MenuState = {
  target: ContextMenuTarget;
  pos: Pos;
  origin: HTMLElement | null;
  session: number;
};
type CtxValue = {
  state: MenuState | null;
  open: (e: React.MouseEvent | MouseEvent, target: ContextMenuTarget) => void;
  openAt: (pos: Pos, target: ContextMenuTarget) => void;
  close: (restoreFocus?: boolean, expectedSession?: number) => void;
};

const Ctx = createContext<CtxValue | null>(null);
const targets = new WeakMap<Element, () => ContextMenuTarget>();

/** Register trusted component data; DOM attributes are never registrations. */
export function registerContextTarget(node: Element, getter: () => ContextMenuTarget): () => void {
  targets.set(node, getter);
  return () => {
    if (targets.get(node) === getter) targets.delete(node);
  };
}

function targetIdentity(target: ContextMenuTarget): string {
  if (target.kind === "actions") return `actions:${target.id}`;
  if (target.kind === "meta")
    return JSON.stringify([
      "meta",
      target.meta.type,
      target.meta.id,
      target.episode,
      target.watchScope,
      target.membership,
    ]);
  return target.kind;
}

function liveTarget(node: Element, getter: () => ContextMenuTarget): ContextMenuTarget {
  const initial = getter();
  const identity = targetIdentity(initial);
  const read = () =>
    node.isConnected && targets.get(node) === getter && targetIdentity(getter()) === identity
      ? getter()
      : null;
  const isValid = () =>
    initial.isValid?.() !== false && read()?.isValid?.() !== false && read() !== null;
  if (initial.kind === "actions")
    return {
      ...initial,
      actions: () => {
        const next = read();
        return next?.kind === "actions" ? next.actions() : [];
      },
      isValid: () => {
        const next = read();
        return (
          initial.isValid?.() !== false && next?.kind === "actions" && next.isValid?.() !== false
        );
      },
    };
  if (initial.kind === "meta") {
    const liveSource = (field: "primary" | "extra"): ActionSource | undefined =>
      initial[field]
        ? {
            ...initial[field],
            actions: () => {
              const next = read();
              return next?.kind === "meta" ? (next[field]?.actions() ?? []) : [];
            },
            isValid: () => {
              const next = read();
              return (
                isValid() &&
                initial[field]?.isValid?.() !== false &&
                next?.kind === "meta" &&
                next[field]?.isValid?.() !== false
              );
            },
          }
        : undefined;
    return {
      ...initial,
      isValid,
      primary: liveSource("primary"),
      extra: liveSource("extra"),
    };
  }
  return { ...initial, isValid };
}

/** Only trusted component registrations confer entity identity. */
export function registeredContextTarget(
  el: Element | null,
  boundary?: Element,
): ContextMenuTarget | null {
  for (let node = el; node; node = node.parentElement) {
    const getter = targets.get(node);
    if (getter) {
      const target = liveTarget(node, getter);
      if (target.contentPolicy === "separate" && el?.closest("img") && node !== el) return null;
      return target;
    }
    if (node === boundary) break;
    // A link or independent button inside a card owns its interaction. Only a
    // registration on that control may confer an entity beyond its content.
    if (node.matches("a[href],button,[role='button']")) break;
  }
  return null;
}

export function useContextTarget<T extends Element = HTMLElement>(target: () => ContextMenuTarget) {
  const latest = useRef(target);
  latest.current = target;
  const previous = useRef<T | null>(null);
  return useCallback((node: T | null) => {
    if (previous.current) targets.delete(previous.current);
    previous.current = node;
    if (node) registerContextTarget(node, () => latest.current());
  }, []);
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MenuState | null>(null);
  const current = useRef<MenuState | null>(null);
  current.current = state;
  const generation = useRef(0);

  const openAt = useCallback((pos: Pos, target: ContextMenuTarget) => {
    const next = {
      target,
      pos,
      origin: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      session: ++generation.current,
    };
    current.current = next;
    setState(next);
  }, []);

  const open = useCallback((e: React.MouseEvent | MouseEvent, target: ContextMenuTarget) => {
    if (editingTarget(e.target)) return;
    const el = e.target instanceof Element ? e.target : null;
    const boundary = e.currentTarget instanceof Element ? e.currentTarget : undefined;
    const resolved = registeredContextTarget(el, boundary) ?? target;
    e.preventDefault();
    e.stopPropagation();
    const origin =
      el?.closest<HTMLElement>("button,a[href],[tabindex]") ??
      (e.currentTarget instanceof HTMLElement ? e.currentTarget : null);
    const rect = origin?.getBoundingClientRect();
    const point =
      e.clientX || e.clientY
        ? { x: e.clientX, y: e.clientY }
        : { x: rect?.left ?? 8, y: rect?.bottom ?? 8 };
    const content = clickedContent(e.target);
    const declared =
      resolved.image ??
      (resolved.kind === "meta" && resolved.meta.poster
        ? {
            src: resolved.meta.poster,
            publicUrl: resolved.meta.poster,
            label: resolved.meta.name,
          }
        : undefined);
    // Content under the pointer wins. Enrich it only when the component's
    // descriptor names the same image, never another avatar or badge.
    const image = content.image
      ? declared?.src === content.image.src
        ? { ...declared, ...content.image }
        : content.image
      : declared;
    const next = {
      target: { ...resolved, ...content, image },
      pos: point,
      origin,
      session: ++generation.current,
    };
    current.current = next;
    setState(next);
  }, []);

  const close = useCallback((restoreFocus = true, expectedSession?: number) => {
    if (expectedSession !== undefined && current.current?.session !== expectedSession) return;
    const origin = current.current?.origin;
    current.current = null;
    setState(null);
    if (restoreFocus && origin?.isConnected) origin.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!state) return;
    const validate = window.setInterval(() => {
      if (state.target.isValid?.() === false || (state.origin && !state.origin.isConnected))
        close(false, state.session);
    }, 300);
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-harbor-context-layer]")) return;
      if (t instanceof Element && t.closest("[data-harbor-player]")) return;
      close(false);
    };
    // Fullscreen window chrome can briefly resize while opening a context menu.
    // Keep the menu open and let its viewport-clamped position update instead.
    const onResize = () => setState((current) => (current ? { ...current } : null));
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.clearInterval(validate);
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

/** A hero owns its title/artwork; its separate controls keep their own context. */
export function useHeroContext(meta: Meta | undefined, artwork?: string) {
  const { open } = useContextMenu();
  return (event: React.MouseEvent<HTMLElement>) => {
    if (
      !meta ||
      event.defaultPrevented ||
      (event.target instanceof Element && event.target.closest("button,a[href],input,textarea"))
    )
      return;
    open(event, {
      kind: "meta",
      meta,
      image: artwork ? { src: artwork, publicUrl: artwork, label: meta.name } : undefined,
    });
  };
}
