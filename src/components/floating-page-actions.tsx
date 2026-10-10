import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Keep page actions aligned with their page as the navigation rail changes size. */
export function FloatingPageActions({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    const page = bar?.closest("main");
    if (!bar) return;
    const align = () => {
      const bounds = page?.getBoundingClientRect();
      bar.style.left = `${Math.max(0, bounds?.left ?? 0)}px`;
      bar.style.right = `${Math.max(0, window.innerWidth - (bounds?.right ?? window.innerWidth))}px`;
      bar.style.visibility = !bounds || bounds.width > 0 ? "visible" : "hidden";
    };
    align();
    const observer = new ResizeObserver(align);
    if (page) observer.observe(page);
    const direction = new MutationObserver(align);
    direction.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"] });
    window.addEventListener("resize", align);
    return () => {
      observer.disconnect();
      direction.disconnect();
      window.removeEventListener("resize", align);
    };
  }, []);
  return (
    <div
      ref={ref}
      data-floating-page-actions
      style={{
        bottom: "calc(24px + var(--harbor-music-dock, 0px) + var(--harbor-viewport-bottom, 0px))",
        visibility: "hidden",
      }}
      className="pointer-events-none fixed inset-x-0 z-[130] flex justify-center px-4"
    >
      {children}
    </div>
  );
}
