import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";

/** One tooltip for the dock, without wrappers that change its responsive controls. */
export function MusicDockTooltip({ dockRef }: { dockRef: RefObject<HTMLElement | null> }) {
  const [active, setActive] = useState<{ element: HTMLElement; label: string } | null>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    let target: HTMLElement | null = null;
    let timer: number | undefined;
    let observer: MutationObserver | undefined;
    const dismiss = () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      target = null;
      setActive(null);
      setPosition(null);
    };
    const find = (node: EventTarget | null) => {
      const element = node instanceof Element ? node.closest<HTMLElement>("[data-music-tooltip]") : null;
      return element && dock.contains(element) && !element.matches(":disabled") && !element.querySelector(":disabled")
        && element.getAttribute("aria-expanded") !== "true" ? element : null;
    };
    const show = (element: HTMLElement | null) => {
      if (element === target) return;
      dismiss();
      if (!element) return;
      target = element;
      timer = window.setTimeout(() => {
        const update = () => {
          if (!element.isConnected || !element.getClientRects().length || !find(element)) { dismiss(); return; }
          const label = element.dataset.musicTooltip || element.getAttribute("aria-label");
          if (label) setActive({ element, label });
        };
        update();
        observer = new MutationObserver(update);
        observer.observe(element, { attributes: true, attributeFilter: ["data-music-tooltip", "aria-label", "aria-expanded", "disabled"] });
      }, element.classList.contains("music-dock-volume") ? 100 : 420);
    };
    const pointerOver = (event: PointerEvent) => { if (event.pointerType === "mouse") show(find(event.target)); };
    const pointerOut = (event: PointerEvent) => { if (event.pointerType === "mouse") show(find(event.relatedTarget)); };
    const focusIn = (event: FocusEvent) => show(find(event.target));
    const focusOut = (event: FocusEvent) => show(find(event.relatedTarget));
    const pointerDown = (event: Event) => {
      // Keep the percentage visible while adjusting volume; dismiss action hints on click.
      const element = find(event.target);
      if (element && !element.classList.contains("music-dock-volume")) dismiss();
    };
    const keyDown = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    dock.addEventListener("pointerover", pointerOver);
    dock.addEventListener("pointerout", pointerOut);
    dock.addEventListener("focusin", focusIn);
    dock.addEventListener("focusout", focusOut);
    dock.addEventListener("pointerdown", pointerDown);
    dock.addEventListener("click", pointerDown);
    window.addEventListener("keydown", keyDown, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      dock.removeEventListener("pointerover", pointerOver);
      dock.removeEventListener("pointerout", pointerOut);
      dock.removeEventListener("focusin", focusIn);
      dock.removeEventListener("focusout", focusOut);
      dock.removeEventListener("pointerdown", pointerDown);
      dock.removeEventListener("click", pointerDown);
      window.removeEventListener("keydown", keyDown, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [dockRef]);

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!active || !tip) return;
    const rect = active.element.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const left = Math.max(8, Math.min(center - tip.offsetWidth / 2, window.innerWidth - tip.offsetWidth - 8));
    // Align with the seek bubble above the bar, including the raised narrow-volume slider.
    const top = Math.max(8, Math.min(rect.top, dockRef.current?.getBoundingClientRect().top ?? rect.top) - tip.offsetHeight - 10);
    setPosition({ left, top, "--music-tip-arrow": `${Math.max(8, Math.min(center - left, tip.offsetWidth - 8))}px` } as CSSProperties);
  }, [active, dockRef]);

  return active && createPortal(
    <span ref={tipRef} role="tooltip" className="music-dock-control-tip"
      style={position ?? { visibility: "hidden" }}>
      {active.label}
    </span>, document.body,
  );
}
