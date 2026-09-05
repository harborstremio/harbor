import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { SectionId } from "./shared";

type Item = { id: string; title: string };

export function SettingsJumpBar({
  scrollRef,
  activeSection,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  activeSection: SectionId;
}) {
  const t = useT();
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scrollable, setScrollable] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const lockedIdRef = useRef<string | null>(null);
  const lockTimerRef = useRef(0);
  const dragRef = useRef<{ x: number; left: number } | null>(null);
  const draggedRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const rebuild = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;
    const next: Item[] = [];
    for (const s of root.querySelectorAll<HTMLElement>('section[id^="set-"]')) {
      const title = s.querySelector("h2")?.textContent?.trim();
      if (title) next.push({ id: s.id, title });
    }
    setItems((prev) =>
      prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.title === next[i].title)
        ? prev
        : next,
    );
    setScrollable(root.scrollHeight > root.clientHeight + 80);
  }, [scrollRef]);

  useEffect(() => {
    rebuild();
    const raf = requestAnimationFrame(rebuild);
    const settle = window.setTimeout(rebuild, 180);
    const root = scrollRef.current;
    let debounce = 0;
    const obs = root
      ? new MutationObserver(() => {
          window.clearTimeout(debounce);
          debounce = window.setTimeout(rebuild, 120);
        })
      : null;
    obs?.observe(root!, { childList: true, subtree: true });
    window.addEventListener("resize", rebuild);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.clearTimeout(debounce);
      obs?.disconnect();
      window.removeEventListener("resize", rebuild);
    };
  }, [rebuild, activeSection]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || items.length === 0) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rootTop = root.getBoundingClientRect().top;
        let current = items[0].id;
        for (const it of items) {
          const el = document.getElementById(it.id);
          if (!el) continue;
          if (el.getBoundingClientRect().top - rootTop <= 140) current = it.id;
          else break;
        }
        if (lockedIdRef.current) {
          if (current === lockedIdRef.current) {
            lockedIdRef.current = null;
            setActiveId(current);
          } else {
            setActiveId(lockedIdRef.current);
          }
        } else {
          setActiveId(current);
        }
        setScrollable(root.scrollHeight > root.clientHeight + 80);
      });
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items, scrollRef]);

  useEffect(() => {
    if (!activeId || !railRef.current) return;
    railRef.current
      .querySelector<HTMLElement>(`[data-jump="${activeId}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeId]);

  if (items.length < 2 || !scrollable) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (!rail) return;
    dragRef.current = { x: e.clientX, left: rail.scrollLeft };
    draggedRef.current = false;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    const d = dragRef.current;
    if (!rail || !d) return;
    const dx = e.clientX - d.x;
    if (!draggedRef.current && Math.abs(dx) < 4) return;
    if (!draggedRef.current) {
      draggedRef.current = true;
      setDragging(true);
      rail.setPointerCapture(e.pointerId);
    }
    rail.scrollLeft = d.left - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    dragRef.current = null;
    if (rail?.hasPointerCapture(e.pointerId)) rail.releasePointerCapture(e.pointerId);
    setDragging(false);
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (!rail || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    rail.scrollLeft += e.deltaY;
  };

  const jump = (id: string) => {
    if (draggedRef.current) return;
    const el = document.getElementById(id);
    if (!el) return;
    lockedIdRef.current = id;
    window.clearTimeout(lockTimerRef.current);
    lockTimerRef.current = window.setTimeout(() => {
      lockedIdRef.current = null;
    }, 1000);
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="pointer-events-none fixed bottom-5 left-[calc(50%+144px)] z-30 flex -translate-x-1/2 justify-center px-4 rtl:left-[calc(50%-144px)]">
      <div
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
 className={`pointer-events-auto flex max-w-[min(640px,72vw)] select-none items-center gap-1 overflow-x-auto rounded-full bg-surface px-1.5 py-1.5 harbor-float backdrop-blur-xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${dragging ?"cursor-grabbing" :"cursor-grab"}`}
      >
        <span className="harbor-settings-label shrink-0 ps-2.5 pe-1.5">
          {t("On this page")}
        </span>
        {items.map((it) => {
          const on = it.id === activeId;
          return (
            <button
              key={it.id}
              type="button"
              data-jump={it.id}
              onClick={() => jump(it.id)}
              className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[15px] font-medium transition-colors ${
                on ? "bg-ink text-canvas" : "text-ink-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              {it.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
