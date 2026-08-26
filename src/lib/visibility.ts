import { useEffect, useState, type RefObject } from "react";

type Callback = (visible: boolean) => void;

const subs = new WeakMap<Element, Set<Callback>>();
let observer: IntersectionObserver | null = null;

function ensureObserver(): IntersectionObserver {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const callbacks = subs.get(e.target);
        if (!callbacks) continue;
        for (const cb of [...callbacks]) cb(e.isIntersecting);
      }
    },
    { rootMargin: "100px" },
  );
  return observer;
}

export function observe(el: Element, cb: Callback): () => void {
  const o = ensureObserver();
  let callbacks = subs.get(el);
  if (!callbacks) {
    callbacks = new Set<Callback>();
    subs.set(el, callbacks);
    o.observe(el);
  }
  callbacks.add(cb);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const current = subs.get(el);
    if (!current) return;
    current.delete(cb);
    if (current.size > 0) return;
    o.unobserve(el);
    subs.delete(el);
  };
}

export function useInViewport(
  ref: RefObject<Element | null>,
  initial = false,
): boolean {
  const [inView, setInView] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observe(el, setInView);
  }, [ref]);
  return inView;
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden,
  );
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}
