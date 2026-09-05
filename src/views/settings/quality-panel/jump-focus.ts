import { tvFocus } from "@/lib/keyboard-navigation";
import { getFocusableInZone, navOwnsFocus } from "@/lib/keyboard-navigation/geometry";

const MAX_FRAMES = 30;

export function focusJumpTarget(from: HTMLElement) {
  if (!navOwnsFocus(from)) return;
  const scroller = from.closest<HTMLElement>(".hset-main");
  if (!scroller) return;
  let frames = 0;
  const settle = () => {
    const gone = !from.isConnected;
    const first = gone ? getFocusableInZone("content", scroller)[0] : undefined;
    if (first) {
      tvFocus(first);
      return;
    }
    if (++frames < MAX_FRAMES) requestAnimationFrame(settle);
  };
  requestAnimationFrame(settle);
}
