import { Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { PickCard } from "./pick-grid";

export function TypeSpecimenCard({
  selected,
  onSelect,
  display,
  body,
  name,
  onRemove,
}: {
  selected: boolean;
  onSelect: () => void;
  display: string;
  body: string;
  name: string;
  onRemove?: () => void;
}) {
  const t = useT();
  return (
    <PickCard
      selected={selected}
      onSelect={onSelect}
      label={name}
      action={
        onRemove ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={t("Remove font")}
            className="group/rm grid h-11 w-11 place-items-center rounded-md text-ink-subtle outline-none transition-colors hover:text-danger focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-canvas/70 ring-1 ring-edge-soft backdrop-blur-sm transition-colors group-hover/rm:ring-danger/40">
              <Trash2 size={15} strokeWidth={2.2} />
            </span>
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-1.5 px-3.5 pb-1 pt-3.5">
        <span
          className="truncate text-[24px] leading-none tracking-tight text-ink"
          style={{ fontFamily: display }}
        >
          Harbor
        </span>
        <span
          className="truncate text-[15.5px] leading-[22px] text-ink-muted"
          style={{ fontFamily: body }}
        >
          {t("The quick brown fox jumps")}
        </span>
        <span className="mt-1 flex items-center gap-3 text-ink-subtle">
          <span className="text-[18px] leading-[24px]" style={{ fontFamily: display }}>
            Aa
          </span>
          <span className="text-[18px] leading-[24px]" style={{ fontFamily: body }}>
            Aa
          </span>
        </span>
      </div>
    </PickCard>
  );
}
