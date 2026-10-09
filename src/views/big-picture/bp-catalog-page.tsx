import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { BpRail, type BpRailEntry } from "./bp-rail";
import { useBpRail } from "./use-bp-rail";
import { useBpLayoutReflow } from "./use-bp-row-layout";

export type BpPagePhase = "nav" | "hero" | "row";

export type BpHeroState = { phase: BpPagePhase; activeRow: number };

function bpRootAboveThePage(page: HTMLElement): HTMLElement {
  return page.closest<HTMLElement>("[data-bp-root]") ?? page;
}

function bpPhaseOf(target: Element | null): BpPagePhase | null {
  if (!target || target === document.body) return null;
  if (target.closest("[data-bp-dialog]")) return null;
  if (target.closest("[data-bp-top-bar]")) return "nav";
  if (target.closest("[data-bp-hero]")) return "hero";
  return "row";
}

export function useBpPagePhase(ref: RefObject<HTMLElement | null>): BpPagePhase {
  const [phase, setPhase] = useState<BpPagePhase>("hero");
  useEffect(() => {
    const page = ref.current;
    if (!page) return;
    const host = bpRootAboveThePage(page);
    const seeded = bpPhaseOf(document.activeElement);
    if (seeded) setPhase(seeded);
    const onFocus = (e: FocusEvent) => {
      const next = bpPhaseOf(e.target instanceof HTMLElement ? e.target : null);
      if (next) setPhase(next);
    };
    host.addEventListener("focusin", onFocus);
    return () => host.removeEventListener("focusin", onFocus);
  }, [ref]);
  return phase;
}

export function BpCatalogPage({
  routeKey,
  signature,
  entries,
  hero,
  skeleton,
}: {
  routeKey: string;
  signature: string;
  entries: readonly BpRailEntry[];
  hero: (state: BpHeroState) => ReactNode;
  skeleton?: ReactNode;
}) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const phase = useBpPagePhase(pageRef);
  const { railRef, activeRow, railShift } = useBpRail(signature);
  useBpLayoutReflow({ railRef, signature, routeKey });

  return (
    <div ref={pageRef} className="relative flex h-full flex-col">
      <div data-bp-hero className="relative z-20 shrink-0">
        {hero({ phase, activeRow })}
      </div>
      {skeleton && entries.length === 0 ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">{skeleton}</div>
      ) : (
        <BpRail railRef={railRef} entries={entries} activeRow={activeRow} railShift={railShift} />
      )}
    </div>
  );
}
