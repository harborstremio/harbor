import { HardDrive, Play } from "lucide-react";
import type { LocalEntry } from "@/lib/local-library";
import { episodeLabel } from "@/lib/local-library/player-src";
import { LocalVersionBadges } from "@/components/local-version-badges";
import { useT } from "@/lib/i18n";

export function LocalStreamCard({
  entry,
  onPlay,
  showBadges = false,
}: {
  entry: LocalEntry;
  onPlay: () => void;
  showBadges?: boolean;
}) {
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
          {ep && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] tracking-normal">
              {ep}
            </span>
          )}
        </span>
        <span className="truncate text-[14.5px] font-semibold text-ink">{entry.filename}</span>
        {showBadges && <LocalVersionBadges entry={entry} className="mt-1" />}
      </span>
      <span className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-[13.5px] font-semibold text-canvas transition-opacity group-hover:opacity-90">
        <Play size={15} fill="currentColor" />
        {t("Play")}
      </span>
    </button>
  );
}

/**
 * Every local file for this movie/episode, best first. Multiple versions of the
 * same title each get their own row with the format badges that tell them apart.
 */
export function LocalStreamList({
  entries,
  onPlay,
}: {
  entries: LocalEntry[];
  onPlay: (entry: LocalEntry) => void;
}) {
  const t = useT();
  if (entries.length === 0) return null;
  const multi = entries.length > 1;
  return (
    <div className="flex flex-col gap-2">
      {multi && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          {t("{n} versions on your disk", { n: entries.length })}
        </span>
      )}
      {entries.map((entry) => (
        <LocalStreamCard
          key={entry.id}
          entry={entry}
          showBadges={multi}
          onPlay={() => onPlay(entry)}
        />
      ))}
    </div>
  );
}
