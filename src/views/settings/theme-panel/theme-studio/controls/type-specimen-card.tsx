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
            className="grid h-6 w-6 place-items-center rounded-md bg-canvas/70 text-ink-subtle ring-1 ring-edge-soft backdrop-blur-sm transition-colors hover:text-danger hover:ring-danger/40"
          >
            <Trash2 size={12} strokeWidth={2.2} />
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-1 px-3.5 pb-1 pt-3.5">
        <span
          className="truncate text-[22px] leading-none tracking-tight text-ink"
          style={{ fontFamily: display }}
        >
          Harbor
        </span>
        <span className="truncate text-[13px] text-ink-muted" style={{ fontFamily: body }}>
          {t("The quick brown fox jumps")}
        </span>
        <span className="mt-1 flex items-center gap-2.5 text-ink-subtle">
          <span className="text-[15px]" style={{ fontFamily: display }}>
            Aa
          </span>
          <span className="text-[15px]" style={{ fontFamily: body }}>
            Aa
          </span>
        </span>
      </div>
    </PickCard>
  );
}
