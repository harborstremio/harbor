import { ChevronsLeft, ChevronsRight } from "lucide-react";

export function ReaderDock({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      className="bg-gradient-to-t from-[#0b0b0d]/95 to-transparent pt-9"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
    >
      <div className="flex items-center justify-center gap-3 px-4">
        <ChapterButton label="Previous chapter" disabled={!hasPrev} onPress={onPrev}>
          <ChevronsLeft size={20} strokeWidth={2.4} />
          <span>Prev</span>
        </ChapterButton>
        <ChapterButton label="Next chapter" disabled={!hasNext} onPress={onNext}>
          <span>Next</span>
          <ChevronsRight size={20} strokeWidth={2.4} />
        </ChapterButton>
      </div>
    </div>
  );
}

function ChapterButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      className="flex h-11 items-center gap-1.5 rounded-full bg-elevated/70 px-4 text-[13.5px] font-semibold text-ink ring-1 ring-edge-soft/50 backdrop-blur-xl transition-transform active:scale-95 disabled:opacity-30 disabled:active:scale-100 motion-reduce:transition-none"
    >
      {children}
    </button>
  );
}
