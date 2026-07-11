import { FONT_PAIRS, type FontPairId } from "@/lib/theme";
import { Check } from "lucide-react";

import { CustomFontTiles } from "../custom-font-tiles";

export function FontPicker({
  pairValue,
  customValue,
  onPickPair,
  onPickCustom,
}: {
  pairValue: FontPairId;
  customValue: string | null;
  onPickPair: (id: FontPairId) => void;
  onPickCustom: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5">
      {Object.values(FONT_PAIRS).map((p) => {
        const active = pairValue === p.id && !customValue;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPickPair(p.id)}
            className={`relative flex flex-col gap-1.5 rounded-lg border p-3.5 text-start transition-colors ${
              active
                ? "border-accent/80 bg-accent-soft"
                : "border-edge-soft bg-canvas/40 hover:border-edge hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[22px] leading-tight" style={{ fontFamily: p.display, fontWeight: 600 }}>
                Harbor
              </span>
              {active && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-canvas">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </div>
            <span className="truncate text-[13.5px] text-ink-muted" style={{ fontFamily: p.sans }}>
              Pick up an episode
            </span>
            <span className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">{p.name}</span>
          </button>
        );
      })}

      <CustomFontTiles compact activeId={customValue} onSelect={onPickCustom} onClear={() => onPickPair(pairValue)} />
    </div>
  );
}
