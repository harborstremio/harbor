import { useT } from "@/lib/i18n";

/** Harbor's compact media marks distinguish the viewing action from audio playback. */
export function MusicMediaBadge({
  kind,
  compact = false,
}: {
  kind?: "audio" | "video";
  compact?: boolean;
}) {
  const t = useT();
  const label = t(kind === "video" ? "music.media.video" : "music.media.audio");
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium leading-none text-ink-muted"
      title={label}
      aria-label={label}
      data-music-kind={kind ?? "audio"}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        {kind === "video" ? (
          <>
            <rect
              x="1.5"
              y="3.5"
              width="17"
              height="13"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="m8 7 5 3-5 3V7Z" fill="currentColor" />
            <path d="M4 1.5v2m12-2v2M4 16.5v2m12-2v2" stroke="currentColor" strokeWidth="1.5" />
          </>
        ) : (
          <>
            <path
              d="M8 14V4l9-2v10M8 7l9-2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <ellipse cx="5.5" cy="14.5" rx="2.5" ry="2" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="14.5" cy="12.5" rx="2.5" ry="2" stroke="currentColor" strokeWidth="1.5" />
          </>
        )}
      </svg>
      {!compact && label}
    </span>
  );
}
