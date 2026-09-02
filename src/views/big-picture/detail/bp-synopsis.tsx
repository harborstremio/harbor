import { useEffect, useRef, useState, type RefObject } from "react";

export type BpSynopsisState = {
  ref: RefObject<HTMLParagraphElement | null>;
  expanded: boolean;
  canExpand: boolean;
  toggle: () => void;
};

// The gate measures the clamped element instead of counting characters. A
// character budget and a line clamp disagree at every viewport width, and the
// side that loses is the reader: a short paragraph that still wraps past the
// clamp gets cut with no way to open it.
//
// Split from the paragraph because the control that answers it does NOT live
// under the paragraph. It used to: its own [data-bp-row] directly below
// BpDetailActions, in the same column, at the same gutter. Play is not inside a
// [data-bp-rail-row], so Down out of it falls to spatial ranking, and the chip
// sitting right underneath won every time. The lowest value control on the page
// was intercepting the single highest traffic path in the application, on every
// title with a synopsis longer than three lines. The toggle is now the last cell
// of the actions track, so Left and Right reach it and Down from Play goes
// straight to the episodes.
export function useBpSynopsis(text: string): BpSynopsisState {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    setExpanded(false);
    setCanExpand(false);
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => {
      if (el.scrollHeight - el.clientHeight > 2) setCanExpand(true);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return { ref, expanded, canExpand, toggle: () => setExpanded((v) => !v) };
}

export function BpSynopsis({ text, state }: { text: string; state: BpSynopsisState }) {
  if (!text) return null;

  return (
    <p
      ref={state.ref}
      data-bp-detail-synopsis
      className={`mt-[clamp(20px,2.4vh,38px)] max-w-[min(46vw,820px)] text-[clamp(13px,1.85vh,22px)] leading-[1.62] text-ink-subtle ${
        state.expanded ? "" : "line-clamp-3"
      }`}
    >
      {text}
    </p>
  );
}
