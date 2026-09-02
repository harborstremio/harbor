import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Ban, Bookmark, BookmarkCheck, Clock, Info, ListPlus, type LucideIcon } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useListsContaining } from "@/lib/custom-lists";
import { SFX } from "@/lib/sfx";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { BP_ACTION_RING as FOCUS_RING, BP_ACTION_SOLID } from "../bp-action-style";
import { useBpT } from "../bp-i18n";
import { BpListDialog } from "../bp-list-dialog";
import type { BpQueueEntry } from "./use-bp-queue";

const SIZE = "clamp(58px,6.6vh,80px)";

// bp-tokens.ts:77 gives every unfocused [data-bp-row] content-visibility:auto
// with a 340px intrinsic size, sized for a poster row. This bar is permanently
// on screen, so the skip buys nothing and 340px of reserved height would shove
// it through the floor the instant the ring steps up to the deck. Inline beats
// the sheet, and unskip() in bp-focus-core leaves a row that already carries the
// inline value alone, so the focus engine is unaffected.
//
// marginInline goes with it. That sheet rule pairs the padding with an equal
// negative margin, which only lands content on the gutter when the PARENT
// supplies the gutter padding, the way bp-detail.tsx:279 does. The queue's rail
// parent is a bare absolute flex column, so leaving the bleed on puts the Play
// pill at x=0: a full gutter left of the title above it, and inside the cut-off
// region once bpOverscan is non-zero.
const ROW_STYLE: CSSProperties = { contentVisibility: "visible", marginInline: 0 };

const ACTIVE_CHIP =
  "border-transparent bg-[var(--bp-on)] text-ink";
const REST_CHIP = "border-[var(--bp-edge-2)] bg-[var(--bp-glass)] text-ink";

export type BpQueueAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  filled?: boolean;
  onPress: () => void;
};

/**
 * The five rounds beside the primary pill.
 *
 * Save and Add to list resolve their own live state here. Details, Skip and Not
 * interested are raised: the pool belongs to the surface, and removing an entry
 * has to pick the next id before the item leaves the pool, which this hook
 * cannot see.
 *
 * No mark-watched. markMetaWatched on a series writes every released episode
 * through setManualWatchedMany, and it would sit one press away from Play on a
 * track the user scans with a held direction, in a shell that has no undo.
 */
export function useBpQueueActions(p: {
  entry: BpQueueEntry;
  onDetails: () => void;
  onSkip: () => void;
  onBlock: () => void;
  onLists: () => void;
}): BpQueueAction[] {
  const t = useBpT();
  const meta = p.entry.meta;
  const saved = useInWatchlist(meta.id);
  // A Set, not an array. useListsContaining returns Set<string>, so .length here
  // is undefined and the active state would silently never light.
  const inLists = useListsContaining(meta.id).size > 0;

  return [
    {
      key: "save",
      label: saved ? t("Saved") : t("Save"),
      icon: saved ? BookmarkCheck : Bookmark,
      active: saved,
      onPress: () =>
        toggleWatchlist({
          id: meta.id,
          type: meta.type,
          name: meta.name,
          poster: meta.poster,
        }),
    },
    {
      key: "details",
      label: t("Details"),
      icon: Info,
      onPress: p.onDetails,
    },
    {
      key: "lists",
      label: t("Add to list"),
      icon: ListPlus,
      active: inLists,
      onPress: p.onLists,
    },
    {
      key: "skip",
      label: t("Skip"),
      icon: Clock,
      onPress: p.onSkip,
    },
    {
      key: "block",
      label: t("Not interested"),
      icon: Ban,
      onPress: p.onBlock,
    },
  ];
}

function BpQueueRound({
  action,
  onHint,
}: {
  action: BpQueueAction;
  onHint: (label: string) => void;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-restore-key={`bp-queue-rail:${action.key}`}
      aria-label={action.label}
      onFocus={() => onHint(action.label)}
      onClick={() => {
        SFX.click();
        action.onPress();
      }}
      style={{ width: SIZE, height: SIZE }}
      className={`flex shrink-0 items-center justify-center rounded-full border ${
        action.active ? ACTIVE_CHIP : REST_CHIP
      } ${FOCUS_RING}`}
    >
      <Icon
        size={24}
        strokeWidth={action.filled ? 0 : 2.1}
        fill={action.filled ? "currentColor" : "none"}
      />
    </button>
  );
}

