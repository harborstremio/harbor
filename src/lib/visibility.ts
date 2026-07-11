import { useEffect, useState, type RefObject } from "react";

type Callback = (visible: boolean) => void;

const subs = new WeakMap<Element, Callback>();
let observer: IntersectionObserver | null = null;

function ensureObserver(): IntersectionObserver {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const cb = subs.get(e.target);
        if (cb) cb(e.isIntersecting);
      }
    },
    { rootMargin: "100px" },
  );
  return observer;
}

export function observe(el: Element, cb: Callback): () => void {
  const o = ensureObserver();
  subs.set(el, cb);
  o.observe(el);
  return () => {
    o.unobserve(el);
    subs.delete(el);
  };
}

export function useInViewport(ref: RefObject<Element | null>, initial = false): boolean {
  const [inView, setInView] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observe(el, setInView);
  }, [ref]);
  return inView;
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(typeof document === "undefined" ? true : !document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}
