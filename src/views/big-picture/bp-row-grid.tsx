import { useCallback, useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { HomeRow } from "@/views/home/home-types";
import { pushBpBack } from "./bp-back";
import { revealBpRows } from "./bp-focus-core";
import { BP_POSTER_COLUMNS, BpGrid, BpGridScroller } from "./bp-grid";
import { useBpT } from "./bp-i18n";
import { BpTile } from "./bp-tile";
import { bpFocusables, markBpInteracted, setBpFocus } from "./use-bp-focus";

/**
 * @param rowKey the data-bp-row-key of the row this was opened from, which is
 * the row's `lead.rowKey` and NOT necessarily row.key. Anime rows are keyed by
 * their own id and feed off a HomeRow whose key is something else entirely, so
 * deriving this from row.key would silently miss the section on the way back
 * and drop the ring onto the page's autofocus seed.
 */
export type BpRowGridTarget = { row: HomeRow; title: string; rowKey: string };

const NEAR_END_PX = 700;

/**
 * The open state behind every catalog row's see-all, plus the way back.
 *
 * Not a dialog. This replaces the rail as a full page and the top bar still
 * paints above it, so data-bp-dialog would scope the tabs out of reach. Same
 * call bp-anime's award view makes, and for the same reason.
 */
export function useBpRowGrid(): {
  target: BpRowGridTarget | null;
  open: (target: BpRowGridTarget) => void;
} {
  const [target, setTarget] = useState<BpRowGridTarget | null>(null);
  const fromRef = useRef("");

  const open = useCallback((next: BpRowGridTarget) => {
    fromRef.current = next.rowKey;
    setTarget(next);
  }, []);

  // Back is the only way out, which is the same contract bp-anime's award view
  // and Discover's overlays already teach and the hint bar already prints. A
  // Close cell here would be a fourth idiom for one press the remote has.
  useEffect(() => {
    if (!target) return;
    return pushBpBack(() => {
      setTarget(null);
      return true;
    });
  }, [target]);

  // Closing puts the ring exactly where Left off the see-all would have put it:
  // the last cell of the row it was pressed from. The see-all itself cannot be
  // the target, because bp-row-header keeps it visibility:hidden until its own
  // row holds the ring and nothing holds the ring in the frame the rail returns.
  useEffect(() => {
    if (target) return;
    const rowKey = fromRef.current;
    fromRef.current = "";
    if (!rowKey) return;
    const frame = window.requestAnimationFrame(() => {
      const root = document.querySelector<HTMLElement>("[data-bp-root]");
      const section = root?.querySelector<HTMLElement>(
        `[data-bp-row-key="${CSS.escape(rowKey)}"]`,
      );
      if (!root || !section) return;
      // Every row but the one holding the ring is content-visibility: auto, and
      // skipped content reports a zero rect and refuses focus().
      const revert = revealBpRows(root);
      const cells = bpFocusables(section);
      setBpFocus(cells[cells.length - 1] ?? null, { silent: true });
      revert();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return { target, open };
}

function dedupe(existing: Meta[], incoming: Meta[]): Meta[] {
  const seen = new Set(existing.map((m) => m.id));
  return incoming.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/**
 * One catalog row, opened out as the whole screen.
 *
 * Home's rows escape to a tab because their tab is a different page. A row on
 * Movies belongs to Movies, so it has no tab to escape to and dead-ended with a
 * shake, which was the only end of a row on the surface that answered nothing.
 * This is the answer: the same feed, paged off the row's own fetcher.
 */
export function BpRowGrid({
  target,
  onSelect,
}: {
  target: BpRowGridTarget;
  onSelect: (m: Meta) => void;
}) {
  const { row, title } = target;
  const t = useBpT();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [metas, setMetas] = useState<Meta[]>(row.metas);
  const pageRef = useRef(row.page ?? 1);
  const busyRef = useRef(false);
  const doneRef = useRef(!row.fetcher || !row.hasMore);

  const more = useCallback(async () => {
    const fetcher = row.fetcher;
    if (!fetcher || doneRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      const next = pageRef.current + 1;
      const page = await fetcher(next);
      pageRef.current = next;
      if (page.length === 0) {
        doneRef.current = true;
        return;
      }
      setMetas((prev) => {
        const fresh = dedupe(prev, page);
        if (fresh.length === 0) doneRef.current = true;
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
    } catch {
      doneRef.current = true;
    } finally {
      busyRef.current = false;
    }
  }, [row.fetcher]);

  useEffect(() => {
    const scroller = boxRef.current?.querySelector<HTMLElement>("[data-bp-scroll-y]");
    if (!scroller) return;
    const onScroll = () => {
      const left = scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight);
      if (left < NEAR_END_PX) void more();
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [more]);

  // The rail this replaced held the ring, so the ring is gone with it. Marking
  // the seed alone would leave the landing to whichever pass noticed first.
  useEffect(() => {
    markBpInteracted();
    const frame = window.requestAnimationFrame(() => {
      const first = bpFocusables(boxRef.current)[0];
      if (first) setBpFocus(first, { silent: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 flex flex-col bg-[var(--bp-void)] pb-[var(--bp-safe-y,0px)] pt-[var(--bp-page-top)]"
    >
      <div className="flex shrink-0 flex-col gap-[clamp(2px,0.4vh,6px)] px-[var(--bp-gutter)]">
        <span className="text-[clamp(9.5px,1.25vh,14px)] font-bold uppercase tracking-[0.2em] text-ink-subtle">
          {row.type === "series" ? t("Shows") : t("Movies")}
        </span>
        <h1 className="font-display text-[clamp(22px,3.6vh,50px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
          {title}
        </h1>
      </div>
      <div className="relative mt-[clamp(9px,1.3vh,20px)] flex min-h-0 flex-1 flex-col px-[var(--bp-gutter)]">
        <BpGridScroller>
          <BpGrid columns={BP_POSTER_COLUMNS}>
            {metas.map((m, i) => (
              <BpTile
                key={`${m.id}-${i}`}
                meta={m}
                onSelect={onSelect}
                autofocus={i === 0}
                fluid
              />
            ))}
          </BpGrid>
        </BpGridScroller>
      </div>
    </div>
  );
}
