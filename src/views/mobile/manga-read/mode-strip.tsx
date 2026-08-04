import { useEffect, useRef } from "react";
import { ProxiedImg } from "./proxied-img";

export function ModeStrip({
  pages,
  initialPage,
  onPageChange,
  onToggleChrome,
}: {
  pages: string[];
  initialPage: number;
  onPageChange: (p: number) => void;
  onToggleChrome: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const els = useRef<Array<HTMLDivElement | null>>([]);
  const didScroll = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.page);
          if (Number.isFinite(i)) onPageChange(i);
        }
      },
      { root, rootMargin: "-45% 0px -45% 0px" },
    );
    els.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [pages, onPageChange]);

  useEffect(() => {
    if (didScroll.current || pages.length === 0) return;
    didScroll.current = true;
    if (initialPage <= 0) return;
    els.current[initialPage]?.scrollIntoView({ block: "start" });
  }, [pages, initialPage]);

  return (
    <div
      ref={rootRef}
      className="h-full w-full overflow-y-auto overscroll-contain"
      onClick={onToggleChrome}
    >
      <div
        className="flex flex-col items-center"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 108px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
        }}
      >
        {pages.map((url, i) => (
          <div
            key={`${i}:${url}`}
            data-page={i}
            ref={(el) => {
              els.current[i] = el;
            }}
            className="min-h-[40vh] w-full bg-[#0b0b0d]"
          >
            <ProxiedImg url={url} className="block w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
