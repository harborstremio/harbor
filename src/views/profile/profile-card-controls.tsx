import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { useT } from "@/lib/i18n";
import { CARD_LABELS, type CardKey } from "@/lib/profile-card-layout";

export function ProfileCardControls({
  cardKey,
  index,
  total,
  hidden,
  onMove,
  onToggleHide,
}: {
  cardKey: CardKey;
  index: number;
  total: number;
  hidden: boolean;
  onMove: (dir: -1 | 1) => void;
  onToggleHide: () => void;
}) {
  const t = useT();
  return (
    <div className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-elevated px-2.5 py-1.5 ring-1 ring-edge-soft">
      <span className="flex-1 text-[11.5px] font-semibold uppercase tracking-wider text-ink-subtle">
        {t(CARD_LABELS[cardKey])}
      </span>
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        aria-label={t("Move up")}
        className="grid h-7 w-7 place-items-center rounded-md text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-30"
      >
        <ArrowUp size={15} />
      </button>
      <button
        type="button"
        disabled={index === total - 1}
        onClick={() => onMove(1)}
        aria-label={t("Move down")}
        className="grid h-7 w-7 place-items-center rounded-md text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-30"
      >
        <ArrowDown size={15} />
      </button>
      <button
        type="button"
        onClick={onToggleHide}
        aria-label={hidden ? t("Show card") : t("Hide card")}
        className="grid h-7 w-7 place-items-center rounded-md text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      >
        {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}
