import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Meta } from "@/lib/cinemeta";
import type { NavItemId } from "@/chrome/nav-items";
import type { View } from "@/lib/view";
import type { MangaProgressEntry } from "@/lib/manga-progress";
import type { MangaChapter } from "@/lib/manga/model";
import type { PlayEpisode } from "@/lib/view";
import type { ActionSource } from "./context-actions";
import type { ContentContext } from "./context-content";
import type { ListStore } from "./custom-lists";
import { clickedContent, contextPointerPoint, editingTarget } from "./context-content";

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

export type MembershipContext = { kind: "collection" | "list"; id: string; store?: ListStore };
export type ContextMenuTarget = ContentContext & {
  contentPolicy?: "separate";
  isValid?: () => boolean;
  navigation?: boolean;
  scope?: "page-background";
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
    | ({
        kind: "actions";
        id: string;
        label: string;
        manga?: { id: string; title?: string; cover?: string };
      } & ActionSource)
    | { kind: "content"; label?: string }
    | { kind: "view"; view: ViewSummonable; label: string }
    | { kind: "addon"; addonId: string; label: string }
    | { kind: "person"; id: number }
    | { kind: "manga"; id: string; title?: string; cover?: string }
    | { kind: "manga-continue"; entry: MangaProgressEntry }
    | {
        kind: "manga-chapter";
        mangaId: string;
        mangaTitle?: string;
        mangaCover?: string;
        chapter: MangaChapter;
      }
    | { kind: "ebook"; id: string }
    | { kind: "nav"; itemId?: NavItemId; view?: View; label?: string; onOpen?: () => void }
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
  phase: "open" | "closing";
};
type CtxValue = {
  state: MenuState | null;
  open: (e: React.MouseEvent | MouseEvent, target: ContextMenuTarget) => void;
  openAt: (pos: Pos, target: ContextMenuTarget) => void;
  close: (restoreFocus?: boolean, expectedSession?: number) => void;
  completeClose: (expectedSession: number) => void;
};

const Ctx = createContext<CtxValue | null>(null);
type MenuActions = Omit<CtxValue, "state">;
const ActionsCtx = createContext<MenuActions | null>(null);
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
  const read = () => {
    // A title can outlive the card showing its membership. Keep the captured
    // title when that card disappears; explicit actor/page/service guards still
    // apply. A connected card reused for another identity remains invalid.
    if (!node.isConnected && initial.kind === "meta") return initial;
    if (targets.get(node) !== getter) return null;
    const next = getter();
    return targetIdentity(next) === identity ? next : null;
  };
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
  const getter = useCallback(() => latest.current(), []);
  const previous = useRef<T | null>(null);
  return useCallback(
    (node: T | null) => {
      if (previous.current) targets.delete(previous.current);
      previous.current = node;
      if (node) registerContextTarget(node, getter);
    },
    [getter],
  );
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
      phase: "open" as const,
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
    const content = clickedContent(e.target, contextPointerPoint(e));
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
      target: {
        ...resolved,
        ...content,
        image,
        navigation:
          resolved.navigation ??
          !el?.closest('[role="dialog"],[data-harbor-player],[data-bp-root]'),
      },
      pos: point,
      origin,
      session: ++generation.current,
      phase: "open" as const,
    };
    current.current = next;
    setState(next);
  }, []);

  const close = useCallback((restoreFocus = true, expectedSession?: number) => {
    if (expectedSession !== undefined && current.current?.session !== expectedSession) return;
    if (!current.current || current.current.phase === "closing") return;
    const origin = current.current?.origin;
    const next = { ...current.current, phase: "closing" as const };
    current.current = next;
    setState(next);
    if (restoreFocus && origin?.isConnected) origin.focus({ preventScroll: true });
  }, []);

  const completeClose = useCallback((expectedSession: number) => {
    if (current.current?.session !== expectedSession || current.current.phase !== "closing") return;
    current.current = null;
    setState(null);
  }, []);

  useEffect(() => {
    if (!state || state.phase === "closing") return;
    const validate = window.setInterval(() => {
      // The origin is only a focus destination: temporary hover content may
      // disappear while its semantic target remains actionable.
      if (state.target.isValid?.() === false) close(false, state.session);
    }, 300);
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-harbor-context-layer]")) return;
      if (t instanceof Element && t.closest("[data-harbor-player]")) return;
      close(false, state.session);
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

  const actions = useMemo(
    () => ({ open, openAt, close, completeClose }),
    [open, openAt, close, completeClose],
  );
  return (
    <ActionsCtx.Provider value={actions}>
      <Ctx.Provider value={{ state, ...actions }}>{children}</Ctx.Provider>
    </ActionsCtx.Provider>
  );
}

/** Event-only consumers do not need to rerender when the menu changes. */
export function useContextMenuActions(): MenuActions {
  const value = useContext(ActionsCtx);
  if (!value) throw new Error("useContextMenuActions outside ContextMenuProvider");
  return value;
}

export function useContextMenu(): CtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useContextMenu outside ContextMenuProvider");
  return v;
}

/** A hero owns its title/artwork; its separate controls keep their own context. */
export function useHeroContext(meta: Meta | undefined, artwork?: string) {
  const { open } = useContextMenuActions();
  const latest = useRef(meta);
  latest.current = meta;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (event: React.MouseEvent<HTMLElement>) => {
    if (
      !meta ||
      event.defaultPrevented ||
      (event.target instanceof Element && event.target.closest("button,a[href],input,textarea"))
    )
      return;
    const { id, type } = meta;
    open(event, {
      kind: "meta",
      meta,
      isValid: () => mounted.current && latest.current?.id === id && latest.current.type === type,
      image: artwork ? { src: artwork, publicUrl: artwork, label: meta.name } : undefined,
    });
  };
}
