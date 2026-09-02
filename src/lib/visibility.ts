import { useEffect, useState, type RefObject } from "react";

type Callback = (visible: boolean) => void;

const subs = new WeakMap<Element, Set<Callback>>();
let observer: IntersectionObserver | null = null;

function ensureObserver(): IntersectionObserver {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const set = subs.get(e.target);
        if (!set) continue;
        for (const cb of [...set]) cb(e.isIntersecting);
      }
    },
    { rootMargin: "100px" },
  );
  return observer;
}

export function observe(el: Element, cb: Callback): () => void {
  const o = ensureObserver();
  let set = subs.get(el);
  if (!set) {
    set = new Set();
    subs.set(el, set);
    o.observe(el);
  }
  set.add(cb);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = subs.get(el);
    if (!current) return;
    current.delete(cb);
    if (current.size > 0) return;
    subs.delete(el);
    o.unobserve(el);
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
