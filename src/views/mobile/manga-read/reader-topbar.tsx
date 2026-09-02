import { ChevronLeft } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ModeSwitcher } from "./mode-switcher";
import type { LocalMode } from "./local-reader-types";

export function ReaderTopbar({
  chapterLabel,
  pageLabel,
  mode,
  reduce,
  onExit,
  onPickMode,
}: {
  chapterLabel: string;
  pageLabel: string;
  mode: LocalMode;
  reduce: boolean;
  onExit: () => void;
  onPickMode: (m: LocalMode) => void;
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
        <div className="h-11 w-11 shrink-0" />
      </div>
      <div className="mt-2.5 flex justify-center px-3">
        <ModeSwitcher mode={mode} onPick={onPickMode} reduce={reduce} />
      </div>
    </div>
  );
}
