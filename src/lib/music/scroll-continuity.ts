import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const SETTLE_MS = 1800;
const NEAR = 2;
const DEPTH = 32;
const PATIENCE = 40;
const INTERRUPTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
export const MUSIC_SCROLL_POSITION_EVENT = "harbor:music-scroll-position";

function position(el: HTMLElement, top: number): void {
  el.scrollTo({ top, behavior: "instant" });
  // Child layout effects run first. Recheck sticky headers after the parent restores
  // the destination scroll position, before the browser paints the new page.
  el.dispatchEvent(new Event(MUSIC_SCROLL_POSITION_EVENT));
}

type Layer = { key: string; group: string; top: number };
type Aim = { layer: Layer; top: number };
type Session = { clear: () => void };

let session: Session | null = null;

export function resetMusicScroll(): void {
  session?.clear();
}

function groupOf(key: string): string {
  const cut = key.indexOf("|");
  return cut === -1 ? key : key.slice(0, cut);
}

function settle(el: HTMLElement, target: number, done: () => void): () => void {
  const deadline = performance.now() + SETTLE_MS;
  let frame = 0;
  let over = false;
  const stop = () => {
    if (over) return;
    over = true;
    if (frame) cancelAnimationFrame(frame);
    for (const name of INTERRUPTS) window.removeEventListener(name, stop, true);
    done();
  };
  let last = -1;
  let stable = 0;
  const step = () => {
    frame = 0;
    if (over) return;
    const height = el.clientHeight;
    const reach = el.scrollHeight - height;
    if (height > 0) position(el, Math.min(target, Math.max(0, reach)));
    stable = reach === last ? stable + 1 : 0;
    last = reach;
    if (
      (height > 0 && reach >= target - NEAR) ||
      stable > PATIENCE ||
      performance.now() > deadline
    ) {
      stop();
      return;
    }
    frame = requestAnimationFrame(step);
  };
  for (const name of INTERRUPTS)
    window.addEventListener(name, stop, { capture: true, passive: true });
  step();
  return stop;
}

export function useMusicScrollContinuity(ref: RefObject<HTMLElement | null>, key: string): void {
  const layers = useRef<Layer[]>([{ key, group: groupOf(key), top: 0 }]);
  const offset = useRef(0);
  const seen = useRef(key);
  const running = useRef<(() => void) | null>(null);
  const aim = useRef<Aim | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const track = () => {
      if (el.clientHeight > 0) offset.current = el.scrollTop;
    };
    el.addEventListener("scroll", track, { passive: true });
    return () => el.removeEventListener("scroll", track);
  }, [ref]);

  useEffect(() => {
    const mine: Session = {
      clear: () => {
        running.current?.();
        running.current = null;
        layers.current = [{ key: seen.current, group: groupOf(seen.current), top: 0 }];
        offset.current = 0;
        const el = ref.current;
        if (el) position(el, 0);
      },
    };
    session = mine;
    return () => {
      if (session === mine) session = null;
      running.current?.();
      running.current = null;
    };
  }, [ref]);

  useLayoutEffect(() => {
    const from = seen.current;
    seen.current = key;
    if (from === key) return;
    const el = ref.current;
    if (!el) return;

    const stack = layers.current;
    const head = stack.length > 0 ? stack[stack.length - 1] : null;
    const flying = aim.current;
    if (head && head.key === from)
      head.top = flying && flying.layer === head ? flying.top : offset.current;

    const group = groupOf(key);
    if (head && head.group === group) {
      head.key = key;
      return;
    }

    running.current?.();
    running.current = null;

    let found = -1;
    for (let index = stack.length - 1; index >= 0; index -= 1)
      if (stack[index].key === key) {
        found = index;
        break;
      }

    if (found === -1) {
      stack.push({ key, group, top: 0 });
      if (stack.length > DEPTH) stack.splice(0, stack.length - DEPTH);
      offset.current = 0;
      position(el, 0);
      return;
    }

    stack.length = found + 1;
    const layer = stack[found];
    const target = layer.top;
    offset.current = target;
    if (target <= NEAR) {
      position(el, 0);
      return;
    }
    aim.current = { layer, top: target };
    running.current = settle(el, target, () => {
      aim.current = null;
    });
  }, [key, ref]);
}
