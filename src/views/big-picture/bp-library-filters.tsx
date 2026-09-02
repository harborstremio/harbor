import { useEffect, useRef } from "react";
import { pushBpBack } from "./bp-back";
import { BpChip, BpChipRow } from "./bp-library-chips";
import { useBpT } from "./bp-i18n";
import { bpFocusables, currentBpFocus, setBpFocus } from "./use-bp-focus";

export type BpFilterOption = { id: string; label: string; count?: number };

export type BpFilterGroup = {
  key: string;
  heading: string;
  options: BpFilterOption[];
  active: string;
  selected?: (id: string) => boolean;
  onPick: (id: string) => void;
};

/**
 * The library's filters, as labelled rows rather than as one long strip.
 *
 * This replaced a single horizontally scrolling track that held up to eighteen
 * focusables: All plus every list, a divider, three types, a divider, three
 * sorts, a divider, two groupings, a divider, two views, a divider, Search and
 * Refresh. bpTrackScope confines horizontal movement to the track, so Refresh
 * was eighteen Right presses away with nothing off screen to say so, and the
 * only structure was BpChipDivider, a 1px aria-hidden span that a screen reader
 * cannot see and a viewer across a room cannot either. That is a mouse filter
 * bar rendered at ten feet.
 *
 * Here every group is its own row with a real heading, so Up and Down step
 * between kinds of filter and Left and Right step within one. The page keeps two
 * focus stops where it had eighteen, and the active state stays readable on the
 * chip without opening anything.
 */
export function BpLibraryFilters({
  groups,
  onClose,
}: {
  groups: readonly BpFilterGroup[];
  onClose: () => void;
}) {
  const t = useBpT();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () =>
      pushBpBack(() => {
        onClose();
        return true;
      }),
    [onClose],
  );

  // Opens on what is already chosen, not on the first chip: a panel that opens
  // on "All" when you are filtered to Movies makes you hunt for your own state.
  useEffect(() => {
    const previous = currentBpFocus(document.querySelector<HTMLElement>("[data-bp-root]"));
    const cells = bpFocusables(panelRef.current);
    const chosen = cells.find((el) => el.getAttribute("aria-pressed") === "true") ?? cells[0];
    if (chosen) setBpFocus(chosen, { silent: true });
    return () => {
      if (previous?.isConnected) setBpFocus(previous, { silent: true });
    };
  }, []);

  return (
    <div
      data-bp-dialog
      role="dialog"
      aria-label={t("Filters")}
      className="absolute inset-0 z-[60] flex items-center justify-center bg-[var(--bp-void)]/88 px-[var(--bp-gutter)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div
        ref={panelRef}
        data-bp-scroll-y
        className="flex max-h-[86vh] w-[min(1100px,92vw)] flex-col gap-[clamp(10px,1.4vh,22px)] overflow-y-auto rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(18px,2.4vh,40px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <h2 className="font-display text-[clamp(20px,3.1vh,42px)] font-semibold tracking-[-0.02em] text-ink">
          {t("Filters")}
        </h2>

        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-[clamp(4px,0.7vh,11px)]">
            <h3 className="text-[clamp(11px,1.5vh,17px)] font-bold uppercase tracking-[0.18em] text-ink-subtle">
              {group.heading}
            </h3>
            <BpChipRow flush>
              {group.options.map((option) => (
                <BpChip
                  key={option.id}
                  label={option.label}
                  count={option.count}
                  selected={group.selected?.(option.id) ?? group.active === option.id}
                  onSelect={() => group.onPick(option.id)}
                />
              ))}
            </BpChipRow>
          </div>
        ))}

        <BpChipRow flush>
          <BpChip label={t("Done")} selected onSelect={onClose} />
        </BpChipRow>
      </div>
    </div>
  );
}
