import { useT } from "@/lib/i18n";

// A chapter is synced to the trackers once ~80% of its pages are read,
// mirroring the manga sync threshold in src/lib/manga-tracking.tsx. The
// meter marks this point so the reader can see how close they are to syncing.
const SYNC_THRESHOLD = 0.8;

export function ReaderProgressMeter({
  currentPage,
  totalPages,
  chapterNumber,
  visible,
}: {
  currentPage: number;
  totalPages: number;
  chapterNumber?: string | null;
  visible: boolean;
}) {
  const t = useT();
  const last = Math.max(0, totalPages - 1);
  const page = Math.min(Math.max(0, currentPage), Math.max(0, last));
  const pct = last > 0 ? (page / last) * 100 : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.max(1, last)}
      aria-valuenow={page}
      aria-label={t("Chapter progress")}
      data-chapter={chapterNumber}
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-[85] transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="relative h-[3px] w-full bg-edge-soft/60">
        <div
          className="absolute inset-y-0 start-0 bg-accent"
          style={{ width: `${pct}%` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-[2px] bg-ink/45"
          style={{ left: `${SYNC_THRESHOLD * 100}%` }}
        />
      </div>
    </div>
  );
}
