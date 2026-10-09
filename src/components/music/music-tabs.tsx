import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useT, useUiLanguage } from "@/lib/i18n";

export type MusicTabId = "forYou" | "explore" | "library";

export const MUSIC_TABS: readonly MusicTabId[] = ["forYou", "explore", "library"];

const TAB_LABEL_KEY: Record<MusicTabId, string> = {
  forYou: "music.tab.forYou",
  explore: "music.tab.explore",
  library: "music.tab.library",
};

export function musicTabButtonId(tab: MusicTabId): string {
  return `music-tab-${tab}`;
}

export function musicTabPanelId(tab: MusicTabId): string {
  return `music-panel-${tab}`;
}

type Indicator = { left: number; width: number };

export function MusicTabs({
  value,
  onChange,
  counts,
  className = "",
}: {
  value: MusicTabId;
  onChange: (tab: MusicTabId) => void;
  counts?: Partial<Record<MusicTabId, number>>;
  className?: string;
}) {
  const t = useT();
  const language = useUiLanguage();
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-music-tab-active="true"]');
    if (!active || list.getClientRects().length === 0) {
      setIndicator(null);
      return;
    }
    const next = { left: active.offsetLeft, width: active.offsetWidth };
    setIndicator((current) =>
      current && current.left === next.left && current.width === next.width ? current : next,
    );
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, value, language]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(list);
    for (const child of Array.from(list.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure]);

  const focusTab = (index: number) => {
    const list = listRef.current;
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    if (!tabs.length) return;
    const target = tabs[((index % tabs.length) + tabs.length) % tabs.length];
    target?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const list = listRef.current;
    const rtl = list ? window.getComputedStyle(list).direction === "rtl" : false;
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === forward) {
      event.preventDefault();
      focusTab(index + 1);
      return;
    }
    if (event.key === backward) {
      event.preventDefault();
      focusTab(index - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusTab(MUSIC_TABS.length - 1);
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={t("music.sections")}
      className={`relative flex h-[45px] items-end gap-[22px] border-b border-edge-soft ${className}`}
    >
      {MUSIC_TABS.map((tab, index) => {
        const selected = tab === value;
        const count = counts?.[tab];
        const showCount = typeof count === "number" && Number.isFinite(count) && count > 0;
        return (
          <button
            key={tab}
            id={musicTabButtonId(tab)}
            type="button"
            role="tab"
            data-music-tab-active={selected ? "true" : "false"}
            aria-selected={selected}
            aria-controls={selected ? musicTabPanelId(tab) : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`flex h-[45px] items-end gap-2 pb-3 text-[13px] font-bold transition-colors duration-200 ease-out ${
              selected ? "text-ink" : "text-ink-subtle hover:text-ink"
            }`}
          >
            <span>{t(TAB_LABEL_KEY[tab])}</span>
            {showCount ? (
              <span className="font-mono text-[11px] font-medium tabular-nums text-ink-subtle">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
      {indicator ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-1px] left-0 h-0.5 rounded-full bg-accent transition-[transform,width] duration-200 ease-out"
          style={{ width: `${indicator.width}px`, transform: `translateX(${indicator.left}px)` }}
        />
      ) : null}
    </div>
  );
}