/**
 * The persistent action rail under the queue art.
 *
 * Renders the [data-bp-row] only. The [data-bp-rail-row="1"] wrapper and the
 * bottom clearance over the hint bar belong to the surface, which has to hold
 * that index with a chip row in the three non-ready states so the rail indices
 * stay contiguous.
 */
export function BpQueueRail({
  entry,
  onPlay,
  onDetails,
  onSkip,
  onBlock,
  onDialog,
}: {
  entry: BpQueueEntry;
  onPlay: () => void;
  onDetails: () => void;
  onSkip: () => void;
  onBlock: () => void;
  onDialog: (open: boolean) => void;
}) {
  const t = useBpT();
  const [hint, setHint] = useState("");
  const [listsOpen, setListsOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const meta = entry.meta;

  const dialogRef = useRef(onDialog);
  dialogRef.current = onDialog;

  // Never in place as the last resort. A sheet left inside this row sits under a
  // [data-bp-rail-row], and bpRailStep (bp-focus-core.ts:353) reads the real DOM
  // before any scope restriction, so Up on a list chip would step to the deck
  // behind the scrim and strand the ring off-dialog.
  useEffect(() => {
    const from = sectionRef.current;
    setHost(
      from?.closest<HTMLElement>("[data-bp-dialog]") ??
        document.querySelector<HTMLElement>("[data-bp-root]"),
    );
  }, []);

  // One bracket, both edges. Raising on press and lowering on close would leave
  // the surface's arrow handler stood down forever if this row unmounts under an
  // open sheet, which a block landing on the last entry does.
  useEffect(() => {
    if (!listsOpen) return;
    dialogRef.current(true);
    return () => dialogRef.current(false);
  }, [listsOpen]);

  useEffect(() => setListsOpen(false), [meta.id]);

  const actions = useBpQueueActions({
    entry,
    onDetails,
    onSkip,
    onBlock,
    onLists: () => setListsOpen(true),
  });

  /* Never mounted inside the section. Two separate breakages if it is:
     bp-tokens.ts:71 makes every [data-bp-row] position:relative, so the sheet's
     absolute inset-0 scrim would box itself into the rail strip; and a chip
     under a [data-bp-rail-row] gives bpRailStep a row to resolve, so Up inside
     the sheet would step to the deck behind it and strand the ring off-dialog.
     Parked on the overlay root instead, exactly where bp-detail.tsx:355 puts it. */
  const sheet = listsOpen ? (
    <BpListDialog
      item={{ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster }}
      onClose={() => setListsOpen(false)}
    />
  ) : null;

  return (
    <>
      <section ref={sectionRef} data-bp-row data-bp-row-key="queue-rail" style={ROW_STYLE}>
        <div
          data-bp-scroll-x
          className="flex items-center gap-[clamp(18px,1.6vw,32px)] overflow-x-auto py-[34px] ps-[26px] pe-[26px] -my-[34px] -ms-[26px] -me-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            data-bp-focusable
            data-bp-restore-key="bp-queue-rail:play"
            onFocus={() => setHint("")}
            onClick={() => {
              SFX.click();
              onPlay();
            }}
            style={{ height: SIZE }}
            className={`flex shrink-0 items-center gap-[clamp(10px,0.9vw,16px)] px-[clamp(30px,2.6vw,52px)] text-[clamp(16px,2.2vh,26px)] ${BP_ACTION_SOLID} ${FOCUS_RING}`}
          >
            <Play size={24} className="fill-current" strokeWidth={0} />
            {t("Play tonight")}
          </button>

          <div className="flex shrink-0 items-center gap-[clamp(9px,0.8vw,16px)]">
            {actions.map((a) => (
              <BpQueueRound key={a.key} action={a} onHint={setHint} />
            ))}
          </div>
        </div>

        {/* Non-breaking, never a plain space: a collapsible one lets the line box
            vanish and bounces the whole rail baseline every time the ring reaches
            the pill, which is the one cell that clears the hint. */}
        <p className="pt-[clamp(9px,1.1vh,17px)] text-[clamp(12px,1.6vh,19px)] font-semibold tracking-[0.04em] text-ink-subtle">
          {hint || " "}
        </p>
      </section>

      {sheet && (host ? createPortal(sheet, host) : sheet)}
    </>
  );
}
