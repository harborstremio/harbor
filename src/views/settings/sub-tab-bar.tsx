import { useLayoutEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { stripArrowKeys } from "./shared";
import type { SubTab } from "./sub-tabs";

const COUNT_BADGE =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] tabular-nums transition-colors";

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

    const track = to.offsetParent as HTMLElement | null;
    const trackWidth = track ? track.clientWidth : 0;
    const rtl = track ? getComputedStyle(track).direction === "rtl" : false;
    const startOf = (el: HTMLElement) =>
      rtl ? trackWidth - el.offsetLeft - el.offsetWidth : el.offsetLeft;

    const toStart = startOf(to);
    const toWidth = to.offsetWidth;

    bar.style.insetInlineStart = `${toStart}px`;
    bar.style.top = `${to.offsetTop + to.offsetHeight - 2}px`;
    bar.style.width = `${toWidth}px`;
    bar.style.opacity = "1";

    if (firstPaint || !from || from === to) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const fromStart = startOf(from);
    const fromWidth = from.offsetWidth;

    if (from.offsetTop === to.offsetTop) {
      const edge = Math.min(fromStart, toStart);
      const far = Math.max(fromStart + fromWidth, toStart + toWidth);
      const base = to.offsetTop + to.offsetHeight - 2;
      bar.animate(
        [
          {
            insetInlineStart: `${fromStart}px`,
            top: `${base}px`,
            width: `${fromWidth}px`,
            height: "2px",
          },
          {
            insetInlineStart: `${edge}px`,
            top: `${base - 1}px`,
            width: `${far - edge}px`,
            height: "3px",
            offset: 0.45,
          },
          {
            insetInlineStart: `${toStart}px`,
            top: `${base}px`,
            width: `${toWidth + 5}px`,
            height: "2px",
            offset: 0.76,
          },
          {
            insetInlineStart: `${toStart}px`,
            top: `${base}px`,
            width: `${toWidth}px`,
            height: "2px",
          },
        ],
        { duration: 460, easing: "ease-in-out" },
      );
    } else {
      bar.animate(
        [
          {
            insetInlineStart: `${fromStart}px`,
            top: `${from.offsetTop + from.offsetHeight - 2}px`,
            width: `${fromWidth}px`,
          },
          {
            insetInlineStart: `${toStart}px`,
            top: `${to.offsetTop + to.offsetHeight - 2}px`,
            width: `${toWidth}px`,
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
    <div
      onKeyDown={stripArrowKeys(btnRefs, (i) => onChange(tabs[i].id))}
      className="relative flex flex-wrap items-center gap-x-6 gap-y-2"
    >
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
            className={`flex h-11 items-center gap-2 whitespace-nowrap text-[15.5px] font-semibold leading-[22px] transition-colors duration-200 ${
              on ? "text-ink" : "text-ink-subtle hover:text-ink-muted"
            }`}
          >
            {tab.icon && (
              <img
                src={tab.icon}
                alt=""
                draggable={false}
                className={`h-5 w-5 shrink-0 rounded-[6px] object-contain transition duration-200 ${
                  on ? "opacity-100" : "opacity-55 grayscale"
                }`}
              />
            )}
            {t(tab.label)}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`${COUNT_BADGE} ${
                  on ? "bg-accent-soft text-accent" : "bg-elevated text-ink-subtle"
                }`}
              >
                {tab.count}
              </span>
            )}
            {tab.dot && (
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-success" />
            )}
          </button>
        );
      })}
    </div>
  );
}
