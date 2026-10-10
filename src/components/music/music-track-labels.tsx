import { useT } from "@/lib/i18n";
import { musicTrackLabels } from "@/lib/music/track-labels";
import type { MusicTrack } from "@/lib/music/types";

export function MusicTrackLabels({ track }: { track: MusicTrack }) {
  const t = useT();
  return (
    <>
      {musicTrackLabels(track).map((label) => (
        <span
          key={label}
          data-music-label={label}
          title={t(`music.label.${label}`)}
          aria-label={t(`music.label.${label}`)}
          className="inline-flex shrink-0 items-center rounded-[2px] bg-elevated px-1 py-0.5 text-[9px] font-medium leading-none text-ink-muted"
        >
          {label === "explicit" ? "E" : t(`music.label.${label}`)}
        </span>
      ))}
    </>
  );
}
