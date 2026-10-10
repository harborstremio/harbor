import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { PickerItem } from "./series-episodes/season-arc-picker";

// Regular seasons only: specials and extras stay reachable through the picker itself.
export function pickerStepKeys(items: PickerItem[]): string[] {
  return items.filter((i) => !i.extra && i.key !== "0").map((i) => i.key);
}

export function SeasonStepper({
  keys,
  activeKey,
  onSelect,
  children,
}: {
  keys: string[];
  activeKey: string;
  onSelect: (key: string) => void;
  children: React.ReactNode;
}) {
  const t = useT();
  if (keys.length < 2) return <>{children}</>;
  const idx = keys.indexOf(activeKey);
  const prev = idx > 0 ? keys[idx - 1] : null;
  const next = idx < 0 ? keys[0] : idx < keys.length - 1 ? keys[idx + 1] : null;
  return (
    <div className="flex items-center gap-1.5">
      <StepButton
        label={t("Previous season")}
        disabled={prev == null}
        onClick={() => prev != null && onSelect(prev)}
      >
        <ChevronLeft size={18} strokeWidth={2.2} className="dir-icon" />
      </StepButton>
      {children}
      <StepButton
        label={t("Next season")}
        disabled={next == null}
        onClick={() => next != null && onSelect(next)}
      >
        <ChevronRight size={18} strokeWidth={2.2} className="dir-icon" />
      </StepButton>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-ink transition-colors hover:bg-white/[0.10] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-white/[0.06]"
    >
      {children}
    </button>
  );
}
