import { layoutSlotCount, type Layout, type SlotChannel } from "@/lib/multiview/store";

import { Cell } from "./cell";

const GRID: Record<Layout, string> = {
  "1": "grid-cols-1 grid-rows-1",
  "2": "grid-cols-2 grid-rows-1",
  "3": "grid-cols-3 grid-rows-1",
  "2x2": "grid-cols-2 grid-rows-2",
};

export function Grid({
  layout,
  slots,
  focusIndex,
  onPick,
  onClose,
  onFocus,
  onMute,
}: {
  layout: Layout;
  slots: (SlotChannel | null)[];
  focusIndex: number;
  onPick: (slot: number) => void;
  onClose: (slot: number) => void;
  onFocus: (slot: number) => void;
  onMute: () => void;
}) {
  const count = layoutSlotCount(layout);
  return (
    <div className={`grid h-full w-full gap-2 ${GRID[layout]}`}>
      {Array.from({ length: count }, (_, i) => (
        <Cell
          key={i}
          slot={i}
          channel={slots[i] ?? null}
          focused={focusIndex === i}
          onPick={() => onPick(i)}
          onClose={() => onClose(i)}
          onFocus={() => onFocus(i)}
          onMute={onMute}
        />
      ))}
    </div>
  );
}
