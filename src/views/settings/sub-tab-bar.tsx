import { useLayoutEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import type { SubTab } from "./sub-tabs";

export function SubTabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: SubTab[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useT();
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const barRef = useRef<HTMLSpanElement | null>(null);
  const prevIndex = useRef(-1);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === value),
  );

  useLayoutEffect(() => {
    const bar = barRef.current;
    const to = btnRefs.current[activeIndex];
    if (!bar || !to) return;
    const from = prevIndex.current >= 0 ? btnRefs.current[prevIndex.current] : null;
    const firstPaint = prevIndex.current < 0;
    prevIndex.current = activeIndex;

    bar.style.left = `${to.offsetLeft}px`;
    bar.style.top = `${to.offsetTop + to.offsetHeight - 2}px`;
    bar.style.width = `${to.offsetWidth}px`;
    bar.style.opacity = "1";

    if (firstPaint || !from || from === to) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    if (from.offsetTop === to.offsetTop) {
      const edge = Math.min(from.offsetLeft, to.offsetLeft);
      const far = Math.max(from.offsetLeft + from.offsetWidth, to.offsetLeft + to.offsetWidth);
      bar.animate(
        [
          { left: `${from.offsetLeft}px`, width: `${from.offsetWidth}px`, height: "2px" },
          { left: `${edge}px`, width: `${far - edge}px`, height: "3px", offset: 0.45 },
          { left: `${to.offsetLeft}px`, width: `${to.offsetWidth + 5}px`, height: "2px", offset: 0.76 },
          { left: `${to.offsetLeft}px`, width: `${to.offsetWidth}px`, height: "2px" },
        ],
        { duration: 460, easing: "ease-in-out" },
      );
    } else {
      bar.animate(
        [
          {
            left: `${from.offsetLeft}px`,
            top: `${from.offsetTop + from.offsetHeight - 2}px`,
            width: `${from.offsetWidth}px`,
          },
          {
            left: `${to.offsetLeft}px`,
            top: `${to.offsetTop + to.offsetHeight - 2}px`,
            width: `${to.offsetWidth}px`,
          },
        ],
        { duration: 340, easing: "ease-in-out" },
      );
    }

    to.animate(
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(1.07, 0.93)", offset: 0.34 },
        { transform: "scale(0.98, 1.04)", offset: 0.63 },
        { transform: "scale(1, 1)" },
      ],
      { duration: 420, easing: "ease-in-out" },
    );
  }, [activeIndex, tabs.length]);

  return (
    <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2">
      <span
        ref={barRef}
        aria-hidden
        className="pointer-events-none absolute h-[2px] rounded-full bg-ink opacity-0"
        style={{ transitionProperty: "none" }}
      />
      {tabs.map((tab, i) => {
        const on = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            onClick={() => onChange(tab.id)}
            aria-pressed={on}
            className={`flex h-9 items-center gap-2 text-[13.5px] font-semibold transition-colors duration-200 ${
              on ? "text-ink" : "text-ink-subtle hover:text-ink-muted"
            }`}
          >
            {tab.icon && (
              <img
                src={tab.icon}
                alt=""
                draggable={false}
                className={`h-[17px] w-[17px] shrink-0 rounded-[3px] object-contain transition duration-200 ${
                  on ? "opacity-100" : "opacity-55 grayscale"
                }`}
              />
            )}
            {t(tab.label)}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`rounded-[3px] px-1.5 py-px text-[10.5px] font-bold tabular-nums transition-colors ${
                  on ? "bg-ink text-canvas" : "bg-elevated text-ink-subtle"
                }`}
              >
                {tab.count}
              </span>
            )}
            {tab.dot && (
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            )}
          </button>
        );
      })}
    </div>
  );
}
