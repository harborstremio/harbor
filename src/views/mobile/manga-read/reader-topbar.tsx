import { ArrowLeftRight, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ModeSwitcher } from "./mode-switcher";
import type { LocalMode } from "./local-reader-types";

export function ReaderTopbar({
  chapterLabel,
  pageLabel,
  mode,
  reduce,
  showPreview,
  rtl,
  onExit,
  onPickMode,
  onTogglePreview,
  onToggleDirection,
}: {
  chapterLabel: string;
  pageLabel: string;
  mode: LocalMode;
  reduce: boolean;
  showPreview: boolean;
  rtl: boolean;
  onExit: () => void;
  onPickMode: (m: LocalMode) => void;
  onTogglePreview: (v: boolean) => void;
  onToggleDirection: () => void;
}) {
  const t = useT();
  return (
    <div
      className="bg-gradient-to-b from-[#0b0b0d]/95 via-[#0b0b0d]/70 to-transparent pb-7"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
    >
      <div className="flex items-center gap-2 px-3">
        <button
          type="button"
          aria-label={t("Back to remote")}
          onClick={onExit}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition-transform active:scale-90 motion-reduce:transition-none"
        >
          <ChevronLeft size={24} strokeWidth={2.2} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <span className="max-w-full truncate text-[14px] font-semibold text-ink">
            {chapterLabel}
          </span>
          {pageLabel && (
            <span className="text-[12px] tabular-nums text-ink-subtle">{pageLabel}</span>
          )}
        </div>
        <button
          type="button"
          aria-label={t("Reading direction")}
          aria-pressed={rtl}
          onClick={onToggleDirection}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform active:scale-90 motion-reduce:transition-none ${rtl ? "text-accent" : "text-ink-muted"}`}
        >
          <ArrowLeftRight size={20} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          aria-label={showPreview ? t("Hide pages") : t("Show pages")}
          aria-pressed={showPreview}
          onClick={() => onTogglePreview(!showPreview)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition-transform active:scale-90 motion-reduce:transition-none"
        >
          {showPreview ? <Eye size={20} strokeWidth={2.2} /> : <EyeOff size={20} strokeWidth={2.2} />}
        </button>
      </div>
      <div className="mt-2.5 flex justify-center px-3">
        <ModeSwitcher mode={mode} onPick={onPickMode} reduce={reduce} />
      </div>
    </div>
  );
}
