import { useEffect, useState, type RefObject } from "react";

/**
 * One "has this tile been on screen yet" signal, shared by every per-card hook
 * that wants to hold its network back until the card is worth paying for.
 *
 * @/lib/visibility keeps exactly ONE callback per element in a WeakMap, so a
 * second observe() on the same element silently replaces the first and either
 * unsubscribe unobserves both. useBpArt already claims the tile root through it,
 * and the badge chain and the poster chain both want the same element, so this
 * module keeps a Set of callbacks per element instead of a single slot.
 */
const seen = new WeakMap<Element, Set<() => void>>();
let io: IntersectionObserver | null = null;

function observer(): IntersectionObserver {
  if (io) return io;
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const subs = seen.get(e.target);
        if (!subs) continue;
        for (const fn of [...subs]) fn();
      }
    },
    { rootMargin: "150px" },
  );
  return io;
}

/**
 * The observed element is the rail row, never the tile.
 *
 * bp-tokens puts content-visibility:auto on every [data-bp-row] without the
 * ring, a skipped subtree is invisible to IntersectionObserver, and this
 * observation is one-shot: it unobserves from inside its own callback. So a
 * tile in an unfocused row can never intersect, never fires, and is therefore
 * never unobserved. Home left about 254 of 262 observations live for the whole
 * session, each paying a geometry computation every frame: idle measured 58.1fps
 * at 5 percent blocked against 48.8fps at 21 percent.
 *
 * [data-bp-rail-row] sits above [data-bp-row], is never contained, and answers
 * the same question one row at a time instead of once per tile. The fallback to
 * the element itself keeps grids and search working, which have no rail row and
 * no containment, so they already fire and retire correctly.
 *
 * bp-ring-motion.ts hit the same trap from the other side and records it too.
 */
function bpVisibilityGate(el: HTMLElement): HTMLElement {
  return el.closest<HTMLElement>("[data-bp-rail-row]") ?? el;
}

export function onBpCardVisible(target: HTMLElement, fn: () => void): () => void {
  const el = bpVisibilityGate(target);
  const obs = observer();
  let done = false;
  const release = () => {
    done = true;
    const subs = seen.get(el);
    if (!subs) return;
    subs.delete(wrapped);
    if (subs.size === 0) {
      seen.delete(el);
      obs.unobserve(el);
    }
  };
  const wrapped = () => {
    if (done) return;
    release();
    fn();
  };
  let subs = seen.get(el);
  if (!subs) {
    subs = new Set();
    seen.set(el, subs);
    obs.observe(el);
  }
  subs.add(wrapped);
  return release;
}

/** True once the referenced element has been within 150px of the viewport. */
export function useBpCardVisible(ref?: RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(() => !ref);
  useEffect(() => {
    const el = ref?.current;
    if (!el) {
      setVisible(true);
      return;
    }
    return onBpCardVisible(el, () => setVisible(true));
  }, [ref]);
  return visible;
}
