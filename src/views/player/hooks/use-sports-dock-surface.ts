import { useLayoutEffect, type RefObject } from "react";

/** Native mpv sits below the WebView. Cut only its viewport out of the page behind it. */
export function useSportsDockSurface(active: boolean, mount: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    if (!active) return;
    const backdrop = document.querySelector<HTMLElement>("[data-harbor-native-backdrop]");
    const video = mount.current;
    if (!backdrop || !video) return;
    const previous = backdrop.style.clipPath;
    const previousBackground = backdrop.style.backgroundColor;
    // Transparent pages must not reveal the native surface outside the dock,
    // including while the OS is resizing it behind the WebView.
    backdrop.style.backgroundColor = "var(--color-canvas)";
    const update = () => {
      const outer = backdrop.getBoundingClientRect();
      const inner = video.getBoundingClientRect();
      if (inner.width <= 1 || inner.height <= 1) {
        backdrop.style.clipPath = previous;
        return;
      }
      const left = inner.left - outer.left;
      const top = inner.top - outer.top;
      const right = left + inner.width;
      const bottom = top + inner.height;
      backdrop.style.clipPath = `path(evenodd, "M0 0H${outer.width}V${outer.height}H0Z M${left} ${top}H${right}V${bottom}H${left}Z")`;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(backdrop);
    observer.observe(video);
    window.addEventListener("resize", update);
    window.addEventListener("harbor:mpv-refresh-geom", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("harbor:mpv-refresh-geom", update);
      backdrop.style.clipPath = previous;
      backdrop.style.backgroundColor = previousBackground;
    };
  }, [active, mount]);
}
