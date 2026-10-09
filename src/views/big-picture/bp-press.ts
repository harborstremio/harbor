const ATTR = "data-bp-press";

// Imperative rather than React state, and this is deliberate. The pressed tile
// is one node out of up to 262 on home; routing it through state re-renders the
// row and every card in it, which is the same argument bp-addon-row records for
// holding its focused entry in a ref.
let held: HTMLElement | null = null;
let timer = 0;

export function bpPressOff(): void {
  if (timer) {
    window.clearTimeout(timer);
    timer = 0;
  }
  if (held) {
    held.removeAttribute(ATTR);
    held = null;
  }
}

/**
 * Mark the tile under the ring as pressed.
 *
 * Only [data-bp-tile] elements answer, because the press rule in bp-tokens
 * multiplies the tile lift and there is nothing to multiply anywhere else.
 *
 * The timer is not belt and braces, it is the only thing that can clear this in
 * the common case. Selecting pushes a route, the tile unmounts, and no keyup
 * ever reaches it; and because React does not own this attribute, a tile left
 * marked would sit pressed for the rest of its life if it survived. Anything
 * that sets it must be able to give it back without help.
 */
export function bpPressOn(el: HTMLElement | null): void {
  bpPressOff();
  if (!el || !el.hasAttribute("data-bp-tile")) return;
  held = el;
  el.setAttribute(ATTR, "true");
  timer = window.setTimeout(bpPressOff, 400);
}
