import { useEffect, useState } from "react";

function zOf(el: HTMLElement): number {
  const z = Number.parseInt(getComputedStyle(el).zIndex, 10);
  return Number.isFinite(z) ? z : 0;
}

// A full-page Big Picture surface is modal by behaviour but not by DOM: the
// route it covers stays mounted with live rects and its own data-bp-autofocus,
// so neither the focus engine nor a screen reader would treat it as gone.
// data-bp-dialog alone only narrows arrow keys; inert is what makes the claim true.
//
// `opaque` adds the rendering half, and it uses content-visibility, not display.
// Measured on a Fire TV Stick 4K Max: unhiding <main> after display:none cost a
// 735ms median and 2475ms worst case and cancelled every animation in the subtree,
// so closing a sheet re-faded the route and restarted the hero Ken Burns.
// content-visibility unhid in 15ms and left the timelines alone. It also keeps the
// top bar's own box, which chromeInset() measures, so the ring does not shift.
//
// Only the siblings that paint UNDER the dialog are hidden, compared against the
// dialog's own z. The shell footer raises itself to z-65 over the dialog's z-60 on
// purpose: it carries the hint bar this surface feeds through onHint.
//
// A dialog that renders inside a root child rather than as one, BpStreams mounted
// from BpDetail, declines the opaque half. Its host holds the page behind it too,
// so hiding root siblings would blank the chrome and occlude nothing.
export function useBpPageModal(opaque = false): (el: HTMLElement | null) => void {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const root = node?.closest<HTMLElement>("[data-bp-root]");
    if (!node || !root) return;
    const kids = Array.from(root.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement,
    );
    const at = kids.indexOf(node);
    const hide = opaque && at >= 0;
    const dialogZ = at < 0 ? 0 : zOf(node);
    const marked: HTMLElement[] = [];
    const hidden: HTMLElement[] = [];
    kids.forEach((child, i) => {
      if (child.contains(node) || child.hasAttribute("inert")) return;
      child.setAttribute("inert", "");
      marked.push(child);
      if (!hide) return;
      const z = zOf(child);
      if (z > dialogZ || (z === dialogZ && i > at)) return;
      child.style.setProperty("content-visibility", "hidden");
      hidden.push(child);
    });
    return () => {
      for (const el of hidden) el.style.removeProperty("content-visibility");
      for (const el of marked) el.removeAttribute("inert");
    };
  }, [node, opaque]);

  return setNode;
}
