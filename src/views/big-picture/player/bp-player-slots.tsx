import { Children, Fragment, isValidElement, type ReactNode } from "react";

/**
 * Where a panel mounts inside BpPlayerShell.
 *
 * stage      always live, sits over the video even while the chrome is down.
 *            Skip pills, up-next cards, connecting readouts. Not focusable by
 *            default: nothing here may hold the ring while the chrome is away.
 * top        identity zone, top of the chrome. Replaces the built-in title block.
 * transport  the bottom control bar. Replaces the built-in controls.
 * rail       the action strip above the transport. Chips that open panels.
 * panel      a full surface, one at a time, shown while panel === id.
 */
export type BpPlayerArea = "stage" | "top" | "transport" | "rail" | "panel";

export type BpPlayerSlotProps = {
  area: BpPlayerArea;
  /** Required for area="panel". This is the id openPanel() takes. */
  id?: string;
  /** Lower sorts first within an area. Defaults to 0. */
  order?: number;
  /** area="panel" only: the shell puts a chip on the rail that opens it. */
  label?: string;
  /** area="panel" only: the chip's glyph. Omit for a plain text chip. */
  icon?: ReactNode;
  /**
   * area="panel" only. Off by default: while the panel is open the shell drops
   * its key listener entirely and the panel owns the D-pad, which is what a
   * panel that portals itself out of the shell needs. Turn it on for a panel
   * that renders in place and wants the shell's spatial navigation to drive it,
   * and then do not add a listener of your own: two listeners on window both
   * act, and stopPropagation does not stop the other one.
   */
  shellNav?: boolean;
  children?: ReactNode;
};

// A marker, never rendered on its own. BpPlayerShell reads the props off the
// element and places the children itself, so a slot declared anywhere in the
// children list lands in the right region without a wrapper element of its own.
// That matters: a wrapper between a rail row and its parent breaks bpRailStep.
export function BpPlayerSlot(_props: BpPlayerSlotProps): null {
  return null;
}

export type BpPlayerSlotEntry = {
  area: BpPlayerArea;
  id: string | null;
  order: number;
  label: string | null;
  icon: ReactNode;
  shellNav: boolean;
  key: string;
  node: ReactNode;
};

function walk(children: ReactNode, out: BpPlayerSlotEntry[]): void {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    // Children.toArray flattens arrays but not fragments, and a slot wrapped in
    // one would silently never mount. Grouping slots in a fragment is the
    // obvious thing to reach for, so it has to work.
    if (child.type === Fragment) {
      walk((child.props as { children?: ReactNode }).children, out);
      continue;
    }
    if (child.type !== BpPlayerSlot) continue;
    const props = child.props as BpPlayerSlotProps;
    out.push({
      area: props.area,
      id: props.id ?? null,
      order: props.order ?? 0,
      label: props.label ?? null,
      icon: props.icon ?? null,
      shellNav: props.shellNav ?? false,
      // Identity first, position last. Children.toArray keys by position, so a
      // conditionally rendered sibling would renumber every slot after it and
      // remount a panel that never changed.
      key: props.id ? `${props.area}:${props.id}` : `${props.area}:${String(child.key ?? out.length)}`,
      node: props.children,
    });
  }
}

export function collectBpPlayerSlots(children: ReactNode): BpPlayerSlotEntry[] {
  const out: BpPlayerSlotEntry[] = [];
  walk(children, out);
  return out.sort((a, b) => a.order - b.order);
}

export function bpSlotsIn(
  slots: BpPlayerSlotEntry[],
  area: BpPlayerArea,
): BpPlayerSlotEntry[] {
  return slots.filter((s) => s.area === area);
}

export function bpPanelSlot(
  slots: BpPlayerSlotEntry[],
  panel: string | null,
): BpPlayerSlotEntry | null {
  if (!panel) return null;
  return slots.find((s) => s.area === "panel" && s.id === panel) ?? null;
}
