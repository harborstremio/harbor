import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Check } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import type { SubCue } from "@/lib/subtitles/parser";
import type { SyncPoint, SyncSegment } from "@/lib/subtitles/text-sync";

export function TextSyncList({
  cues,
  activeIndex,
  points,
  segments,
  rangeStart,
  rangeEnd,
  sectionMode,
  query,
  onSyncHere,
  onSeek,
  onRangeStart,
  onRangeEnd,
}: {
  cues: SubCue[];
  activeIndex: number | null;
  points: SyncPoint[];
  segments: SyncSegment[];
  rangeStart: number | null;
  rangeEnd: number | null;
  sectionMode: boolean;
  query: string;
  onSyncHere: (i: number) => void;
  onSeek: (i: number) => void;
  onRangeStart: (i: number) => void;
  onRangeEnd: (i: number) => void;
}) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [following, setFollowing] = useState(true);
  const didInit = useRef(false);
  const programmatic = useRef(false);
  const guardTimer = useRef<number | null>(null);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const inSegment = useMemo(() => {
    const s = new Set<number>();
    for (const seg of segments) for (let i = seg.startIdx; i <= seg.endIdx; i++) s.add(i);
    return s;
  }, [segments]);

  const pointNum = useMemo(() => {
    const m = new Map<number, number>();
    points.forEach((p, i) => m.set(p.t, i + 1));
    return m;
  }, [points]);

  const firstMatch = useMemo(() => {
    if (!q) return -1;
    return cues.findIndex((c) => c.text.toLowerCase().includes(q));
  }, [cues, q]);

  const lo = rangeStart != null && rangeEnd != null ? Math.min(rangeStart, rangeEnd) : null;
  const hi = rangeStart != null && rangeEnd != null ? Math.max(rangeStart, rangeEnd) : null;

  const scrollToIndex = useCallback((idx: number, behavior: ScrollBehavior) => {
    const el = rowRefs.current[idx];
    if (!el) return;
    programmatic.current = true;
    el.scrollIntoView({ block: "center", behavior });
    if (guardTimer.current) window.clearTimeout(guardTimer.current);
    guardTimer.current = window.setTimeout(() => {
      programmatic.current = false;
    }, 700);
  }, []);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onScroll = () => {
      if (!programmatic.current) setFollowing(false);
    };
    c.addEventListener("scroll", onScroll, { passive: true });
    return () => c.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!searching) return;
    setFollowing(false);
    if (firstMatch >= 0) scrollToIndex(firstMatch, "smooth");
  }, [searching, firstMatch, scrollToIndex]);

  useEffect(() => {
    if (searching || activeIndex == null) return;
    if (!didInit.current) {
      scrollToIndex(activeIndex, "auto");
      didInit.current = true;
      return;
    }
    if (!following) return;
    const el = rowRefs.current[activeIndex];
    const c = containerRef.current;
    if (!el || !c) return;
    const cr = c.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const margin = 100;
    if (er.top < cr.top + margin || er.bottom > cr.bottom - margin) {
      scrollToIndex(activeIndex, "smooth");
    }
  }, [activeIndex, following, searching, scrollToIndex]);

  useEffect(() => {
    setSelected(null);
  }, [sectionMode]);

  const jumpToNow = () => {
    if (activeIndex == null) return;
    setFollowing(true);
    scrollToIndex(activeIndex, "smooth");
  };

  const handleRowClick = (i: number) => {
    if (sectionMode) {
      if (rangeStart == null) onRangeStart(i);
      else if (rangeEnd == null) onRangeEnd(i);
      else setSelected((prev) => (prev === i ? null : i));
      return;
    }
    setSelected((prev) => (prev === i ? null : i));
  };

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="flex h-full flex-col overflow-y-auto">
        {cues.map((cue, i) => {
          const isActive = i === activeIndex;
          const inRange = lo != null && hi != null && i >= lo && i <= hi;
          const fixed = inSegment.has(i);
          const isSelected = selected === i;
          const isMatch = searching && cue.text.toLowerCase().includes(q);
          const pt = pointNum.get(cue.start);
          return (
            <div
              key={`${cue.start}-${i}`}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
            >
              <button
                type="button"
                onClick={() => handleRowClick(i)}
                aria-current={isActive ? "true" : undefined}
                aria-pressed={isSelected}
                dir="auto"
                className={`flex w-full items-start gap-4 border-b border-edge-soft/40 px-5 py-3.5 text-start transition-colors ${
                  isActive
                    ? "bg-accent/12"
                    : inRange
                      ? "bg-elevated"
                      : isMatch
                        ? "bg-accent/[0.08] ring-1 ring-inset ring-accent/35"
                        : "hover:bg-elevated/60"
                }`}
              >
                <span
                  className={`mt-1 w-12 shrink-0 text-[12px] tabular-nums ${
                    isActive ? "font-semibold text-accent" : "text-ink-subtle"
                  }`}
                >
                  {fmtTime(cue.start)}
                </span>
                <span
                  className={`flex-1 whitespace-pre-wrap text-[15.5px] leading-relaxed ${
                    isActive ? "font-medium text-ink" : "text-ink-muted"
                  }`}
                >
                  {highlight(cue.text, q)}
                </span>
                <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                  {pt != null && (
                    <span
                      title={pt === 1 ? t("Aligned here") : t("Drift fixed")}
                      className="flex h-5 items-center justify-center whitespace-nowrap rounded-full bg-accent/20 px-2 text-[10px] font-bold text-accent ring-1 ring-accent/35"
                    >
                      {pt === 1 ? t("Aligned") : t("Drift fixed")}
                    </span>
                  )}
                  {isActive ? (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-canvas">
                      {t("Now")}
                    </span>
                  ) : fixed ? (
                    <Check size={15} className="text-accent/70" />
                  ) : null}
                </div>
              </button>
              {isSelected && (
                <div className="flex items-center gap-2.5 bg-elevated/50 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      onSyncHere(i);
                      setSelected(null);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[13.5px] font-semibold text-canvas transition-transform active:scale-95"
                  >
                    <Check size={15} strokeWidth={2.6} />
                    {t("Align to now")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSeek(i)}
                    className="flex items-center gap-2 rounded-xl bg-raised px-4 py-2 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    <Play size={13} />
                    {t("Jump here")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!following && !searching && activeIndex != null && (
        <button
          type="button"
          onClick={jumpToNow}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-canvas shadow-[0_10px_28px_-6px_rgba(0,0,0,0.6)] transition-transform active:scale-95"
        >
          <ArrowDown size={14} strokeWidth={2.6} />
          {t("Jump to now")}
        </button>
      )}
    </div>
  );
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      out.push(text.slice(i));
      break;
    }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark key={key++} className="rounded-[3px] bg-accent/30 px-0.5 text-ink">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return out;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
