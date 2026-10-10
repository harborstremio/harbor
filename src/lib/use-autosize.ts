import { useLayoutEffect, type RefObject } from "react";

export function useAutosize(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  max = 320,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [ref, value, max]);
}
