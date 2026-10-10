import { Info } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { RankSource } from "@/lib/harbor-rank";

type Tab = { source: RankSource; label: string; provenance: string };

const TABS: Tab[] = [
  {
    source: "harbor",
    label: "Harbor Rank",
    provenance: "Our all-time ranking of a body of work, fully explained.",
  },
  {
    source: "trending",
    label: "Trending",
    provenance: "People from the week's hottest titles, weighted by what is being talked about.",
  },
  {
    source: "rising",
    label: "Rising Stars",
    provenance: "Breakout talent from this week's hottest titles, before they are household names.",
  },
  {
    source: "contenders",
    label: "Contenders",
    provenance: "In the running this awards season, from the latest nominations and wins.",
  },
  {
    source: "tmdb",
    label: "Top on TMDB",
    provenance: "Steady popularity across TMDB right now.",
  },
  {
    source: "imdb",
    label: "Top on IMDb",
    provenance: "Built from IMDb's public datasets. Career ratings volume.",
  },
  {
    source: "consensus",
    label: "Consensus",
    provenance:
      "A blend of the sources above by percentile. Degrades gracefully when one is missing.",
  },
];

export function PeopleSourceSwitch({
  source,
  sources,
  onSource,
  onExplain,
}: {
  source: RankSource;
  sources: RankSource[] | null;
  onSource: (source: RankSource) => void;
  onExplain: () => void;
}) {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [armed, setArmed] = useState(false);

  const visible = useMemo(() => {
    if (!sources || sources.length === 0) return TABS;
    const allowed = new Set<RankSource>([...sources, source]);
    return TABS.filter((tab) => allowed.has(tab.source));
  }, [sources, source]);

  const measure = useCallback(() => {
    const list = listRef.current;
    const index = visible.findIndex((tab) => tab.source === source);
    const btn = btnRefs.current[index];
    if (!list || !btn) return;
    const listBox = list.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    const left = btnBox.left - listBox.left;
    const width = btnBox.width;
    setIndicator((prev) => (prev.left === left && prev.width === width ? prev : { left, width }));
  }, [source, visible]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(list);
    for (const btn of btnRefs.current) if (btn) ro.observe(btn);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    if (indicator.width === 0 || armed) return;
    const raf = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(raf);
  }, [indicator.width, armed]);

  const provenance = visible.find((tab) => tab.source === source)?.provenance ?? "";

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3 pt-3">
        <div
          ref={listRef}
          role="tablist"
          aria-label={t("Ranking source")}
          className="relative flex flex-wrap items-center gap-1"
        >
          {visible.map((tab, i) => {
            const active = tab.source === source;
            return (
              <button
                key={tab.source}
                ref={(node) => {
                  btnRefs.current[i] = node;
                }}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onSource(tab.source)}
                className={`flex min-h-[44px] items-center rounded-md px-3 text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none ${
                  active ? "text-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                {t(tab.label)}
              </button>
            );
          })}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-accent ${
              armed ? "transition-[left,width] duration-250 ease-out motion-reduce:transition-none" : ""
            }`}
            style={{ left: indicator.left, width: indicator.width }}
          />
        </div>

        <button
          type="button"
          onClick={onExplain}
          aria-label={t("How Harbor Rank works")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-subtle ring-1 ring-edge-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
        >
          <Info size={17} strokeWidth={2} />
        </button>
      </div>

      <p
        key={source}
        className="pb-3 pt-1.5 text-[12.5px] text-ink-subtle animate-in fade-in duration-150 motion-reduce:animate-none"
      >
        {t(provenance)}
      </p>
    </div>
  );
}
