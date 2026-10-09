import { FONT_PAIRS, type FontPairId } from "@/lib/theme";
import { CustomFontTiles } from "../custom-font-tiles";
import { PickGrid } from "./controls/pick-grid";
import { TypeSpecimenCard } from "./controls/type-specimen-card";

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
    <div className="flex flex-col gap-2.5">
      <PickGrid cols={1}>
        {Object.values(FONT_PAIRS).map((p) => (
          <TypeSpecimenCard
            key={p.id}
            selected={pairValue === p.id && !customValue}
            onSelect={() => onPickPair(p.id)}
            display={p.display}
            body={p.sans}
            name={p.name}
          />
        ))}
      </PickGrid>
      <CustomFontTiles
        compact
        activeId={customValue}
        onSelect={onPickCustom}
        onClear={() => onPickPair(pairValue)}
      />
    </div>
  );
}
