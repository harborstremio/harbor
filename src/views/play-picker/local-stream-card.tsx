import { useT } from "@/lib/i18n";
import type { LocalEntry } from "@/lib/local-library";
import { episodeLabel } from "@/lib/local-library/player-src";
import { HardDrive, Play } from "lucide-react";

export function LocalStreamCard({ entry, onPlay }: { entry: LocalEntry; onPlay: () => void }) {
  const t = useT();
  const ep = episodeLabel(entry);
  return (
    <button
      onClick={onPlay}
      className="group flex items-center gap-4 rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-start transition-colors hover:bg-accent/15"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
        <HardDrive size={19} strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          {t("On your disk")}
          {ep && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] tracking-normal">{ep}</span>}
        </span>
        <span className="truncate text-[14.5px] font-semibold text-ink">{entry.filename}</span>
      </span>
      <span className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-[13.5px] font-semibold text-canvas transition-opacity group-hover:opacity-90">
        <Play size={15} fill="currentColor" />
        {t("Play")}
      </span>
    </button>
  );
}
