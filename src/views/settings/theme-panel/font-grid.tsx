import { Check } from "lucide-react";
import { FONT_PAIRS, type FontPairId } from "@/lib/theme";
import { CustomFontTiles } from "./custom-font-tiles";

export function FontGrid({
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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Object.values(FONT_PAIRS).map((p) => {
        const active = p.id === pairValue && !customValue;
        return (
          <button
            key={p.id}
            onClick={() => onPickPair(p.id)}
            className={`flex flex-col gap-3 rounded-md border p-5 text-start transition-colors ${
              active ? "border-ink bg-elevated" : "border-edge-soft bg-elevated hover:border-edge"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-semibold text-ink">{p.name}</span>
              {active && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-canvas">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span
                className="text-[28px] font-medium leading-none tracking-tight text-ink"
                style={{ fontFamily: p.display }}
              >
                Harbor
              </span>
              <span className="text-[13px] text-ink-muted" style={{ fontFamily: p.sans }}>
                The quick brown fox jumps over the lazy dog
              </span>
            </div>
            <p className="text-[11.5px] text-ink-subtle">{p.blurb}</p>
          </button>
        );
      })}

      <CustomFontTiles
        activeId={customValue}
        onSelect={onPickCustom}
        onClear={() => onPickPair(pairValue)}
      />
    </div>
  );
}
